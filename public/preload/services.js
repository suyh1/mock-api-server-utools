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
/** Node.js HTTP 模块，用于创建 WS 底层 HTTP 服务 */
const http = require('http')
/** WebSocket 库 */
const WebSocket = require('ws')

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

        // 4. 预设覆盖：如果有激活的预设，用预设配置替代默认响应
        let activeMode = matchedRule.responseMode || 'basic';
        let activeResponseType = matchedRule.responseType || 'application/json';
        let activeResponseBasic = matchedRule.responseBasic;
        let activeResponseAdvanced = matchedRule.responseAdvanced;
        let activeStatusCode = 200;

        if (matchedRule.activePresetId && matchedRule.responsePresets) {
          const preset = matchedRule.responsePresets.find(p => p.id === matchedRule.activePresetId);
          if (preset) {
            activeMode = preset.responseMode || 'basic';
            activeResponseType = preset.responseType || 'application/json';
            activeResponseBasic = preset.responseBasic;
            activeResponseAdvanced = preset.responseAdvanced;
            activeStatusCode = preset.statusCode || 200;
            console.log(`[Group ${groupId}] Using preset: ${preset.name} (${activeStatusCode})`);
          }
        }

        // 5. 生成响应数据（核心逻辑：区分基础模式和高级模式）
        try {
          let responseData;

          if (activeMode === 'advanced' && activeResponseAdvanced) {
            // --- 高级模式：通过 VM 沙箱执行用户自定义脚本 ---
            const script = new vm.Script(activeResponseAdvanced);
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
            res.status(activeStatusCode).json(responseData);

          } else {
            // --- 基础模式：根据 Content-Type 返回配置的响应内容 ---
            const contentType = activeResponseType || 'application/json';
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
                res.status(activeStatusCode).send(fileBuffer);
              } catch (e) {
                res.status(500).json({ error: 'Failed to read response file', message: e.message });
              }
            } else {
              const bodyStr = activeResponseBasic || '{}';
              res.status(activeStatusCode).send(bodyStr);
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

/* ==================== 项目数据管理 ==================== */

/** uTools 数据库中存储项目数据的键名 */
const DB_PROJECT_KEY = 'mock_projects_v1';

/**
 * 从 uTools 数据库读取所有项目
 * @returns {Array} 项目数组
 */
function getProjects() {
  const doc = utools.db.get(DB_PROJECT_KEY);
  return doc ? doc.data : [];
}

/**
 * 将项目数据保存到 uTools 数据库
 * @param {Array} projects - 项目数组
 */
function saveProjects(projects) {
  const doc = utools.db.get(DB_PROJECT_KEY);
  if (doc) {
    utools.db.put({ _id: DB_PROJECT_KEY, data: projects, _rev: doc._rev });
  } else {
    utools.db.put({ _id: DB_PROJECT_KEY, data: projects });
  }
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

/* -------------------- 项目管理 API -------------------- */

/** GET /_admin/projects - 获取所有项目 */
adminApp.get('/_admin/projects', (req, res) => {
  res.json(getProjects());
});

/** POST /_admin/project/save - 保存或更新单个项目 */
adminApp.post('/_admin/project/save', (req, res) => {
  const project = req.body;
  if (!project.name) {
    return res.status(400).json({ error: 'Project name is required' });
  }

  const projects = getProjects();
  const idx = projects.findIndex(p => p.id === project.id);
  if (idx !== -1) {
    projects[idx] = { ...projects[idx], ...project, id: projects[idx].id, updatedAt: Date.now() };
  } else {
    const now = Date.now();
    projects.push({ ...project, id: now, createdAt: now, updatedAt: now });
  }
  saveProjects(projects);
  res.json({ success: true, data: projects });
});

/** POST /_admin/project/delete - 删除指定项目，同时清除关联分组的 projectId */
adminApp.post('/_admin/project/delete', (req, res) => {
  const { id } = req.body;
  const projects = getProjects().filter(p => p.id !== id);
  saveProjects(projects);

  // 清除关联分组的 projectId
  const groups = getGroups();
  let changed = false;
  groups.forEach(g => {
    if (g.projectId === id) { g.projectId = undefined; changed = true; }
  });
  if (changed) saveGroups(groups);

  res.json({ success: true, data: projects });
});

/* ==================== WebSocket Mock 服务管理 ==================== */

/** uTools 数据库中存储 WS 服务配置的键名 */
const DB_WS_KEY = 'mock_ws_v1';
/** WS 日志上限 */
const WS_LOG_LIMIT = 500;

/**
 * 从 uTools 数据库读取所有 WS 服务配置
 * @description 首次使用时自动创建示例 WS 服务
 * @returns {Array} WS 服务配置数组
 */
function getWsServers() {
  const doc = utools.db.get(DB_WS_KEY);
  let data = doc ? doc.data : [];
  // 首次使用：自动创建示例 WS 服务
  if (!doc || (Array.isArray(data) && data.length === 0)) {
    data = [createExampleWsServer()];
    saveWsServers(data);
  }
  return data;
}

/**
 * 创建内置示例 WS 服务配置
 * @returns {object} 示例 WS 服务对象
 */
function createExampleWsServer() {
  const now = Date.now();
  return {
    id: now,
    name: '💬 示例聊天服务',
    port: 8088,
    path: '/ws',
    description: '内置示例 WebSocket Mock 服务，包含 4 种匹配规则演示。启动后可在浏览器 DevTools 中测试连接。',
    onConnectMessage: JSON.stringify({ type: 'welcome', message: '欢迎连接 Mock WebSocket 服务！', timestamp: '{{now}}' }),
    rules: [
      {
        id: now + 1,
        name: '心跳检测 (精确匹配)',
        active: true,
        matchType: 'exact',
        matchPattern: 'ping',
        delay: 0,
        responseMode: 'basic',
        responseBasic: 'pong',
        responseAdvanced: '',
      },
      {
        id: now + 2,
        name: '打招呼 (包含匹配)',
        active: true,
        matchType: 'contains',
        matchPattern: 'hello',
        delay: 200,
        responseMode: 'basic',
        responseBasic: JSON.stringify({ type: 'greeting', message: '你好！我是 Mock 服务器 🤖', time: new Date().toISOString() }),
        responseAdvanced: '',
      },
      {
        id: now + 3,
        name: 'JSON 消息 (正则匹配)',
        active: true,
        matchType: 'regex',
        matchPattern: '^\\{.*"type"\\s*:.*\\}$',
        delay: 100,
        responseMode: 'advanced',
        responseBasic: '',
        responseAdvanced: [
          'function main(message, Mock) {',
          '  // 解析收到的 JSON 消息，根据 type 字段返回不同响应',
          '  let parsed;',
          '  try { parsed = JSON.parse(message); } catch(e) { return { error: "JSON 解析失败" }; }',
          '',
          '  if (parsed.type === "user.info") {',
          '    // 使用 Mock.js 生成随机用户数据',
          '    return Mock.mock({',
          '      type: "user.info.response",',
          '      data: {',
          '        "id|1-1000": 1,',
          '        name: "@cname",',
          '        email: "@email",',
          '        avatar: "@image(200x200)",',
          '        "age|18-60": 1',
          '      }',
          '    });',
          '  }',
          '',
          '  if (parsed.type === "chat.send") {',
          '    return {',
          '      type: "chat.receive",',
          '      from: "MockBot",',
          '      content: "收到你的消息: " + (parsed.content || ""),',
          '      timestamp: Date.now()',
          '    };',
          '  }',
          '',
          '  return { type: "echo", original: parsed, serverTime: Date.now() };',
          '}',
        ].join('\n'),
      },
      {
        id: now + 4,
        name: '默认回复 (任意匹配)',
        active: true,
        matchType: 'any',
        matchPattern: '',
        delay: 0,
        responseMode: 'basic',
        responseBasic: JSON.stringify({ type: 'echo', message: '收到消息，但没有匹配到特定规则', tip: '试试发送 ping、hello 或 JSON 格式消息' }),
        responseAdvanced: '',
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * 将 WS 服务配置保存到 uTools 数据库
 * @param {Array} servers - WS 服务配置数组
 */
function saveWsServers(servers) {
  const doc = utools.db.get(DB_WS_KEY);
  if (doc) {
    utools.db.put({ _id: DB_WS_KEY, data: servers, _rev: doc._rev });
  } else {
    utools.db.put({ _id: DB_WS_KEY, data: servers });
  }
}

/** 运行中的 WS 服务实例映射表，key 为 serverId，value 为 { httpServer, wss, clients } */
const runningWsServers = new Map();
/** WS 服务消息日志缓冲，key 为 serverId，value 为日志数组 */
const wsServerLogs = new Map();

/**
 * 添加 WS 日志条目
 * @param {string|number} serverId
 * @param {object} entry - 日志条目（不含 id）
 */
function addWsLog(serverId, entry) {
  const key = String(serverId);
  if (!wsServerLogs.has(key)) wsServerLogs.set(key, []);
  const logs = wsServerLogs.get(key);
  const logEntry = { id: Date.now() + Math.random(), ...entry };
  logs.push(logEntry);
  if (logs.length > WS_LOG_LIMIT) logs.splice(0, logs.length - WS_LOG_LIMIT);
  return logEntry;
}

/**
 * 按顺序匹配 WS 消息规则
 * @param {string} message - 收到的消息
 * @param {Array} rules - 规则列表
 * @returns {object|null} 匹配到的规则，或 null
 */
function matchWsRule(message, rules) {
  if (!rules || !rules.length) return null;
  for (const rule of rules) {
    if (!rule.active) continue;
    switch (rule.matchType) {
      case 'exact':
        if (message === rule.matchPattern) return rule;
        break;
      case 'contains':
        if (message.includes(rule.matchPattern)) return rule;
        break;
      case 'regex':
        try { if (new RegExp(rule.matchPattern).test(message)) return rule; } catch (e) { /* ignore bad regex */ }
        break;
      case 'any':
        return rule;
    }
  }
  return null;
}

/**
 * 生成 WS 规则的响应内容
 * @param {object} rule - 匹配到的规则
 * @param {string} message - 原始消息
 * @param {string} clientId - 客户端 ID
 * @param {string} clientIp - 客户端 IP
 * @returns {Promise<string|null>} 响应字符串
 */
async function generateWsResponse(rule, message, clientId, clientIp) {
  if (rule.responseMode === 'advanced' && rule.responseAdvanced) {
    try {
      const script = new vm.Script(rule.responseAdvanced);
      const sandbox = { message, clientId, clientIp, Mock, console };
      const context = vm.createContext(sandbox);
      script.runInContext(context);
      if (typeof sandbox.main === 'function') {
        const result = await sandbox.main(message, Mock);
        return typeof result === 'string' ? result : JSON.stringify(result);
      }
      return null;
    } catch (e) {
      console.error('[WS] Advanced script error:', e.message);
      return JSON.stringify({ error: 'Script execution failed', message: e.message });
    }
  }
  return rule.responseBasic || null;
}

/**
 * 启动 WS Mock 服务
 * @param {string|number} serverId - WS 服务 ID
 * @returns {Promise<{success: boolean}>}
 */
function startWsServer(serverId) {
  return new Promise((resolve, reject) => {
    const sid = String(serverId);
    if (runningWsServers.has(sid)) {
      return resolve({ success: true, msg: 'Already running' });
    }

    const servers = getWsServers();
    const config = servers.find(s => String(s.id) === sid);
    if (!config) return reject(new Error('WS server config not found'));

    const httpServer = http.createServer();
    const wsPath = config.path && config.path.startsWith('/') ? config.path : '/' + (config.path || '');
    const wss = new WebSocket.Server({ server: httpServer, path: wsPath });

    /** 已连接客户端 Map: clientId -> { ws, ip, connectedAt } */
    const clients = new Map();
    let clientCounter = 0;

    wss.on('connection', (ws, req) => {
      clientCounter++;
      const clientId = `client_${Date.now()}_${clientCounter}`;
      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
      clients.set(clientId, { ws, ip: clientIp, connectedAt: Date.now() });

      addWsLog(sid, {
        serverId: Number(serverId), timestamp: Date.now(), direction: 'system',
        clientId, clientIp, message: `客户端已连接 (${clientIp})`
      });
      console.log(`[WS:${config.port}] Client connected: ${clientId} (${clientIp})`);

      // 发送欢迎消息
      if (config.onConnectMessage) {
        ws.send(config.onConnectMessage);
        addWsLog(sid, {
          serverId: Number(serverId), timestamp: Date.now(), direction: 'out',
          clientId, clientIp, message: config.onConnectMessage, matchedRule: '欢迎消息'
        });
      }

      ws.on('message', async (data) => {
        const message = data.toString();
        addWsLog(sid, {
          serverId: Number(serverId), timestamp: Date.now(), direction: 'in',
          clientId, clientIp, message
        });

        // 重新读取最新规则配置
        const latestServers = getWsServers();
        const latestConfig = latestServers.find(s => String(s.id) === sid);
        const rules = latestConfig ? latestConfig.rules : [];
        const matched = matchWsRule(message, rules);

        if (matched) {
          const delay = matched.delay || 0;
          if (delay > 0) await new Promise(r => setTimeout(r, delay));

          const response = await generateWsResponse(matched, message, clientId, clientIp);
          if (response !== null && ws.readyState === WebSocket.OPEN) {
            ws.send(response);
            addWsLog(sid, {
              serverId: Number(serverId), timestamp: Date.now(), direction: 'out',
              clientId, clientIp, message: response, matchedRule: matched.name
            });
          }
        }
      });

      ws.on('close', () => {
        clients.delete(clientId);
        addWsLog(sid, {
          serverId: Number(serverId), timestamp: Date.now(), direction: 'system',
          clientId, clientIp, message: `客户端已断开`
        });
        console.log(`[WS:${config.port}] Client disconnected: ${clientId}`);
      });

      ws.on('error', (err) => {
        addWsLog(sid, {
          serverId: Number(serverId), timestamp: Date.now(), direction: 'system',
          clientId, clientIp, message: `错误: ${err.message}`
        });
      });
    });

    httpServer.listen(config.port, '0.0.0.0', () => {
      console.log(`[WS] Server started: ws://${LOCAL_IP}:${config.port}${wsPath}`);
      runningWsServers.set(sid, { httpServer, wss, clients });
      resolve({ success: true, ip: LOCAL_IP, port: config.port, path: wsPath });
    });
    httpServer.on('error', (err) => reject(err));
  });
}

/**
 * 停止 WS Mock 服务
 * @param {string|number} serverId
 * @returns {boolean}
 */
function stopWsServer(serverId) {
  const sid = String(serverId);
  const entry = runningWsServers.get(sid);
  if (!entry) return false;

  // 关闭所有客户端连接
  for (const [, client] of entry.clients) {
    try { client.ws.close(); } catch (e) { /* ignore */ }
  }
  entry.wss.close();
  entry.httpServer.close();
  runningWsServers.delete(sid);
  console.log(`[WS] Server stopped: ${sid}`);
  return true;
}

/* -------------------- WS Admin API -------------------- */

/** GET /_admin/ws/servers - 获取所有 WS 服务配置 */
adminApp.get('/_admin/ws/servers', (req, res) => {
  res.json(getWsServers());
});

/** POST /_admin/ws/server/save - 创建/更新 WS 服务 */
adminApp.post('/_admin/ws/server/save', (req, res) => {
  const server = req.body;
  if (!server.name || !server.port) {
    return res.status(400).json({ error: 'Name and port are required' });
  }
  const servers = getWsServers();
  const idx = servers.findIndex(s => s.id === server.id);
  if (idx !== -1) {
    servers[idx] = { ...servers[idx], ...server, id: servers[idx].id, updatedAt: Date.now() };
  } else {
    const now = Date.now();
    servers.push({ ...server, id: now, rules: server.rules || [], createdAt: now, updatedAt: now });
  }
  saveWsServers(servers);
  res.json({ success: true, data: servers });
});

/** POST /_admin/ws/server/delete - 删除 WS 服务 */
adminApp.post('/_admin/ws/server/delete', (req, res) => {
  const { id } = req.body;
  stopWsServer(id); // 自动停止运行中的服务
  const servers = getWsServers().filter(s => s.id !== id);
  saveWsServers(servers);
  res.json({ success: true, data: servers });
});

/** POST /_admin/ws/server/start - 启动 WS 服务 */
adminApp.post('/_admin/ws/server/start', async (req, res) => {
  try {
    const result = await startWsServer(req.body.id);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** POST /_admin/ws/server/stop - 停止 WS 服务 */
adminApp.post('/_admin/ws/server/stop', (req, res) => {
  stopWsServer(req.body.id);
  res.json({ success: true });
});

/** GET /_admin/ws/server/status - 获取所有 WS 服务运行状态 */
adminApp.get('/_admin/ws/server/status', (req, res) => {
  const status = {};
  for (const [sid, info] of runningWsServers) {
    status[sid] = { running: true, clientCount: info.clients.size };
  }
  res.json(status);
});

/** GET /_admin/ws/server/:id/clients - 获取连接的客户端列表 */
adminApp.get('/_admin/ws/server/:id/clients', (req, res) => {
  const sid = String(req.params.id);
  const entry = runningWsServers.get(sid);
  if (!entry) return res.json([]);
  const list = [];
  for (const [clientId, info] of entry.clients) {
    list.push({ clientId, clientIp: info.ip, connectedAt: info.connectedAt });
  }
  res.json(list);
});

/** GET /_admin/ws/server/:id/logs - 获取消息日志（支持 ?since=timestamp 增量获取） */
adminApp.get('/_admin/ws/server/:id/logs', (req, res) => {
  const sid = String(req.params.id);
  const logs = wsServerLogs.get(sid) || [];
  const since = req.query.since ? Number(req.query.since) : 0;
  if (since > 0) {
    res.json(logs.filter(l => l.timestamp > since));
  } else {
    res.json(logs);
  }
});

/** POST /_admin/ws/server/:id/send - 手动发送消息 */
adminApp.post('/_admin/ws/server/:id/send', (req, res) => {
  const sid = String(req.params.id);
  const { clientId, message } = req.body;
  const entry = runningWsServers.get(sid);
  if (!entry) return res.status(400).json({ error: 'Server not running' });

  let sent = 0;
  if (clientId && clientId !== '__all__') {
    // 发送给指定客户端
    const client = entry.clients.get(clientId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(message);
      addWsLog(sid, {
        serverId: Number(req.params.id), timestamp: Date.now(), direction: 'out',
        clientId, clientIp: client.ip, message, matchedRule: '手动发送'
      });
      sent = 1;
    }
  } else {
    // 广播给所有客户端
    for (const [cid, client] of entry.clients) {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(message);
        addWsLog(sid, {
          serverId: Number(req.params.id), timestamp: Date.now(), direction: 'out',
          clientId: cid, clientIp: client.ip, message, matchedRule: '广播'
        });
        sent++;
      }
    }
  }
  res.json({ success: true, sent });
});

/** POST /_admin/ws/server/:id/disconnect - 断开指定客户端 */
adminApp.post('/_admin/ws/server/:id/disconnect', (req, res) => {
  const sid = String(req.params.id);
  const { clientId } = req.body;
  const entry = runningWsServers.get(sid);
  if (!entry) return res.status(400).json({ error: 'Server not running' });

  const client = entry.clients.get(clientId);
  if (client) {
    try { client.ws.close(); } catch (e) { /* ignore */ }
    entry.clients.delete(clientId);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Client not found' });
  }
});

/** 启动 Admin 管理服务器，监听所有网络接口 */
const server = adminApp.listen(ADMIN_PORT, '0.0.0.0', () => {
  console.log(`Admin running: http://${LOCAL_IP}:${ADMIN_PORT}`);
});
server.on('error', (e) => console.error(e));