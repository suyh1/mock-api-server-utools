<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import CodeEditor from '../CodeEditor.vue';
import { copyText } from './tools-utils';
import type { MockGroup, MockRule } from '@/types/mock';

defineProps<{
  activeTool: string;
  isDark: boolean;
}>();

/* ==================== JWT 解析工具 ==================== */

const jwtInput = ref('');
const jwtHeader = ref('');
const jwtPayload = ref('');
const jwtExpInfo = ref('');
const jwtError = ref('');

function decodeJwt() {
  jwtHeader.value = ''; jwtPayload.value = ''; jwtExpInfo.value = ''; jwtError.value = '';
  try {
    const parts = jwtInput.value.trim().split('.');
    if (parts.length < 2) { jwtError.value = '无效的 JWT 格式（至少需要 2 段）'; return; }
    const decodeB64Url = (s: string) => {
      let b64 = s.replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4) b64 += '=';
      return decodeURIComponent(escape(atob(b64)));
    };
    const header = JSON.parse(decodeB64Url(parts[0]));
    jwtHeader.value = JSON.stringify(header, null, 2);
    const payload = JSON.parse(decodeB64Url(parts[1]));
    jwtPayload.value = JSON.stringify(payload, null, 2);
    if (payload.exp) {
      const expDate = new Date(payload.exp * 1000);
      const expired = expDate.getTime() < Date.now();
      jwtExpInfo.value = `过期时间：${expDate.toLocaleString('zh-CN', { hour12: false })}（${expired ? '已过期' : '未过期'}）`;
    }
  } catch (e: any) { jwtError.value = '解码失败：' + e.message; }
}

/* ==================== HTTP 状态码速查工具 ==================== */

const httpCodeSearch = ref('');

