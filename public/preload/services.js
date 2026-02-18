/**
 * @file services.js - Mock API 服务端核心逻辑
 * @description uTools 插件的 preload 脚本，负责：
 *              1. 管理 Admin 管理服务器（端口 3000），提供规则和模板的 CRUD API
 *              2. 动态创建/销毁 Mock 服务实例，每个分组可独立启停
 *              3. 请求匹配与响应生成（支持基础模式和 VM 沙箱高级模式）
 *              4. 通过 uTools DB 持久化存储规则和模板数据
 */

/** Node.js 文件系统模块 */
const fs = require('node:fs')
/** Node.js 路径处理模块 */
const path = require('node:path')
/** Node.js 操作系统信息模块 */
const os = require('node:os')
/** Express Web 框架 */
const express = require('express')
/** 跨域资源共享中间件 */
const cors = require('cors')
/** 请求体解析中间件 */
const bodyParser = require('body-parser')
/** Node.js 网络模块，用于端口检测 */
const net = require('net')
/** Node.js VM 模块，用于执行高级模式脚本的沙箱环境 */
const vm = require('vm')

/**
 * 尝试加载 mockjs 库
 * @description 如果用户未安装 mockjs，则提供一个降级的 mock 对象，
 *              调用时返回错误提示而非抛出异常
 */
let Mock;
try {
  Mock = require('mockjs');
} catch (e) {
  Mock = { mock: (data) => ({ error: 'Mockjs not installed', data }) };
}

/* ==================== 工具函数 ==================== */

/**
 * 获取本机局域网 IPv4 地址
 * @returns {string} 本机 IPv4 地址，获取失败时返回 'localhost'
 */
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return 'localhost';
}

/** 本机局域网 IP 地址（缓存） */
const LOCAL_IP = getLocalIP();
/** Admin 管理服务器端口 */
const ADMIN_PORT = 3000;
/** uTools 数据库中存储 Mock 规则的键名 */
const DB_KEY = 'mock_rules_v1';

/* ==================== Window Services（暴露给渲染进程的接口） ==================== */

/**
 * 挂载到 window 上的服务接口，供 Vue 前端调用
 * @property {Function} readFile - 读取本地文件内容
 * @property {Function} writeTextFile - 将文本写入下载目录并返回文件路径
 * @property {Function} getServerUrl - 获取 Admin 服务器完整 URL
 * @property {Function} getLocalIP - 获取本机局域网 IP
 */
window.services = {
  readFile(file) { return fs.readFileSync(file, { encoding: 'utf-8' }) },
  writeTextFile(text) {
    const filePath = path.join(window.utools.getPath('downloads'), Date.now() + '.txt')
    fs.writeFileSync(filePath, text, { encoding: 'utf-8' })
    return filePath
  },
  writeImageFile(base64Url) { /*...*/ },
  getServerUrl() { return `http://${LOCAL_IP}:${ADMIN_PORT}` },
  getLocalIP() { return LOCAL_IP }
}

/* ==================== 数据库操作（uTools DB 持久化） ==================== */

/**
 * 从 uTools 数据库读取分组规则数据
 * @description 兼容旧版数据格式：如果数据是扁平的规则数组（含 url 字段），
 *              自动包装为默认分组结构并保存
 * @returns {Array} 分组规则数组
 */
function getGroups() {
  const doc = utools.db.get(DB_KEY);
  let data = doc ? doc.data : [];
  if (Array.isArray(data) && data.length > 0 && data[0].url) {
    data = [{ id: Date.now(), name: '默认分组', children: data }];
    saveGroups(data);
  }
  return data;
}

/**
 * 将分组规则数据保存到 uTools 数据库
 * @description 自动处理文档版本号（_rev），支持新建和更新操作
 * @param {Array} groups - 分组规则数组
 */
function saveGroups(groups) {
  const doc = utools.db.get(DB_KEY);
  if (doc) {
    utools.db.put({ _id: DB_KEY, data: groups, _rev: doc._rev });
  } else {
    utools.db.put({ _id: DB_KEY, data: groups });
  }
}

/* ==================== 动态 Mock 服务管理器 ==================== */

/** 运行中的 Mock 服务实例映射表，key 为分组 ID，value 为 { server, port, prefix } */
const runningServices = new Map();

/**
 * 启动指定分组的 Mock 服务
 * @description 创建 Express 应用实例，配置中间件和路由匹配逻辑，
 *              支持基础模式（直接返回配置的响应体）和高级模式（VM 沙箱执行脚本）。
 *              如果该分组已有运行中的服务且端口相同，则仅更新前缀；端口不同则先关闭再重建。
 * @param {string|number} rawGroupId - 分组 ID
 * @param {number} port - 监听端口号
 * @param {string} prefix - URL 路径前缀
 * @returns {Promise<{success: boolean, ip: string}>} 启动结果
 */
