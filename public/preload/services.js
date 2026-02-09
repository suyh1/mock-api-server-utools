const fs = require('node:fs')
const path = require('node:path')
const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser')
const net = require('net')

// --- 全局配置 ---
const ADMIN_PORT = 3000;
const DB_KEY = 'mock_rules_v1';

// --- 1. Window Services (保留原有的工具函数) ---
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
  getServerUrl() { return `http://localhost:${ADMIN_PORT}` }
}

// --- 2. 数据库操作 ---
function getGroups() {
  const doc = utools.db.get(DB_KEY);
  let data = doc ? doc.data : [];
  // 简单迁移：旧数据兼容
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
// 存储运行中的服务实例：Map<groupId, { server, port, prefix }>
const runningServices = new Map();

/**
 * 启动指定分组的 Mock 服务
 */
function startGroupServer(groupId, port, prefix) {
  return new Promise((resolve, reject) => {
    // 1. 检查是否已经运行
    if (runningServices.has(groupId)) {
      const existing = runningServices.get(groupId);
      if (existing.port === port) return resolve({ msg: 'Service already running' });
      // 如果端口变了，先关闭旧的
      existing.server.close();
      runningServices.delete(groupId);
    }

    // 2. 创建新的 Express App
    const groupApp = express();
    groupApp.use(cors());
    groupApp.use(bodyParser.json());

    // 3. 注册拦截逻辑
    groupApp.use(async (req, res) => {
      const method = req.method;
      // 处理前缀：如果配置了前缀，必须匹配前缀才处理
      // 例如 prefix=/api, req.url=/api/user -> 匹配 /user
      let url = req.path;
      if (prefix) {
        if (!url.startsWith(prefix)) {
          return res.status(404).json({ error: `Path must start with ${prefix}` });
        }
        url = url.slice(prefix.length); // 去掉前缀
        if (!url.startsWith('/')) url = '/' + url; // 确保是 / 开头
      }

      // 获取最新数据
      const groups = getGroups();
      const targetGroup = groups.find(g => g.id === groupId);

      if (!targetGroup) return res.status(404).json({ error: 'Group not found' });

      // 查找匹配规则
      const matchedRule = targetGroup.children.find(r =>
          r.active && r.method === method && r.url === url
      );

      if (matchedRule) {
        console.log(`[Group ${groupId}] Hit: ${method} ${url}`);
        if (matchedRule.delay > 0) {
          await new Promise(resolve => setTimeout(resolve, matchedRule.delay));
        }
        try {
          res.status(200).json(JSON.parse(matchedRule.response));
        } catch (e) {
          res.status(200).send(matchedRule.response);
        }
      } else {
        res.status(404).json({ error: 'Mock route not found in this group' });
      }
    });

    // 4. 启动监听
    const server = groupApp.listen(port, () => {
      console.log(`Group ${groupId} service started on port ${port} with prefix ${prefix}`);
      runningServices.set(groupId, { server, port, prefix });
      resolve({ success: true });
    });

    server.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * 关闭指定分组的服务
 */
function stopGroupServer(groupId) {
  if (runningServices.has(groupId)) {
    const { server } = runningServices.get(groupId);
    server.close();
    runningServices.delete(groupId);
    return true;
  }
  return false;
}

/**
 * 检测端口是否占用
 */
function checkPort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') resolve(false); // 被占用
      else resolve(false);
    });
    server.once('listening', () => {
      server.close();
      resolve(true); // 可用
    });
    server.listen(port);
  });
}


// --- 4. 主管理服务 (Admin Server) ---
const app = express();
app.use(cors());
app.use(bodyParser.json());

// 获取所有规则
app.get('/_admin/rules', (req, res) => {
  res.json(getGroups());
});

// 保存规则 (前端保存配置时也会调这个)
app.post('/_admin/rules', (req, res) => {
  saveGroups(req.body);
  res.json({ success: true });
});

// [新增] 启动服务接口
app.post('/_admin/service/start', async (req, res) => {
  const { groupId, port, prefix } = req.body;
  if (!groupId || !port) return res.status(400).json({ error: 'Missing params' });

  try {
    await startGroupServer(groupId, parseInt(port), prefix || '');
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// [新增] 关闭服务接口
app.post('/_admin/service/stop', (req, res) => {
  const { groupId } = req.body;
  stopGroupServer(groupId);
  res.json({ success: true });
});

// [新增] 端口检测接口
app.post('/_admin/service/check', async (req, res) => {
  const { port } = req.body;
  const isAvailable = await checkPort(parseInt(port));
  res.json({ available: isAvailable });
});

// [新增] 获取服务状态列表 (用于初始化前端状态)
app.get('/_admin/service/status', (req, res) => {
  const status = {};
  for (const [groupId, info] of runningServices) {
    status[groupId] = { running: true, port: info.port, prefix: info.prefix };
  }
  res.json(status);
});

// 启动管理服务
const server = app.listen(ADMIN_PORT, () => {
  console.log(`Admin Server running on ${ADMIN_PORT}`);
});
server.on('error', (e) => console.error(e));