const httpCodes: { code: number; text: string; desc: string; category: string }[] = [
  // 1xx 信息
  { code: 100, text: 'Continue', desc: '服务器已收到请求头，客户端应继续发送请求体', category: '1xx 信息' },
  { code: 101, text: 'Switching Protocols', desc: '服务器同意切换协议（如升级到 WebSocket）', category: '1xx 信息' },
  { code: 102, text: 'Processing', desc: '服务器正在处理请求，尚无响应（WebDAV）', category: '1xx 信息' },
  // 2xx 成功
  { code: 200, text: 'OK', desc: '请求成功，返回所请求的数据', category: '2xx 成功' },
  { code: 201, text: 'Created', desc: '请求成功，已创建新资源', category: '2xx 成功' },
  { code: 202, text: 'Accepted', desc: '请求已接受，但尚未处理完成', category: '2xx 成功' },
  { code: 203, text: 'Non-Authoritative Information', desc: '请求成功，但返回的信息来自第三方', category: '2xx 成功' },
  { code: 204, text: 'No Content', desc: '请求成功，但无返回内容', category: '2xx 成功' },
  { code: 205, text: 'Reset Content', desc: '请求成功，要求客户端重置文档视图', category: '2xx 成功' },
  { code: 206, text: 'Partial Content', desc: '服务器成功返回部分内容（Range 请求）', category: '2xx 成功' },
  { code: 207, text: 'Multi-Status', desc: '多状态响应（WebDAV）', category: '2xx 成功' },
  // 3xx 重定向
  { code: 300, text: 'Multiple Choices', desc: '请求的资源有多种选择', category: '3xx 重定向' },
  { code: 301, text: 'Moved Permanently', desc: '资源已永久移动到新 URL', category: '3xx 重定向' },
  { code: 302, text: 'Found', desc: '资源临时移动到新 URL（临时重定向）', category: '3xx 重定向' },
  { code: 303, text: 'See Other', desc: '使用 GET 请求另一个 URL 获取资源', category: '3xx 重定向' },
  { code: 304, text: 'Not Modified', desc: '资源未修改，使用缓存版本', category: '3xx 重定向' },
  { code: 307, text: 'Temporary Redirect', desc: '临时重定向，保持原请求方法', category: '3xx 重定向' },
  { code: 308, text: 'Permanent Redirect', desc: '永久重定向，保持原请求方法', category: '3xx 重定向' },
  // 4xx 客户端错误
  { code: 400, text: 'Bad Request', desc: '请求语法错误，服务器无法理解', category: '4xx 客户端错误' },
  { code: 401, text: 'Unauthorized', desc: '未认证，需要登录凭证', category: '4xx 客户端错误' },
  { code: 402, text: 'Payment Required', desc: '需要付费（保留状态码）', category: '4xx 客户端错误' },
  { code: 403, text: 'Forbidden', desc: '已认证但无权限访问该资源', category: '4xx 客户端错误' },
  { code: 404, text: 'Not Found', desc: '请求的资源不存在', category: '4xx 客户端错误' },
  { code: 405, text: 'Method Not Allowed', desc: '请求方法不被允许', category: '4xx 客户端错误' },
  { code: 406, text: 'Not Acceptable', desc: '服务器无法返回客户端可接受的内容格式', category: '4xx 客户端错误' },
  { code: 407, text: 'Proxy Authentication Required', desc: '需要通过代理认证', category: '4xx 客户端错误' },
  { code: 408, text: 'Request Timeout', desc: '请求超时', category: '4xx 客户端错误' },
  { code: 409, text: 'Conflict', desc: '请求与服务器当前状态冲突', category: '4xx 客户端错误' },
  { code: 410, text: 'Gone', desc: '资源已永久删除', category: '4xx 客户端错误' },
  { code: 411, text: 'Length Required', desc: '缺少 Content-Length 头', category: '4xx 客户端错误' },
  { code: 412, text: 'Precondition Failed', desc: '请求头中的前置条件不满足', category: '4xx 客户端错误' },
  { code: 413, text: 'Payload Too Large', desc: '请求体过大', category: '4xx 客户端错误' },
  { code: 414, text: 'URI Too Long', desc: '请求 URI 过长', category: '4xx 客户端错误' },
  { code: 415, text: 'Unsupported Media Type', desc: '不支持的媒体类型', category: '4xx 客户端错误' },
  { code: 416, text: 'Range Not Satisfiable', desc: '请求的 Range 无法满足', category: '4xx 客户端错误' },
  { code: 418, text: "I'm a Teapot", desc: '我是茶壶，无法煮咖啡（彩蛋状态码 RFC 2324）', category: '4xx 客户端错误' },
  { code: 422, text: 'Unprocessable Entity', desc: '请求格式正确但语义错误（WebDAV）', category: '4xx 客户端错误' },
  { code: 429, text: 'Too Many Requests', desc: '请求频率过高，触发限流', category: '4xx 客户端错误' },
  { code: 431, text: 'Request Header Fields Too Large', desc: '请求头字段过大', category: '4xx 客户端错误' },
  { code: 451, text: 'Unavailable For Legal Reasons', desc: '因法律原因不可用', category: '4xx 客户端错误' },
  // 5xx 服务器错误
  { code: 500, text: 'Internal Server Error', desc: '服务器内部错误', category: '5xx 服务器错误' },
  { code: 501, text: 'Not Implemented', desc: '服务器不支持该请求功能', category: '5xx 服务器错误' },
  { code: 502, text: 'Bad Gateway', desc: '网关/代理收到上游服务器无效响应', category: '5xx 服务器错误' },
  { code: 503, text: 'Service Unavailable', desc: '服务暂时不可用（维护或过载）', category: '5xx 服务器错误' },
  { code: 504, text: 'Gateway Timeout', desc: '网关/代理等待上游服务器响应超时', category: '5xx 服务器错误' },
  { code: 505, text: 'HTTP Version Not Supported', desc: '不支持该 HTTP 协议版本', category: '5xx 服务器错误' },
  { code: 511, text: 'Network Authentication Required', desc: '需要网络认证（如 Wi-Fi 登录页）', category: '5xx 服务器错误' },
];

const httpCodeCategoryColors: Record<string, string> = {
  '1xx 信息': '#909399',
  '2xx 成功': '#67c23a',
  '3xx 重定向': '#e6a23c',
  '4xx 客户端错误': '#f56c6c',
  '5xx 服务器错误': '#f56c6c',
};