function startGroupServer(rawGroupId, port, prefix) {
  return new Promise((resolve, reject) => {
    const groupId = String(rawGroupId);

    if (runningServices.has(groupId)) {
      const existing = runningServices.get(groupId);
      if (existing.port === port) {
        existing.prefix = prefix;
        return resolve({ success: true, ip: LOCAL_IP, msg: 'Service updated' });
      }
      existing.server.close();
      runningServices.delete(groupId);
    }

    const app = express();
    app.use(cors());
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: true }));
    app.use(bodyParser.text({ type: ['text/*', 'application/xml', 'application/javascript'] }));
    app.use(bodyParser.raw({ type: ['application/pdf', 'application/zip', 'application/octet-stream', 'video/*'] }));

    app.get('/', (req, res) => res.send(`Mock Service Group ${groupId} running on port ${port}`));

    app.use(async (req, res) => {
      const method = req.method;
      let url = req.path;

      if (url === '/') return;

      if (prefix) {
        const normalizedPrefix = prefix.startsWith('/') ? prefix : '/' + prefix;
        if (!url.startsWith(normalizedPrefix)) return res.status(404).json({ error: `Path prefix mismatch: ${normalizedPrefix}` });
        url = url.slice(normalizedPrefix.length);
        if (!url.startsWith('/')) url = '/' + url;
      }

      const groups = getGroups();
      const targetGroup = groups.find(g => String(g.id) === groupId);
      if (!targetGroup) return res.status(404).json({ error: 'Group not found' });

      const matchedRule = targetGroup.children.find(r => {
          let ruleUrl = r.url;
          if (ruleUrl && !ruleUrl.startsWith('/')) ruleUrl = '/' + ruleUrl;
          return r.active && r.method === method && ruleUrl === url;
      });

      if (matchedRule) {
        console.log(`[Group ${groupId}] Hit: ${method} ${url}`);

        // 1. 入参校验（检查必填的 Header 和 Query 参数）
        const missing = [];
        matchedRule.headers?.forEach(h => {
          if (h.required && h.key && !req.headers[h.key.toLowerCase()]) missing.push(`Missing header: ${h.key}`);
        });
        matchedRule.params?.forEach(p => {
          if (p.required && p.key && !req.query[p.key]) missing.push(`Missing query: ${p.key}`);
        });
        if (missing.length > 0) return res.status(400).json({ error: 'Validation failed', details: missing });

        // 2. 模拟网络延迟（毫秒）
        if (matchedRule.delay > 0) await new Promise(r => setTimeout(r, matchedRule.delay));

        // 3. 设置自定义响应头
        matchedRule.responseHeaders?.forEach(h => {
          if (h.key && h.value) res.setHeader(h.key, h.value);
        });

        // 4. 生成响应数据（核心逻辑：区分基础模式和高级模式）
        try {
          let responseData;
          const mode = matchedRule.responseMode || 'basic'; // 响应模式：basic（基础）或 advanced（高级）

          if (mode === 'advanced' && matchedRule.responseAdvanced) {
            // --- 高级模式：通过 VM 沙箱执行用户自定义脚本 ---
            const script = new vm.Script(matchedRule.responseAdvanced);
            const sandbox = {
              req: {
                query: req.query,
                body: req.body,
                headers: req.headers,
                method: req.method,
                path: req.path
              },
              Mock,
              console
            };
            const context = vm.createContext(sandbox);
            script.runInContext(context);

            // 执行用户定义的 main 函数（脚本中必须定义 main 函数）
            if (typeof sandbox.main === 'function') {
              responseData = await sandbox.main(sandbox.req, sandbox.Mock);
            } else {
              throw new Error('Main function not defined in script');
            }
            // 高级模式默认返回 JSON 格式
            res.status(200).json(responseData);

          } else {
            // --- 基础模式：根据 Content-Type 返回配置的响应内容 ---
            const contentType = matchedRule.responseType || 'application/json';
            res.setHeader('Content-Type', contentType);

            // 二进制文件类型列表：直接读取本地文件返回
            const binaryTypes = [
              'application/pdf', 'application/zip',
              'application/octet-stream', 'video/mp4',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            ];
            if (binaryTypes.some(t => contentType.includes(t))) {
              const filePath = matchedRule.responseFile;
              if (!filePath) {
                return res.status(400).json({ error: 'No file configured for this binary response type' });
              }
              try {
                if (!fs.existsSync(filePath)) {
                  return res.status(404).json({ error: 'Response file not found', path: filePath });
                }
                const fileBuffer = fs.readFileSync(filePath);
                // 为下载类型设置文件名
                const fileName = path.basename(filePath);
                res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileName)}"`);
                res.status(200).send(fileBuffer);
              } catch (e) {
                res.status(500).json({ error: 'Failed to read response file', message: e.message });
              }
            } else {
              const bodyStr = matchedRule.responseBasic || '{}';
              res.status(200).send(bodyStr);
            }
          }

        } catch (e) {
          console.error('Mock execution error:', e);
          res.status(500).json({ error: 'Mock execution failed', message: e.message });
        }

      } else {
        res.status(404).json({ error: `No rule matched ${method} ${url}` });
      }
    });

    const server = app.listen(port, '0.0.0.0', () => {
      console.log(`Group ${groupId} started: http://${LOCAL_IP}:${port}`);
      runningServices.set(groupId, { server, port, prefix });
      resolve({ success: true, ip: LOCAL_IP });
    });
    server.on('error', (err) => reject(err));
  });
}

