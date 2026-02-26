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
/** Node.js HTTPS 模块，用于代理录制 HTTPS 请求 */
const https = require('https')
/** WebSocket 库 */
const WebSocket = require('ws')
/** Node.js URL 模块 */
const urlModule = require('url')

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
 * 规范化 URL 前缀：确保以 / 开头，去除末尾 /
 * @param {string} p - 前缀字符串
 * @returns {string} 规范化后的前缀，空值返回空字符串
 */
function normalizePrefix(p) {
  if (!p) return '';
  if (!p.startsWith('/')) p = '/' + p;
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  return p;
}

/**
 * 尝试从 URL 中剥离前缀，带边界检查
 * @param {string} url - 当前请求路径
 * @param {string} prefix - 原始前缀
 * @returns {{ ok: boolean, rest: string }} ok=true 时 rest 为剥离后的路径
 */
function stripPrefix(url, prefix) {
  const np = normalizePrefix(prefix);
  if (!np) return { ok: true, rest: url };
  if (url === np) return { ok: true, rest: '/' };
  if (url.startsWith(np + '/')) return { ok: true, rest: url.slice(np.length) };
  return { ok: false, rest: url };
}

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
/** uTools 数据库中存储测试用例的键名 */
const TESTCASES_DB_KEY = 'mock_testcases_v1';
/** uTools 数据库中存储测试套件的键名 */
const TESTSUITES_DB_KEY = 'mock_testsuites_v1';

/* ==================== 路径参数匹配工具 ==================== */

/**
 * 匹配路径参数模式（如 /users/:id/posts/:postId）
 * @param {string} pattern - 路径模式（含 :param 占位符）
 * @param {string} actual - 实际请求路径
 * @returns {{ matched: boolean, params: Object }} 匹配结果及提取的参数
 */
function matchPathPattern(pattern, actual) {
  if (!pattern || !actual) return { matched: false, params: {} };
  const patternParts = pattern.split('/').filter(Boolean);
  const actualParts = actual.split('/').filter(Boolean);
  if (patternParts.length !== actualParts.length) return { matched: false, params: {} };
  const params = {};
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(':')) {
      params[patternParts[i].slice(1)] = actualParts[i];
    } else if (patternParts[i] !== actualParts[i]) {
      return { matched: false, params: {} };
    }
  }
  return { matched: true, params };
}

/**
 * 判断 URL 模式中是否包含路径参数
 * @param {string} url - URL 模式
 * @returns {boolean}
 */
function hasPathParams(url) {
  return url && url.includes(':');
}

/* ==================== 条件响应（Mock 期望）匹配工具 ==================== */

/**
 * 从嵌套对象中按 JSON path 取值
 * @param {Object} obj - 目标对象
 * @param {string} path - 路径（如 data.user.name）
 * @returns {*} 取到的值
 */
function getByPath(obj, path) {
  if (!obj || !path) return undefined;
  return path.split('.').reduce((o, k) => (o != null ? o[k] : undefined), obj);
}

/**
 * 评估单个条件
 * @param {Object} condition - 期望条件 { source, key, operator, value }
 * @param {Object} req - Express 请求对象
 * @param {Object} pathParams - 路径参数
 * @returns {boolean}
 */
function evaluateCondition(condition, req, pathParams) {
  let actual;
  switch (condition.source) {
    case 'query':
      actual = req.query[condition.key];
      break;
    case 'header':
      actual = req.headers[condition.key.toLowerCase()];
      break;
    case 'body':
      actual = getByPath(req.body, condition.key);
      break;
    case 'pathParam':
      actual = pathParams[condition.key];
      break;
    default:
      return false;
  }

  const expected = condition.value;

  switch (condition.operator) {
    case 'equals':
      return String(actual) === String(expected);
    case 'contains':
      return actual != null && String(actual).includes(expected);
    case 'regex':
      try { return actual != null && new RegExp(expected).test(String(actual)); } catch { return false; }
    case 'exists':
      return actual !== undefined && actual !== null && actual !== '';
    case 'gt':
      return actual != null && Number(actual) > Number(expected);
    case 'lt':
      return actual != null && Number(actual) < Number(expected);
    default:
      return false;
  }
}