const filteredHttpCodes = computed(() => {
  const q = httpCodeSearch.value.trim().toLowerCase();
  if (!q) return httpCodes;
  return httpCodes.filter(c =>
    String(c.code).includes(q) || c.text.toLowerCase().includes(q) || c.desc.includes(q) || c.category.includes(q)
  );
});

const httpCodeGroups = computed(() => {
  const map = new Map<string, typeof httpCodes>();
  for (const c of filteredHttpCodes.value) {
    if (!map.has(c.category)) map.set(c.category, []);
    map.get(c.category)!.push(c);
  }
  return Array.from(map.entries());
});

/* ==================== cURL 解析工具 ==================== */

const curlInput = ref('');
const curlMethod = ref('GET');
const curlUrl = ref('');
const curlHeaders = ref<{ key: string; value: string }[]>([]);
const curlBody = ref('');
const curlContentType = ref('');
const curlOutput = ref('');
const curlOutputLang = ref('javascript');
const curlError = ref('');

function parseCurl() {
  curlError.value = '';
  curlMethod.value = 'GET';
  curlUrl.value = '';
  curlHeaders.value = [];
  curlBody.value = '';
  curlContentType.value = '';

  let input = curlInput.value.trim();
  if (!input) return;

  // 处理多行连接符
  input = input.replace(/\\\n\s*/g, ' ').replace(/\\\r\n\s*/g, ' ');

  if (!input.toLowerCase().startsWith('curl')) { curlError.value = '输入不是有效的 curl 命令'; return; }

  // 简单的 shell 参数解析
  const tokens = tokenizeCurl(input);
  let i = 1; // skip 'curl'
  const headers: { key: string; value: string }[] = [];
  let method = '';
  let url = '';
  let body = '';

  while (i < tokens.length) {
    const t = tokens[i];
    if (t === '-X' || t === '--request') {
      method = tokens[++i]?.toUpperCase() || '';
    } else if (t === '-H' || t === '--header') {
      const h = tokens[++i] || '';
      const colonIdx = h.indexOf(':');
      if (colonIdx > 0) headers.push({ key: h.slice(0, colonIdx).trim(), value: h.slice(colonIdx + 1).trim() });
    } else if (t === '-d' || t === '--data' || t === '--data-raw' || t === '--data-binary') {
      body = tokens[++i] || '';
      if (!method) method = 'POST';
    } else if (t === '-G' || t === '--get') {
      method = 'GET';
    } else if (t === '-I' || t === '--head') {
      method = 'HEAD';
    } else if (t === '-u' || t === '--user') {
      const auth = tokens[++i] || '';
      headers.push({ key: 'Authorization', value: 'Basic ' + btoa(auth) });
    } else if (t === '-A' || t === '--user-agent') {
      headers.push({ key: 'User-Agent', value: tokens[++i] || '' });
    } else if (t === '-e' || t === '--referer') {
      headers.push({ key: 'Referer', value: tokens[++i] || '' });
    } else if (t === '-b' || t === '--cookie') {
      headers.push({ key: 'Cookie', value: tokens[++i] || '' });
    } else if (t === '--compressed' || t === '-k' || t === '--insecure' || t === '-s' || t === '--silent' || t === '-v' || t === '--verbose' || t === '-L' || t === '--location') {
      // 忽略这些标志
    } else if (!t.startsWith('-') && !url) {
      url = t;
    }
    i++;
  }

  curlMethod.value = method || 'GET';
  curlUrl.value = url;
  curlHeaders.value = headers;
  curlBody.value = body;
  const ct = headers.find(h => h.key.toLowerCase() === 'content-type');
  curlContentType.value = ct?.value || '';

  generateCurlCode();
}

function tokenizeCurl(input: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < input.length) {
    while (i < input.length && /\s/.test(input[i])) i++;
    if (i >= input.length) break;

    if (input[i] === "'" || input[i] === '"') {
      const quote = input[i++];
      let token = '';
      while (i < input.length && input[i] !== quote) {
        if (input[i] === '\\' && quote === '"') { i++; token += input[i] || ''; }
        else token += input[i];
        i++;
      }
      i++; // skip closing quote
      tokens.push(token);
    } else if (input[i] === '$' && input[i + 1] === "'") {
      // $'...' ANSI-C quoting
      i += 2;
      let token = '';
      while (i < input.length && input[i] !== "'") { token += input[i++]; }
      i++;
      tokens.push(token);
    } else {
      let token = '';
      while (i < input.length && !/\s/.test(input[i])) {
        if (input[i] === '\\') { i++; token += input[i] || ''; }
        else token += input[i];
        i++;
      }
      tokens.push(token);
    }
  }
  return tokens;
}