/**
 * 停止指定分组的 Mock 服务
 * @param {string|number} rawGroupId - 分组 ID
 * @returns {boolean} 是否成功停止（false 表示该分组没有运行中的服务）
 */
function stopGroupServer(rawGroupId) {
  const groupId = String(rawGroupId);
  if (runningServices.has(groupId)) {
    runningServices.get(groupId).server.close();
    runningServices.delete(groupId);
    return true;
  }
  return false;
}

/**
 * 检测指定端口是否可用
 * @description 尝试在该端口创建 TCP 服务器，成功则端口可用，失败则端口被占用
 * @param {number} port - 要检测的端口号
 * @returns {Promise<boolean>} true 表示端口可用，false 表示已被占用
 */
function checkPort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => { server.close(); resolve(true); });
    server.listen(port, '0.0.0.0');
  });
}

/* ==================== 模板数据管理 ==================== */

/** uTools 数据库中存储模板数据的键名 */
const DB_TEMPLATE_KEY = 'mock_templates_v1';

/**
 * 从 uTools 数据库读取所有模板
 * @returns {Array} 模板数组
 */
function getTemplates() {
  const doc = utools.db.get(DB_TEMPLATE_KEY);
  return doc ? doc.data : [];
}

/**
 * 将模板数据保存到 uTools 数据库
 * @param {Array} templates - 模板数组
 */
function saveTemplates(templates) {
  const doc = utools.db.get(DB_TEMPLATE_KEY);
  if (doc) {
    utools.db.put({ _id: DB_TEMPLATE_KEY, data: templates, _rev: doc._rev });
  } else {
    utools.db.put({ _id: DB_TEMPLATE_KEY, data: templates });
  }
}

/* ==================== Admin 管理服务器 ==================== */

/** Admin Express 应用实例 */
const adminApp = express();
adminApp.use(cors());
adminApp.use(bodyParser.json());

/** GET /_admin/rules - 获取所有分组规则 */
adminApp.get('/_admin/rules', (req, res) => res.json(getGroups()));
/** POST /_admin/rules - 保存分组规则（全量覆盖） */
adminApp.post('/_admin/rules', (req, res) => { saveGroups(req.body); res.json({ success: true }); });
/** POST /_admin/service/start - 启动指定分组的 Mock 服务 */
adminApp.post('/_admin/service/start', async (req, res) => {
  try { res.json(await startGroupServer(req.body.groupId, parseInt(req.body.port), req.body.prefix || '')); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
/** POST /_admin/service/stop - 停止指定分组的 Mock 服务 */
adminApp.post('/_admin/service/stop', (req, res) => { stopGroupServer(req.body.groupId); res.json({ success: true }); });
/** POST /_admin/service/check - 检测端口是否可用 */
adminApp.post('/_admin/service/check', async (req, res) => { res.json({ available: await checkPort(parseInt(req.body.port)) }); });
/** GET /_admin/service/status - 获取所有运行中服务的状态 */
adminApp.get('/_admin/service/status', (req, res) => {
  const status = {};
  for (const [gid, info] of runningServices) status[gid] = { running: true, port: info.port, prefix: info.prefix };
  res.json(status);
});
/** GET /_admin/templates - 获取所有模板 */
adminApp.get('/_admin/templates', (req, res) => {
  res.json(getTemplates());
});
/** POST /_admin/template/save - 保存或更新单个模板（有 ID 则更新，无 ID 则新增） */
adminApp.post('/_admin/template/save', (req, res) => {
  const newTemplate = req.body;
  if (!newTemplate.name || !newTemplate.content) {
    return res.status(400).json({ error: 'Name and content are required' });
  }

  const templates = getTemplates();
  // 如果有 ID 则更新已有模板，否则新增
  const idx = templates.findIndex(t => t.id === newTemplate.id);
  if (idx !== -1) {
    // 编辑模式：保留原 ID 和创建时间，更新其他字段
    templates[idx] = {
      ...templates[idx],
      ...newTemplate,
      id: templates[idx].id // 确保 ID 不变
      };
  } else {
    // 新增模式：自动生成 ID 和创建时间
    templates.push({
      ...newTemplate,
      id: Date.now(),
      createdAt: Date.now()
    });
  }
  saveTemplates(templates);
  res.json({ success: true, data: templates });
});
/** POST /_admin/template/delete - 删除指定模板 */
adminApp.post('/_admin/template/delete', (req, res) => {
  const { id } = req.body;
  const templates = getTemplates().filter(t => t.id !== id);
  saveTemplates(templates);
  res.json({ success: true, data: templates });
});

/** 启动 Admin 管理服务器，监听所有网络接口 */
const server = adminApp.listen(ADMIN_PORT, '0.0.0.0', () => {
  console.log(`Admin running: http://${LOCAL_IP}:${ADMIN_PORT}`);
});
server.on('error', (e) => console.error(e));