/**
 * 查找第一个匹配的期望
 * @param {Array} expectations - 期望列表
 * @param {Object} req - Express 请求对象
 * @param {Object} pathParams - 路径参数
 * @returns {Object|null} 匹配到的期望对象
 */
function findMatchingExpectation(expectations, req, pathParams) {
  if (!expectations || !expectations.length) return null;
  for (const exp of expectations) {
    if (!exp.conditions || !exp.conditions.length) continue;
    const allMatch = exp.conditions.every(c => evaluateCondition(c, req, pathParams || {}));
    if (allMatch) return exp;
  }
  return null;
}

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
 * @returns {Array} 分组规则数组
 */
function getGroups() {
  const doc = utools.db.get(DB_KEY);
  return doc ? doc.data : [];
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

/* ==================== Mock Services 数据管理（新架构） ==================== */

/** uTools 数据库中存储 MockService 的键名 */
const DB_SERVICES_KEY = 'mock_services_v1';

/**
 * 从 uTools 数据库读取所有 MockService
 * @returns {Array} 服务数组
 */
function getMockServices() {
  const doc = utools.db.get(DB_SERVICES_KEY);
  return doc ? doc.data : [];
}

/**
 * 将 MockService 数据保存到 uTools 数据库
 * @param {Array} services - 服务数组
 */
function saveMockServices(services) {
  const doc = utools.db.get(DB_SERVICES_KEY);
  if (doc) {
    utools.db.put({ _id: DB_SERVICES_KEY, data: services, _rev: doc._rev });
  } else {
    utools.db.put({ _id: DB_SERVICES_KEY, data: services });
  }
}

/* ==================== 动态 Mock 服务管理器 ==================== */

/** 运行中的 Service 实例映射表（key 为 serviceId） */
const runningServiceServers = new Map();

/**
 * 启动指定 MockService 的 Mock 服务（新架构）
 * @description 一个 Express 实例服务该 service 下所有分组的规则。
 *              URL 匹配流程：剥离 servicePrefix → 遍历 groups 尝试剥离 subPrefix → 规则匹配
 * @param {string|number} rawServiceId - 服务 ID
 * @param {number} port - 监听端口号
 * @param {string} servicePrefix - 服务级 URL 前缀
 * @returns {Promise<{success: boolean, ip: string}>} 启动结果
 */
function startServiceServer(rawServiceId, port, servicePrefix) {
  return new Promise((resolve, reject) => {
    const serviceId = String(rawServiceId);

    if (runningServiceServers.has(serviceId)) {
      const existing = runningServiceServers.get(serviceId);
      if (existing.port === port) {
        existing.prefix = servicePrefix;
        return resolve({ success: true, ip: LOCAL_IP, msg: 'Service updated' });
      }
      existing.server.close();
      runningServiceServers.delete(serviceId);
    }

    const app = express();
    app.use(cors());
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: true }));
    app.use(bodyParser.text({ type: ['text/*', 'application/xml', 'application/javascript'] }));
    app.use(bodyParser.raw({ type: ['application/pdf', 'application/zip', 'application/octet-stream', 'video/*'] }));

    app.get('/', (req, res) => res.send(`Mock Service ${serviceId} running on port ${port}`));

    app.use(async (req, res) => {
      const method = req.method;
      let url = req.path;

      if (url === '/') return;

      // 1. 剥离 servicePrefix
      if (servicePrefix) {
        const result = stripPrefix(url, servicePrefix);
        if (!result.ok) return res.status(404).json({ error: `Service prefix mismatch: ${normalizePrefix(servicePrefix)}` });
        url = result.rest;
      }

      // 重新读取最新服务数据
      const services = getMockServices();
      const targetService = services.find(s => String(s.id) === serviceId);
      if (!targetService) return res.status(404).json({ error: 'Service not found' });

      // 2. 遍历 groups，尝试剥离 subPrefix，进行规则匹配
      let matchedRule = null;
      let pathParams = {};
      let matchedGroup = null;

      for (const group of (targetService.groups || [])) {
        let matchUrl = url;

        // 剥离 group.subPrefix
        if (group.subPrefix) {
          const result = stripPrefix(matchUrl, group.subPrefix);
          if (!result.ok) continue;
          matchUrl = result.rest;
        }

        // 第一遍：精确匹配
        const exactMatch = (group.children || []).find(r => {
          let ruleUrl = r.url;
          if (ruleUrl && !ruleUrl.startsWith('/')) ruleUrl = '/' + ruleUrl;
          return r.active && r.method === method && ruleUrl === matchUrl;
        });

        if (exactMatch) {
          matchedRule = exactMatch;
          matchedGroup = group;
          break;
        }

        // 第二遍：路径参数匹配
        for (const r of (group.children || [])) {
          if (!r.active || r.method !== method) continue;
          let ruleUrl = r.url;
          if (ruleUrl && !ruleUrl.startsWith('/')) ruleUrl = '/' + ruleUrl;
          if (!hasPathParams(ruleUrl)) continue;
          const result = matchPathPattern(ruleUrl, matchUrl);
          if (result.matched) {
            matchedRule = r;
            pathParams = result.params;
            matchedGroup = group;
            break;
          }
        }
        if (matchedRule) break;
      }

      if (matchedRule) {
        console.log(`[Service ${serviceId}] Hit: ${method} ${url}`, Object.keys(pathParams).length ? `params: ${JSON.stringify(pathParams)}` : '');

        req.params = { ...(req.params || {}), ...pathParams };

        // 入参校验
        const missing = [];
        matchedRule.headers?.forEach(h => {
          if (h.required && h.key && !req.headers[h.key.toLowerCase()]) missing.push(`Missing header: ${h.key}`);
        });
        matchedRule.params?.forEach(p => {
          if (p.required && p.key && !req.query[p.key]) missing.push(`Missing query: ${p.key}`);
        });
        if (missing.length > 0) return res.status(400).json({ error: 'Validation failed', details: missing });

        // 延迟
        const delayMin = matchedRule.delay || 0;
        const delayMax = matchedRule.delayMax || 0;
        let actualDelay = delayMin;
        if (delayMax > delayMin) {
          actualDelay = Math.floor(Math.random() * (delayMax - delayMin) + delayMin);
        }
        if (actualDelay > 0) await new Promise(r => setTimeout(r, actualDelay));

        // 设置自定义响应头
        matchedRule.responseHeaders?.forEach(h => {
          if (h.key && h.value) res.setHeader(h.key, h.value);
        });

        // 条件响应 / 预设覆盖
        let activeMode = matchedRule.responseMode || 'basic';
        let activeResponseType = matchedRule.responseType || 'application/json';
        let activeResponseBasic = matchedRule.responseBasic;
        let activeResponseAdvanced = matchedRule.responseAdvanced;
        let activeStatusCode = 200;
        let mockjsEnabled = matchedRule.mockjsEnabled || false;

        const matchedExpectation = findMatchingExpectation(matchedRule.expectations, req, pathParams);
        if (matchedExpectation) {
          activeMode = matchedExpectation.responseMode || 'basic';
          activeResponseType = matchedExpectation.responseType || 'application/json';
          activeResponseBasic = matchedExpectation.responseBasic;
          activeResponseAdvanced = matchedExpectation.responseAdvanced;
          activeStatusCode = matchedExpectation.statusCode || 200;
        } else if (matchedRule.activePresetId && matchedRule.responsePresets) {
          const preset = matchedRule.responsePresets.find(p => p.id === matchedRule.activePresetId);
          if (preset) {
            activeMode = preset.responseMode || 'basic';
            activeResponseType = preset.responseType || 'application/json';
            activeResponseBasic = preset.responseBasic;
            activeResponseAdvanced = preset.responseAdvanced;
            activeStatusCode = preset.statusCode || 200;
          }
        }

        // 生成响应
        try {
          if (activeMode === 'advanced' && activeResponseAdvanced) {
            const script = new vm.Script(activeResponseAdvanced);
            const sandbox = {
              req: { query: req.query, body: req.body, headers: req.headers, method: req.method, path: req.path, params: pathParams },
              Mock, console
            };
            const context = vm.createContext(sandbox);
            script.runInContext(context);
            if (typeof sandbox.main === 'function') {
              const responseData = await sandbox.main(sandbox.req, sandbox.Mock);
              res.status(activeStatusCode).json(responseData);
            } else {
              throw new Error('Main function not defined in script');
            }
          } else {
            const contentType = activeResponseType || 'application/json';
            res.setHeader('Content-Type', contentType);
            const binaryTypes = ['application/pdf', 'application/zip', 'application/octet-stream', 'video/mp4', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
            if (binaryTypes.some(t => contentType.includes(t))) {
              const filePath = matchedRule.responseFile;
              if (!filePath) return res.status(400).json({ error: 'No file configured for this binary response type' });
              if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Response file not found', path: filePath });
              const fileBuffer = fs.readFileSync(filePath);
              const fileName = path.basename(filePath);
              res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileName)}"`);
              res.status(activeStatusCode).send(fileBuffer);
            } else {
              let bodyStr = activeResponseBasic || '{}';
              if (mockjsEnabled && contentType.includes('json')) {
                try {
                  const parsed = JSON.parse(bodyStr);
                  bodyStr = JSON.stringify(Mock.mock(parsed));
                } catch (e) {
                  console.warn('[Mock.js] Failed to process basic response:', e.message);
                }
              }
              res.status(activeStatusCode).send(bodyStr);
            }
          }
        } catch (e) {
          console.error('Mock execution error:', e);
          res.status(500).json({ error: 'Mock execution failed', message: e.message });
        }

      } else {
        // 代理录制：从 service 级别读取代理配置
        if (targetService.proxyEnabled && targetService.proxyTarget) {
          try {
            const proxyTarget = targetService.proxyTarget.replace(/\/$/, '');
            const proxyUrl = proxyTarget + url;
            console.log(`[Service ${serviceId}] Proxy: ${method} ${proxyUrl}`);

            const parsed = new URL(proxyUrl);
            const httpModule = parsed.protocol === 'https:' ? https : http;
            const proxyHeaders = { ...req.headers };
            delete proxyHeaders.host;

            const proxyReq = httpModule.request({
              hostname: parsed.hostname,
              port: parsed.port,
              path: parsed.pathname + parsed.search,
              method: method,
              headers: proxyHeaders,
            }, (proxyRes) => {
              const chunks = [];
              proxyRes.on('data', chunk => chunks.push(chunk));
              proxyRes.on('end', () => {
                const body = Buffer.concat(chunks);
                const contentType = proxyRes.headers['content-type'] || 'application/json';
                res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
                res.end(body);

                // 自动录制到第一个分组
                const firstGroup = targetService.groups && targetService.groups[0];
                if (firstGroup) {
                  const recordedCount = firstGroup.children.filter(r => r.name && r.name.startsWith('[录制]')).length;
                  if (recordedCount < 50 && (contentType.includes('json') || contentType.includes('text'))) {
                    const now2 = Date.now();
                    firstGroup.children.push({
                      id: now2,
                      name: `[录制] ${method} ${url}`,
                      active: true, method, url,
                      delay: 0, createdAt: now2, updatedAt: now2,
                      headers: [], params: [],
                      body: { type: 'none', raw: '', formData: [] },
                      responseHeaders: [],
                      responseMode: 'basic',
                      responseType: contentType.split(';')[0].trim(),
                      responseBasic: body.toString('utf-8'),
                      responseAdvanced: '',
                    });
                    saveMockServices(services);
                    console.log(`[Service ${serviceId}] Recorded: ${method} ${url}`);
                  }
                }
              });
            });

            proxyReq.on('error', (e) => {
              console.error('[Proxy] Error:', e.message);
              res.status(502).json({ error: 'Proxy request failed', message: e.message });
            });

            if (req.body && method !== 'GET' && method !== 'HEAD') {
              const bodyStr = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
              proxyReq.write(bodyStr);
            }
            proxyReq.end();
          } catch (e) {
            res.status(502).json({ error: 'Proxy error', message: e.message });
          }
        } else {
          res.status(404).json({ error: `No rule matched ${method} ${url}` });
        }
      }
    });

    const server = app.listen(port, '0.0.0.0', () => {
      console.log(`Service ${serviceId} started: http://${LOCAL_IP}:${port}`);
      runningServiceServers.set(serviceId, { server, port, prefix: servicePrefix });
      resolve({ success: true, ip: LOCAL_IP });
    });
    server.on('error', (err) => reject(err));
  });
}