function generateCurlCode() {
  const method = curlMethod.value;
  const url = curlUrl.value;
  const headers = curlHeaders.value;
  const body = curlBody.value;

  switch (curlOutputLang.value) {
    case 'javascript': {
      let code = `const response = await fetch('${url}'`;
      const opts: string[] = [];
      if (method !== 'GET') opts.push(`  method: '${method}'`);
      if (headers.length) {
        const hStr = headers.map(h => `    '${h.key}': '${h.value}'`).join(',\n');
        opts.push(`  headers: {\n${hStr}\n  }`);
      }
      if (body) {
        try { JSON.parse(body); opts.push(`  body: JSON.stringify(${body})`); }
        catch { opts.push(`  body: '${body.replace(/'/g, "\\'")}'`); }
      }
      if (opts.length) code += `, {\n${opts.join(',\n')}\n}`;
      code += ');\nconst data = await response.json();';
      curlOutput.value = code;
      break;
    }
    case 'python': {
      let code = 'import requests\n\n';
      const hasHeaders = headers.length > 0;
      const hasBody = !!body;
      if (hasHeaders) code += `headers = {\n${headers.map(h => `    '${h.key}': '${h.value}'`).join(',\n')}\n}\n\n`;
      if (hasBody) {
        try { JSON.parse(body); code += `data = ${body}\n\n`; }
        catch { code += `data = '${body}'\n\n`; }
      }
      code += `response = requests.${method.toLowerCase()}('${url}'`;
      if (hasHeaders) code += ', headers=headers';
      if (hasBody) code += ', json=data';
      code += ')\nprint(response.json())';
      curlOutput.value = code;
      break;
    }
    case 'go': {
      let code = 'package main\n\nimport (\n\t"fmt"\n\t"net/http"\n\t"io"\n';
      if (body) code += '\t"strings"\n';
      code += ')\n\nfunc main() {\n';
      if (body) code += `\tbody := strings.NewReader(\`${body}\`)\n`;
      code += `\treq, _ := http.NewRequest("${method}", "${url}", ${body ? 'body' : 'nil'})\n`;
      for (const h of headers) code += `\treq.Header.Set("${h.key}", "${h.value}")\n`;
      code += '\tresp, _ := http.DefaultClient.Do(req)\n\tdefer resp.Body.Close()\n\tdata, _ := io.ReadAll(resp.Body)\n\tfmt.Println(string(data))\n}';
      curlOutput.value = code;
      break;
    }
    case 'php': {
      let code = '<?php\n$ch = curl_init();\n';
      code += `curl_setopt($ch, CURLOPT_URL, '${url}');\n`;
      code += `curl_setopt($ch, CURLOPT_CUSTOMREQUEST, '${method}');\n`;
      code += 'curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);\n';
      if (headers.length) {
        code += 'curl_setopt($ch, CURLOPT_HTTPHEADER, [\n';
        for (const h of headers) code += `    '${h.key}: ${h.value}',\n`;
        code += ']);\n';
      }
      if (body) code += `curl_setopt($ch, CURLOPT_POSTFIELDS, '${body.replace(/'/g, "\\'")}');\n`;
      code += '$response = curl_exec($ch);\ncurl_close($ch);\necho $response;\n';
      curlOutput.value = code;
      break;
    }
    case 'java': {
      let code = 'HttpRequest request = HttpRequest.newBuilder()\n';
      code += `    .uri(URI.create("${url}"))\n`;
      if (method !== 'GET') {
        code += body ? `    .method("${method}", HttpRequest.BodyPublishers.ofString("${body.replace(/"/g, '\\"')}"))\n` : `    .method("${method}", HttpRequest.BodyPublishers.noBody())\n`;
      }
      for (const h of headers) code += `    .header("${h.key}", "${h.value}")\n`;
      code += '    .build();\n\n';
      code += 'HttpResponse<String> response = HttpClient.newHttpClient()\n    .send(request, HttpResponse.BodyHandlers.ofString());\nSystem.out.println(response.body());';
      curlOutput.value = code;
      break;
    }
    default: curlOutput.value = '';
  }
}

