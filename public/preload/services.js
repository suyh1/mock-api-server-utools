const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser')
const net = require('net')
const vm = require('vm') // 用于执行高级模式脚本

// 尝试加载 mockjs，如果用户没装则给个提示对象
let Mock;
try {
  Mock = require('mockjs');
} catch (e) {
  Mock = { mock: (data) => ({ error: 'Mockjs not installed', data }) };
}

// --- 工具函数保持不变 ---
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return 'localhost';
}

const LOCAL_IP = getLocalIP();
const ADMIN_PORT = 3000;
const DB_KEY = 'mock_rules_v1';

// Window Services 保持不变
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

// 数据库操作保持不变
function getGroups() {
  const doc = utools.db.get(DB_KEY);
  let data = doc ? doc.data : [];
  if (Array.isArray(data) && data.length > 0 && data[0].url) {
    data = [{ id: Date.now(), name: '默认分组', children: data }];
    saveGroups(data);
  }
  return data;
}

function saveGroups(groups) {
  const doc = utools.db.get(DB_KEY);
  if (doc) {
    utools.db.put({ _id: DB_KEY, data: groups, _rev: doc._rev });
  } else {
    utools.db.put({ _id: DB_KEY, data: groups });
  }
}

// --- 动态服务管理器 ---
const runningServices = new Map();

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
        if (!url.startsWith(prefix)) return res.status(404).json({ error: `Path prefix mismatch: ${prefix}` });
        url = url.slice(prefix.length);
        if (!url.startsWith('/')) url = '/' + url;
      }

      const groups = getGroups();
      const targetGroup = groups.find(g => String(g.id) === groupId);
      if (!targetGroup) return res.status(404).json({ error: 'Group not found' });

      const matchedRule = targetGroup.children.find(r =>
          r.active && r.method === method && r.url === url
      );

      if (matchedRule) {
        console.log(`[Group ${groupId}] Hit: ${method} ${url}`);

        // 1. 入参校验 (Header/Query)
        const missing = [];
        matchedRule.headers?.forEach(h => {
          if (h.required && h.key && !req.headers[h.key.toLowerCase()]) missing.push(`Missing header: ${h.key}`);
        });
        matchedRule.params?.forEach(p => {
          if (p.required && p.key && !req.query[p.key]) missing.push(`Missing query: ${p.key}`);
        });
        if (missing.length > 0) return res.status(400).json({ error: 'Validation failed', details: missing });

        // 2. 模拟延迟
        if (matchedRule.delay > 0) await new Promise(r => setTimeout(r, matchedRule.delay));

        // 3. 设置自定义响应头
        matchedRule.responseHeaders?.forEach(h => {
          if (h.key && h.value) res.setHeader(h.key, h.value);
        });

        // 4. 生成响应数据 (核心修改)
        try {
          let responseData;
          const mode = matchedRule.responseMode || 'basic'; // 默认基础模式

          if (mode === 'advanced' && matchedRule.responseAdvanced) {
            // --- 高级模式 (VM 沙箱执行) ---
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

            // 执行用户定义的 main 函数
            if (typeof sandbox.main === 'function') {
              responseData = await sandbox.main(sandbox.req, sandbox.Mock);
            } else {
              throw new Error('Main function not defined in script');
            }
            // 高级模式默认 JSON，除非脚本里自己处理了 res (目前没暴露 res)
            res.status(200).json(responseData);

          } else {
            // --- 基础模式 ---
            const contentType = matchedRule.responseType || 'application/json';
            res.setHeader('Content-Type', contentType);

            // 文件类型：直接读取本地文件返回
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

function stopGroupServer(rawGroupId) {
  const groupId = String(rawGroupId);
  if (runningServices.has(groupId)) {
    runningServices.get(groupId).server.close();
    runningServices.delete(groupId);
    return true;
  }
  return false;
}

function checkPort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => { server.close(); resolve(true); });
    server.listen(port, '0.0.0.0');
  });
}

// 模板管理操作
const DB_TEMPLATE_KEY = 'mock_templates_v1';

// --- 模板数据操作 ---
function getTemplates() {
  const doc = utools.db.get(DB_TEMPLATE_KEY);
  return doc ? doc.data : [];
}

function saveTemplates(templates) {
  const doc = utools.db.get(DB_TEMPLATE_KEY);
  if (doc) {
    utools.db.put({ _id: DB_TEMPLATE_KEY, data: templates, _rev: doc._rev });
  } else {
    utools.db.put({ _id: DB_TEMPLATE_KEY, data: templates });
  }
}

// Admin Server 保持不变
const adminApp = express();
adminApp.use(cors());
adminApp.use(bodyParser.json());
adminApp.get('/_admin/rules', (req, res) => res.json(getGroups()));
adminApp.post('/_admin/rules', (req, res) => { saveGroups(req.body); res.json({ success: true }); });
adminApp.post('/_admin/service/start', async (req, res) => {
  try { res.json(await startGroupServer(req.body.groupId, parseInt(req.body.port), req.body.prefix || '')); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
adminApp.post('/_admin/service/stop', (req, res) => { stopGroupServer(req.body.groupId); res.json({ success: true }); });
adminApp.post('/_admin/service/check', async (req, res) => { res.json({ available: await checkPort(parseInt(req.body.port)) }); });
adminApp.get('/_admin/service/status', (req, res) => {
  const status = {};
  for (const [gid, info] of runningServices) status[gid] = { running: true, port: info.port, prefix: info.prefix };
  res.json(status);
});
// 获取所有模板
adminApp.get('/_admin/templates', (req, res) => {
  res.json(getTemplates());
});
// 2. 保存/更新单个模板
adminApp.post('/_admin/template/save', (req, res) => {
  const newTemplate = req.body;
  if (!newTemplate.name || !newTemplate.content) {
    return res.status(400).json({ error: 'Name and content are required' });
  }

  const templates = getTemplates();
  // 如果有 ID 则更新，否则新增
  const idx = templates.findIndex(t => t.id === newTemplate.id);
  if (idx !== -1) {
    // 编辑模式：保留原创建时间，更新其他字段
    templates[idx] = {
      ...templates[idx],
      ...newTemplate,
      id: templates[idx].id // 确保 ID 不变
      };
  } else {
    // 新增模式
    templates.push({
      ...newTemplate,
      id: Date.now(),
      createdAt: Date.now()
    });
  }
  saveTemplates(templates);
  res.json({ success: true, data: templates });
});
// 3. 删除模板
adminApp.post('/_admin/template/delete', (req, res) => {
  const { id } = req.body;
  const templates = getTemplates().filter(t => t.id !== id);
  saveTemplates(templates);
  res.json({ success: true, data: templates });
});

const server = adminApp.listen(ADMIN_PORT, '0.0.0.0', () => {
  console.log(`Admin running: http://${LOCAL_IP}:${ADMIN_PORT}`);
});
server.on('error', (e) => console.error(e));