/**
 * 停止指定 MockService 的 Mock 服务（新架构）
 * @param {string|number} rawServiceId - 服务 ID
 * @returns {boolean} 是否成功停止
 */
function stopServiceServer(rawServiceId) {
  const serviceId = String(rawServiceId);
  if (runningServiceServers.has(serviceId)) {
    runningServiceServers.get(serviceId).server.close();
    runningServiceServers.delete(serviceId);
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

/* ==================== 环境变量数据管理 ==================== */

/** uTools 数据库中存储环境变量的键名 */
const DB_ENV_KEY = 'mock_environments_v1';

/**
 * 从 uTools 数据库读取所有环境
 * @returns {Array} 环境数组
 */
function getEnvironments() {
  const doc = utools.db.get(DB_ENV_KEY);
  return doc ? doc.data : [];
}

/**
 * 将环境数据保存到 uTools 数据库
 * @param {Array} environments - 环境数组
 */
function saveEnvironments(environments) {
  const doc = utools.db.get(DB_ENV_KEY);
  if (doc) {
    utools.db.put({ _id: DB_ENV_KEY, data: environments, _rev: doc._rev });
  } else {
    utools.db.put({ _id: DB_ENV_KEY, data: environments });
  }
}

/* ==================== 测试用例 CRUD ==================== */

function getTestCases() {
  const doc = utools.db.get(TESTCASES_DB_KEY);
  return doc ? doc.data : [];
}

function saveTestCases(testcases) {
  const doc = utools.db.get(TESTCASES_DB_KEY);
  if (doc) {
    utools.db.put({ _id: TESTCASES_DB_KEY, data: testcases, _rev: doc._rev });
  } else {
    utools.db.put({ _id: TESTCASES_DB_KEY, data: testcases });
  }
}

/* ==================== 测试套件 CRUD ==================== */

function getTestSuites() {
  const doc = utools.db.get(TESTSUITES_DB_KEY);
  return doc ? doc.data : [];
}

function saveTestSuites(suites) {
  const doc = utools.db.get(TESTSUITES_DB_KEY);
  if (doc) {
    utools.db.put({ _id: TESTSUITES_DB_KEY, data: suites, _rev: doc._rev });
  } else {
    utools.db.put({ _id: TESTSUITES_DB_KEY, data: suites });
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
/** POST /_admin/service/check - 检测端口是否可用 */
adminApp.post('/_admin/service/check', async (req, res) => { res.json({ available: await checkPort(parseInt(req.body.port)) }); });
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

/** GET /_admin/environments - 获取所有环境 */
adminApp.get('/_admin/environments', (req, res) => {
  res.json(getEnvironments());
});

/** POST /_admin/environment/save - 创建/更新环境 */
adminApp.post('/_admin/environment/save', (req, res) => {
  const env = req.body;
  if (!env.name) {
    return res.status(400).json({ error: 'Environment name is required' });
  }
  const environments = getEnvironments();
  const idx = environments.findIndex(e => e.id === env.id);
  if (idx !== -1) {
    environments[idx] = { ...environments[idx], ...env, id: environments[idx].id, updatedAt: Date.now() };
  } else {
    const now = Date.now();
    environments.push({ ...env, id: now, createdAt: now, updatedAt: now });
  }
  saveEnvironments(environments);
  res.json({ success: true, data: environments });
});

/** POST /_admin/environment/delete - 删除环境 */
adminApp.post('/_admin/environment/delete', (req, res) => {
  const { id } = req.body;
  const environments = getEnvironments().filter(e => e.id !== id);
  saveEnvironments(environments);
  res.json({ success: true, data: environments });
});

/* --- 测试用例 API --- */

/** GET /_admin/testcases - 获取所有测试用例 */
adminApp.get('/_admin/testcases', (req, res) => {
  res.json(getTestCases());
});

/** POST /_admin/testcases - 保存所有测试用例 */
adminApp.post('/_admin/testcases', (req, res) => {
  saveTestCases(req.body);
  res.json({ success: true });
});

/** POST /_admin/testcase/save - 创建/更新测试用例 */
adminApp.post('/_admin/testcase/save', (req, res) => {
  const tc = req.body;
  const testcases = getTestCases();
  const idx = testcases.findIndex(t => t.id === tc.id);
  if (idx !== -1) {
    testcases[idx] = { ...testcases[idx], ...tc, updatedAt: Date.now() };
  } else {
    const now = Date.now();
    testcases.push({ ...tc, id: now, createdAt: now, updatedAt: now });
  }
  saveTestCases(testcases);
  res.json({ success: true, data: testcases });
});

/** POST /_admin/testcase/delete - 删除测试用例 */
adminApp.post('/_admin/testcase/delete', (req, res) => {
  const { id } = req.body;
  const testcases = getTestCases().filter(t => t.id !== id);
  saveTestCases(testcases);
  res.json({ success: true, data: testcases });
});

/* --- 测试套件 API --- */

/** GET /_admin/testsuites - 获取所有测试套件 */
adminApp.get('/_admin/testsuites', (req, res) => {
  res.json(getTestSuites());
});

/** POST /_admin/testsuites - 保存所有测试套件 */
adminApp.post('/_admin/testsuites', (req, res) => {
  saveTestSuites(req.body);
  res.json({ success: true });
});

/** POST /_admin/testsuite/save - 创建/更新测试套件 */
adminApp.post('/_admin/testsuite/save', (req, res) => {
  const suite = req.body;
  const suites = getTestSuites();
  const idx = suites.findIndex(s => s.id === suite.id);
  if (idx !== -1) {
    suites[idx] = { ...suites[idx], ...suite, updatedAt: Date.now() };
  } else {
    const now = Date.now();
    suites.push({ ...suite, id: now, createdAt: now, updatedAt: now });
  }
  saveTestSuites(suites);
  res.json({ success: true, data: suites });
});

/** POST /_admin/testsuite/delete - 删除测试套件 */
adminApp.post('/_admin/testsuite/delete', (req, res) => {
  const { id } = req.body;
  const suites = getTestSuites().filter(s => s.id !== id);
  saveTestSuites(suites);
  res.json({ success: true, data: suites });
});

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

/* ==================== MockService Admin API（新架构） ==================== */

/** GET /_admin/services - 获取所有 MockService */
adminApp.get('/_admin/services', (req, res) => {
  res.json(getMockServices());
});

/** POST /_admin/services - 全量保存 MockService */
adminApp.post('/_admin/services', (req, res) => {
  saveMockServices(req.body);
  res.json({ success: true });
});

/** POST /_admin/service/save - 保存单个 MockService（有 ID 则更新，无 ID 则新增） */
adminApp.post('/_admin/service/save', (req, res) => {
  const service = req.body;
  if (!service.name) {
    return res.status(400).json({ error: 'Service name is required' });
  }
  const services = getMockServices();
  const idx = services.findIndex(s => s.id === service.id);
  if (idx !== -1) {
    services[idx] = { ...services[idx], ...service, id: services[idx].id, updatedAt: Date.now() };
  } else {
    const now = Date.now();
    services.push({ ...service, id: now, groups: service.groups || [], createdAt: now, updatedAt: now });
  }
  saveMockServices(services);
  res.json({ success: true, data: services });
});

/** POST /_admin/service/delete - 删除 MockService */
adminApp.post('/_admin/service/delete', (req, res) => {
  const { id } = req.body;
  stopServiceServer(id); // 自动停止运行中的服务
  const services = getMockServices().filter(s => s.id !== id);
  saveMockServices(services);
  res.json({ success: true, data: services });
});

/** POST /_admin/service/start - 启动 MockService 的服务 */
adminApp.post('/_admin/service/start', async (req, res) => {
  try {
    const { serviceId, port, prefix } = req.body;
    if (serviceId) {
      res.json(await startServiceServer(serviceId, parseInt(port), prefix || ''));
    } else {
      res.status(400).json({ error: 'serviceId is required' });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** POST /_admin/service/stop - 停止 MockService 的服务 */
adminApp.post('/_admin/service/stop', (req, res) => {
  const { serviceId } = req.body;
  if (serviceId) {
    stopServiceServer(serviceId);
  }
  res.json({ success: true });
});

/** GET /_admin/service/status - 获取所有运行中服务的状态 */
adminApp.get('/_admin/service/status', (req, res) => {
  const status = {};
  for (const [sid, info] of runningServiceServers) {
    status[sid] = { running: true, port: info.port, prefix: info.prefix, type: 'service' };
  }
  res.json(status);
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