function buildCurl(): string {
  let cmd = 'curl';
  if (curlMethod.value !== 'GET') cmd += ` -X ${curlMethod.value}`;
  cmd += ` '${curlUrl.value}'`;
  for (const h of curlHeaders.value) cmd += ` \\\n  -H '${h.key}: ${h.value}'`;
  if (curlBody.value) cmd += ` \\\n  -d '${curlBody.value}'`;
  return cmd;
}

/* ==================== 代码生成工具 ==================== */

const codegenApiBase = ref('http://localhost:3000');
const codegenGroups = ref<MockGroup[]>([]);
const codegenSelectedRule = ref<number[]>([]);
const codegenLang = ref('fetch');
const codegenOutput = ref('');
const codegenLoading = ref(false);

const codegenCascaderOptions = computed(() => {
  return codegenGroups.value.map(g => ({
    value: g.id,
    label: g.name,
    children: g.children.map(r => ({
      value: r.id,
      label: `${r.method} ${r.name || r.url}`,
    })),
  }));
});

const codegenSelectedRuleData = computed<MockRule | null>(() => {
  if (codegenSelectedRule.value.length !== 2) return null;
  const [groupId, ruleId] = codegenSelectedRule.value;
  const group = codegenGroups.value.find(g => g.id === groupId);
  return group?.children.find(r => r.id === ruleId) || null;
});

async function loadCodegenData() {
  codegenLoading.value = true;
  try {
    const res = await fetch(`${codegenApiBase.value}/_admin/rules`);
    codegenGroups.value = await res.json();
  } catch {}
  codegenLoading.value = false;
}

function generateCode() {
  const rule = codegenSelectedRuleData.value;
  if (!rule) { codegenOutput.value = '// 请先选择一个接口'; return; }
  const method = rule.method;
  const url = rule.url;
  const headers = rule.headers?.filter(h => h.key) || [];
  const params = rule.params?.filter(p => p.key) || [];
  const body = rule.body;

  let fullUrl = url;
  if (params.length) {
    const qs = params.map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value || '')}`).join('&');
    fullUrl += (url.includes('?') ? '&' : '?') + qs;
  }

  switch (codegenLang.value) {
    case 'fetch': codegenOutput.value = genFetchCode(method, fullUrl, headers, body); break;
    case 'axios': codegenOutput.value = genAxiosCode(method, fullUrl, headers, body); break;
    case 'python': codegenOutput.value = genPythonCode(method, fullUrl, headers, body); break;
    case 'curl': codegenOutput.value = genCurlCmd(method, fullUrl, headers, body); break;
    case 'okhttp': codegenOutput.value = genOkHttpCode(method, fullUrl, headers, body); break;
    case 'go': codegenOutput.value = genGoCode(method, fullUrl, headers, body); break;
    default: codegenOutput.value = '';
  }
}

function getBodyStr(body?: { type: string; raw: string; formData?: { key: string; value: string }[] }): string {
  if (!body || body.type === 'none') return '';
  if (body.type === 'json' && body.raw) return body.raw;
  if ((body.type === 'form-data' || body.type === 'x-www-form-urlencoded') && body.formData?.length) {
    return body.formData.filter(f => f.key).map(f => `${f.key}=${f.value || ''}`).join('&');
  }
  return body.raw || '';
}

function isJsonBody(body?: { type: string }): boolean {
  return body?.type === 'json';
}

type CodegenHeader = { key: string; value: string };
type CodegenBody = { type: string; raw: string; formData?: { key: string; value: string }[] } | undefined;

function genFetchCode(method: string, url: string, headers: CodegenHeader[], body: CodegenBody): string {
  let code = `const response = await fetch('${url}'`;
  const opts: string[] = [];
  if (method !== 'GET') opts.push(`  method: '${method}'`);
  if (headers.length) {
    const hStr = headers.map(h => `    '${h.key}': '${h.value}'`).join(',\n');
    opts.push(`  headers: {\n${hStr}\n  }`);
  }
  const bs = getBodyStr(body);
  if (bs && method !== 'GET') {
    if (isJsonBody(body)) opts.push(`  body: JSON.stringify(${bs})`);
    else opts.push(`  body: '${bs.replace(/'/g, "\\'")}'`);
  }
  if (opts.length) code += `, {\n${opts.join(',\n')}\n}`;
  code += ');\nconst data = await response.json();\nconsole.log(data);';
  return code;
}

