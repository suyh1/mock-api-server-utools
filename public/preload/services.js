const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser')
const net = require('net')

// --- 工具函数：获取本机 IP ---
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

const LOCAL_IP = getLocalIP();
const ADMIN_PORT = 3000;
const DB_KEY = 'mock_rules_v1';

// --- 1. Window Services ---
window.services = {
  readFile(file) { return fs.readFileSync(file, { encoding: 'utf-8' }) },
  writeTextFile(text) {
    const filePath = path.join(window.utools.getPath('downloads'), Date.now() + '.txt')
    fs.writeFileSync(filePath, text, { encoding: 'utf-8' })
    return filePath
  },
  writeImageFile(base64Url) {
    const matchs = /^data:image\/([a-z]{1,20});base64,/i.exec(base64Url)
    if (!matchs) return
    const filePath = path.join(window.utools.getPath('downloads'), Date.now().toString() + '.' + matchs[1])
    fs.writeFileSync(filePath, base64Url.substring(matchs[0].length), { encoding: 'base64' })
    return filePath
  },
  getServerUrl() { return `http://${LOCAL_IP}:${ADMIN_PORT}` },
  getLocalIP() { return LOCAL_IP }
}

// --- 2. 数据库操作 ---
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

// --- 3. 动态服务管理器 ---
// Map Key 统一使用 String 类型以防万一
const runningServices = new Map();

function startGroupServer(rawGroupId, port, prefix) {
  return new Promise((resolve, reject) => {
    const groupId = String(rawGroupId); // 【修复】强制转为字符串作为 Map Key

    if (runningServices.has(groupId)) {
      const existing = runningServices.get(groupId);
      // 如果端口没变，直接返回成功
      if (existing.port === port) {
        // 更新前缀信息
        existing.prefix = prefix;
        return resolve({ success: true, ip: LOCAL_IP, msg: 'Service already running' });
      }
      // 端口变了，关闭旧服务
      existing.server.close();
      runningServices.delete(groupId);
    }

    const groupApp = express();
    groupApp.use(cors());
    groupApp.use(bodyParser.json());
    groupApp.use(bodyParser.urlencoded({ extended: true }));
    groupApp.use(bodyParser.text({ type: ['text/*', 'application/xml'] }));

    // 【新增】根路由健康检查
    groupApp.get('/', (req, res) => {
      res.send(`Mock Service for Group ${groupId} is running on port ${port}`);
    });

    // 拦截逻辑
    groupApp.use(async (req, res) => {
      const method = req.method;
      let url = req.path;

      // 排除根路由（已被上面处理，但为了保险）
      if (url === '/') return;

      if (prefix) {
        if (!url.startsWith(prefix)) {
          return res.status(404).json({ error: `Path must start with prefix: ${prefix}` });
        }
        url = url.slice(prefix.length);
        if (!url.startsWith('/')) url = '/' + url;
      }

      const groups = getGroups();
      // 【修复】比较时强制转为字符串
      const targetGroup = groups.find(g => String(g.id) === groupId);

      if (!targetGroup) return res.status(404).json({ error: 'Group not found in DB' });

      const matchedRule = targetGroup.children.find(r =>
          r.active && r.method === method && r.url === url
      );

      if (matchedRule) {
        console.log(`[Group ${groupId}] Hit: ${method} ${url}`);

        // 入参校验
        const missingErrors = [];
        if (matchedRule.headers?.length) {
          matchedRule.headers.forEach(h => {
            if (h.required && h.key && !req.headers[h.key.toLowerCase()]) {
              missingErrors.push(`Missing header: ${h.key}`);
            }
          });
        }
        if (matchedRule.params?.length) {
          matchedRule.params.forEach(p => {
            if (p.required && p.key && !req.query[p.key]) {
              missingErrors.push(`Missing query param: ${p.key}`);
            }
          });
        }
        if (missingErrors.length > 0) {
          return res.status(400).json({ error: 'Validation failed', details: missingErrors });
        }

        if (matchedRule.delay > 0) {
          await new Promise(resolve => setTimeout(resolve, matchedRule.delay));
        }

        if (matchedRule.responseHeaders?.length) {
          matchedRule.responseHeaders.forEach(h => {
            if (h.key && h.value) res.setHeader(h.key, h.value);
          });
        }

        try {
          res.status(200).json(JSON.parse(matchedRule.response));
        } catch (e) {
          res.status(200).send(matchedRule.response);
        }
      } else {
        res.status(404).json({ error: `No mock rule matched for ${method} ${url}` });
      }
    });

    const server = groupApp.listen(port, '0.0.0.0', () => {
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
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    server.listen(port, '0.0.0.0');
  });
}

// --- 4. Admin Server ---
const app = express();
app.use(cors());
app.use(bodyParser.json());

app.get('/_admin/rules', (req, res) => res.json(getGroups()));
app.post('/_admin/rules', (req, res) => {
  saveGroups(req.body);
  res.json({ success: true });
});

app.post('/_admin/service/start', async (req, res) => {
  const { groupId, port, prefix } = req.body;
  try {
    const result = await startGroupServer(groupId, parseInt(port), prefix || '');
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/_admin/service/stop', (req, res) => {
  stopGroupServer(req.body.groupId);
  res.json({ success: true });
});

app.post('/_admin/service/check', async (req, res) => {
  const available = await checkPort(parseInt(req.body.port));
  res.json({ available });
});

app.get('/_admin/service/status', (req, res) => {
  const status = {};
  for (const [gid, info] of runningServices) {
    status[gid] = { running: true, port: info.port, prefix: info.prefix };
  }
  res.json(status);
});

const server = app.listen(ADMIN_PORT, '0.0.0.0', () => {
  console.log(`Admin running: http://${LOCAL_IP}:${ADMIN_PORT}`);
});
server.on('error', (e) => console.error(e));