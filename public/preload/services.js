const fs = require('node:fs')
const path = require('node:path')
const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser')

// --- 工具函数 ---
window.services = {
  readFile(file) { return fs.readFileSync(file, { encoding: 'utf-8' }) },
  writeTextFile(text) {
    const filePath = path.join(window.utools.getPath('downloads'), Date.now() + '.txt')
    fs.writeFileSync(filePath, text, { encoding: 'utf-8' })
    return filePath
  },
  writeImageFile(base64Url) { /* ...保持原样... */ },
  getServerUrl() { return 'http://localhost:3000' }
}

// --- Express Server ---
const app = express();
const PORT = 3000;
const DB_KEY = 'mock_rules_v1';

app.use(cors());
app.use(bodyParser.json());

// 获取数据（包含自动迁移逻辑）
function getGroups() {
  const doc = utools.db.get(DB_KEY);
  let data = doc ? doc.data : [];

  // 【自动迁移】如果发现数据是旧的扁平数组（第一项有 url 字段），则包裹进默认分组
  if (Array.isArray(data) && data.length > 0 && data[0].url) {
    data = [{
      id: Date.now(),
      name: '默认分组',
      children: data
    }];
    // 顺便保存一下新结构
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

// API: 获取分组列表
app.get('/_admin/rules', (req, res) => {
  res.json(getGroups());
});

// API: 保存分组列表
app.post('/_admin/rules', (req, res) => {
  saveGroups(req.body);
  res.json({ success: true });
});

// 核心拦截器
app.use(async (req, res, next) => {
  const method = req.method;
  const url = req.path;

  if (url.startsWith('/_admin')) return next();

  const groups = getGroups();
  let matchedRule = null;

  // 【核心修改】双层遍历查找匹配规则
  // 1. 遍历分组
  for (const group of groups) {
    if (!group.children) continue;
    // 2. 遍历分组下的接口
    const found = group.children.find(r =>
        r.active && r.method === method && r.url === url
    );
    if (found) {
      matchedRule = found;
      break; // 找到了就停止
    }
  }

  if (matchedRule) {
    console.log(`[Mock] Hit: ${method} ${url}`);
    if (matchedRule.delay > 0) {
      await new Promise(resolve => setTimeout(resolve, matchedRule.delay));
    }
    try {
      res.status(200).json(JSON.parse(matchedRule.response));
    } catch (e) {
      res.status(200).send(matchedRule.response);
    }
  } else {
    res.status(404).json({ error: 'Mock route not found' });
  }
});

const server = app.listen(PORT, () => {
  console.log(`Mock Server running on ${PORT}`);
});
server.on('error', (e) => console.error(e));