function genAxiosCode(method: string, url: string, headers: CodegenHeader[], body: CodegenBody): string {
  let code = `import axios from 'axios';\n\n`;
  const hasHeaders = headers.length > 0;
  const bs = getBodyStr(body);
  const hasBody = !!bs && method !== 'GET';
  if (hasHeaders) code += `const headers = {\n${headers.map(h => `  '${h.key}': '${h.value}'`).join(',\n')}\n};\n\n`;
  if (hasBody) {
    if (isJsonBody(body)) code += `const data = ${bs};\n\n`;
    else code += `const data = '${bs}';\n\n`;
  }
  code += `const response = await axios.${method.toLowerCase()}('${url}'`;
  if (hasBody) code += ', data';
  else if (hasHeaders) code += ', null';
  if (hasHeaders) code += `, { headers }`;
  else if (!hasBody && !hasHeaders) { /* no extra args */ }
  code += ');\nconsole.log(response.data);';
  return code;
}

function genPythonCode(method: string, url: string, headers: CodegenHeader[], body: CodegenBody): string {
  let code = 'import requests\n\n';
  const hasHeaders = headers.length > 0;
  const bs = getBodyStr(body);
  const hasBody = !!bs && method !== 'GET';
  if (hasHeaders) code += `headers = {\n${headers.map(h => `    '${h.key}': '${h.value}'`).join(',\n')}\n}\n\n`;
  if (hasBody) {
    if (isJsonBody(body)) { try { JSON.parse(bs); code += `data = ${bs}\n\n`; } catch { code += `data = '${bs}'\n\n`; } }
    else code += `data = '${bs}'\n\n`;
  }
  code += `response = requests.${method.toLowerCase()}('${url}'`;
  if (hasHeaders) code += ', headers=headers';
  if (hasBody) code += isJsonBody(body) ? ', json=data' : ', data=data';
  code += ')\nprint(response.json())';
  return code;
}

function genCurlCmd(method: string, url: string, headers: CodegenHeader[], body: CodegenBody): string {
  let cmd = 'curl';
  if (method !== 'GET') cmd += ` -X ${method}`;
  cmd += ` '${url}'`;
  for (const h of headers) cmd += ` \\\n  -H '${h.key}: ${h.value}'`;
  const bs = getBodyStr(body);
  if (bs && method !== 'GET') cmd += ` \\\n  -d '${bs}'`;
  return cmd;
}

function genOkHttpCode(method: string, url: string, headers: CodegenHeader[], body: CodegenBody): string {
  let code = 'OkHttpClient client = new OkHttpClient();\n\n';
  const bs = getBodyStr(body);
  const hasBody = !!bs && method !== 'GET';
  if (hasBody) {
    const mediaType = isJsonBody(body) ? 'application/json' : 'application/x-www-form-urlencoded';
    code += `MediaType mediaType = MediaType.parse("${mediaType}");\n`;
    code += `RequestBody body = RequestBody.create(mediaType, "${bs.replace(/"/g, '\\"')}");\n\n`;
  }
  code += 'Request request = new Request.Builder()\n';
  code += `    .url("${url}")\n`;
  if (method === 'GET') code += '    .get()\n';
  else if (hasBody) code += `    .${method.toLowerCase()}(body)\n`;
  else code += `    .method("${method}", null)\n`;
  for (const h of headers) code += `    .addHeader("${h.key}", "${h.value}")\n`;
  code += '    .build();\n\n';
  code += 'Response response = client.newCall(request).execute();\nSystem.out.println(response.body().string());';
  return code;
}

function genGoCode(method: string, url: string, headers: CodegenHeader[], body: CodegenBody): string {
  const bs = getBodyStr(body);
  const hasBody = !!bs && method !== 'GET';
  let code = 'package main\n\nimport (\n\t"fmt"\n\t"net/http"\n\t"io"\n';
  if (hasBody) code += '\t"strings"\n';
  code += ')\n\nfunc main() {\n';
  if (hasBody) code += `\tbody := strings.NewReader(\`${bs}\`)\n`;
  code += `\treq, _ := http.NewRequest("${method}", "${url}", ${hasBody ? 'body' : 'nil'})\n`;
  for (const h of headers) code += `\treq.Header.Set("${h.key}", "${h.value}")\n`;
  code += '\tresp, _ := http.DefaultClient.Do(req)\n\tdefer resp.Body.Close()\n\tdata, _ := io.ReadAll(resp.Body)\n\tfmt.Println(string(data))\n}';
  return code;
}

onMounted(() => {
  if (window.services) {
    codegenApiBase.value = window.services.getServerUrl();
  }
  loadCodegenData();
});
</script>

<template>
  <div>
    <!-- JWT 解析 -->
    <template v-if="activeTool === 'jwt'">
      <div class="tool-col">
        <label>JWT Token</label>
        <el-input v-model="jwtInput" type="textarea" :rows="4" placeholder="粘贴 JWT Token..." />
      </div>
      <div class="tool-toolbar">
        <el-button type="primary" @click="decodeJwt">解码</el-button>
      </div>
      <div v-if="jwtError" class="tool-error">{{ jwtError }}</div>
      <div v-if="jwtExpInfo" class="tool-hint" style="margin-top: 12px;">{{ jwtExpInfo }}</div>
      <div v-if="jwtHeader || jwtPayload" class="tool-row" style="margin-top: 12px;">
        <div class="tool-col">
          <label>Header</label>
          <el-input v-model="jwtHeader" type="textarea" :rows="6" readonly />
        </div>
        <div class="tool-col">
          <label>Payload</label>
          <el-input v-model="jwtPayload" type="textarea" :rows="6" readonly />
        </div>
      </div>
      <div v-if="jwtHeader" class="tool-toolbar">
        <el-button @click="copyText(jwtHeader)">复制 Header</el-button>
        <el-button @click="copyText(jwtPayload)">复制 Payload</el-button>
      </div>
    </template>

    <!-- HTTP 状态码速查 -->
    <template v-if="activeTool === 'httpcode'">
      <div class="tool-col">
        <el-input v-model="httpCodeSearch" placeholder="搜索状态码、名称或描述..." clearable />
      </div>
      <div class="httpcode-list">
        <div v-for="[category, codes] in httpCodeGroups" :key="category" class="httpcode-category">
          <div class="httpcode-category-title" :style="{ color: httpCodeCategoryColors[category] }">
            {{ category }}
          </div>
          <div
            v-for="c in codes" :key="c.code"
            class="httpcode-item"
          >
            <span class="httpcode-code" :style="{ color: httpCodeCategoryColors[c.category] }">{{ c.code }}</span>
            <span class="httpcode-text">{{ c.text }}</span>
            <span class="httpcode-desc">{{ c.desc }}</span>
          </div>
        </div>
        <div v-if="!filteredHttpCodes.length" class="tool-hint" style="text-align: center; padding: 24px;">
          没有找到匹配的状态码
        </div>
      </div>
    </template>

    <!-- 代码生成 -->
    <template v-if="activeTool === 'codegen'">
      <div class="tool-row">
        <div class="tool-col" style="flex: 1;">
          <label>选择接口</label>
          <el-cascader
            v-model="codegenSelectedRule"
            :options="codegenCascaderOptions"
            placeholder="选择分组 / 接口"
            :props="{ expandTrigger: 'hover' }"
            clearable
            style="width: 100%"
            @change="generateCode"
          />
        </div>
      </div>
      <div class="tool-col" style="margin-top: 12px;">
        <label>目标语言</label>
        <el-radio-group v-model="codegenLang" size="small" @change="generateCode">
          <el-radio-button value="fetch">JS (fetch)</el-radio-button>
          <el-radio-button value="axios">JS (axios)</el-radio-button>
          <el-radio-button value="python">Python</el-radio-button>
          <el-radio-button value="curl">cURL</el-radio-button>
          <el-radio-button value="okhttp">Java (OkHttp)</el-radio-button>
          <el-radio-button value="go">Go</el-radio-button>
        </el-radio-group>
      </div>
      <div v-if="codegenOutput" class="editor-box" style="height: 300px; margin-top: 12px;">
        <CodeEditor v-model="codegenOutput" language="javascript" :isDark="isDark" :readonly="true" />
      </div>
      <div class="tool-toolbar" style="margin-top: 8px;">
        <el-button @click="copyText(codegenOutput)" :disabled="!codegenOutput">复制代码</el-button>
        <el-button @click="loadCodegenData" :loading="codegenLoading">刷新接口</el-button>
      </div>
    </template>

    <!-- cURL 解析 -->
    <template v-if="activeTool === 'curl'">
      <div class="tool-col">
        <label>输入 cURL 命令</label>
        <el-input v-model="curlInput" type="textarea" :rows="5" placeholder="粘贴 curl 命令..." />
      </div>
      <div class="tool-toolbar">
        <el-button type="primary" @click="parseCurl">解析 cURL</el-button>
      </div>
      <div v-if="curlError" class="tool-error">{{ curlError }}</div>
      <div v-if="curlUrl" class="curl-parsed">
        <div class="tool-row">
          <div class="tool-col" style="flex: 0 0 100px;">
            <label>Method</label>
            <el-input v-model="curlMethod" />
          </div>
          <div class="tool-col">
            <label>URL</label>
            <el-input v-model="curlUrl" />
          </div>
        </div>
        <div v-if="curlHeaders.length" class="tool-col" style="margin-top: 8px;">
          <label>Headers ({{ curlHeaders.length }})</label>
          <div v-for="(h, i) in curlHeaders" :key="i" class="curl-header-row">
            <code>{{ h.key }}: {{ h.value }}</code>
          </div>
        </div>
        <div v-if="curlBody" class="tool-col" style="margin-top: 8px;">
          <label>Body</label>
          <el-input v-model="curlBody" type="textarea" :rows="3" readonly />
        </div>
        <div class="tool-col" style="margin-top: 12px;">
          <label>生成代码</label>
          <el-radio-group v-model="curlOutputLang" size="small" @change="generateCurlCode">
            <el-radio-button value="javascript">JavaScript</el-radio-button>
            <el-radio-button value="python">Python</el-radio-button>
            <el-radio-button value="go">Go</el-radio-button>
            <el-radio-button value="php">PHP</el-radio-button>
            <el-radio-button value="java">Java</el-radio-button>
          </el-radio-group>
        </div>
        <div v-if="curlOutput" class="editor-box" style="height: 250px; margin-top: 8px;">
          <CodeEditor v-model="curlOutput" language="javascript" :isDark="isDark" :readonly="true" />
        </div>
        <div class="tool-toolbar" style="margin-top: 8px;">
          <el-button @click="copyText(curlOutput)" :disabled="!curlOutput">复制代码</el-button>
          <el-button @click="copyText(buildCurl())">重新生成 cURL</el-button>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
@import './tools-common.css';

/* ==================== HTTP 状态码速查 ==================== */

.httpcode-list {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-height: 500px;
  overflow-y: auto;
}
.httpcode-category-title {
  font-size: 13px;
  font-weight: 700;
  margin-bottom: 6px;
  padding-left: 4px;
}
.httpcode-item {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 8px 12px;
  background: var(--bg-hover);
  border-radius: 6px;
  margin-bottom: 4px;
  font-size: 13px;
}
.httpcode-code {
  font-family: 'Courier New', Courier, monospace;
  font-weight: 700;
  font-size: 14px;
  min-width: 36px;
}
.httpcode-text {
  font-weight: 600;
  color: var(--text-primary);
  min-width: 200px;
}
.httpcode-desc {
  color: var(--text-secondary);
  flex: 1;
}

/* ==================== cURL 解析 ==================== */

.curl-parsed { margin-top: 16px; }
.curl-header-row {
  padding: 4px 10px; background: var(--bg-hover); border-radius: 4px;
  margin-bottom: 4px; font-size: 12px;
}
.curl-header-row code { color: var(--text-primary); }
</style>
