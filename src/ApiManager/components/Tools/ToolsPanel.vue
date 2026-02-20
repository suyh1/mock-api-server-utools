<script setup lang="ts">
import { ref, computed, inject, onMounted } from 'vue';
import CodeEditor from '../CodeEditor.vue';
import type { MockGroup, Project } from '@/types/mock';

const isDark = inject('isDark', ref(false));
const activeTool = ref('json');

/* ==================== 工具分组配置 ==================== */

const toolGroups = [
  {
    category: '格式化',
    categoryEn: 'FORMAT',
    tools: [
      { key: 'json', label: 'JSON 格式化', icon: '{ }', desc: '格式化/压缩/校验/统计/转CSV' },
      { key: 'json2ts', label: 'JSON → TS', icon: 'TS', desc: '将 JSON 转换为 TypeScript Interface' },
      { key: 'jsonpath', label: 'JSON Path', icon: '$.', desc: '用 JSONPath 表达式查询 JSON 数据' },
      { key: 'jsondiff', label: 'JSON Diff', icon: '<>', desc: '深层对比两个 JSON 结构差异' },
    ],
  },
  {
    category: '编码转换',
    categoryEn: 'ENCODE',
    tools: [
      { key: 'url', label: 'URL 编解码', icon: '%', desc: 'URL 编码/解码/解析，拆分各部分' },
      { key: 'base64', label: 'Base64 编解码', icon: 'B64', desc: 'Base64 文本编解码 + 图片转 DataURL' },
      { key: 'htmlencode', label: 'HTML 实体', icon: '&;', desc: 'HTML 特殊字符实体编码与解码' },
      { key: 'encrypt', label: '加解密', icon: '🔐', desc: 'AES-CBC/AES-GCM 加密与解密' },
      { key: 'unicode', label: 'Unicode', icon: 'U+', desc: '字符编码查看 / Unicode 转义互转' },
    ],
  },
  {
    category: '数据工具',
    categoryEn: 'DATA',
    tools: [
      { key: 'timestamp', label: '时间戳转换', icon: 'T', desc: '时间戳互转、多格式、时区、相对时间' },
      { key: 'uuid', label: 'UUID / ID', icon: 'ID', desc: 'UUID v4 / NanoID / 自定义格式批量生成' },
      { key: 'mockdata', label: 'Mock 数据', icon: 'Mk', desc: '可视化生成各类假数据（姓名/地址/手机等）' },
      { key: 'color', label: '颜色工具', icon: 'Clr', desc: 'HEX/RGB/HSL/RGBA 互转 + 调色板 + 对比度' },
      { key: 'number', label: '数字格式化', icon: '123', desc: '千分位/大写金额/文件大小/科学计数' },
      { key: 'radix', label: '进制转换', icon: '0x', desc: '二/八/十/十六进制互转' },
      { key: 'hash', label: '哈希生成', icon: '#', desc: 'SHA-1 / SHA-256 / SHA-512 哈希' },
      { key: 'password', label: '随机密码', icon: '***', desc: '可配置长度和字符类型的密码生成' },
      { key: 'placeholder', label: '占位图', icon: '🖼', desc: '生成指定尺寸/颜色的占位图片' },
      { key: 'qrcode', label: '二维码', icon: 'QR', desc: '生成二维码图片（纯前端 Canvas）' },
    ],
  },
  {
    category: '文本工具',
    categoryEn: 'TEXT',
    tools: [
      { key: 'texttransform', label: '文本变换', icon: 'Tt', desc: '命名风格转换/大小写/行排序去重/前后缀' },
      { key: 'regex', label: '正则测试', icon: '.*', desc: '正则测试/替换、匹配高亮、常用预设' },
      { key: 'diff', label: '文本对比', icon: 'Ab', desc: 'LCS 逐行对比 + 忽略空格/大小写选项' },
      { key: 'markdown', label: 'Markdown', icon: 'Md', desc: 'Markdown 预览 + 表格生成器' },
      { key: 'textstat', label: '文本统计', icon: 'Aa', desc: '字符/字数/行数/段落/阅读时间/去重' },
    ],
  },
  {
    category: '网络工具',
    categoryEn: 'NETWORK',
    tools: [
      { key: 'curl', label: 'cURL 解析', icon: '>>>', desc: '解析 curl 命令 ↔ 结构化数据 ↔ 多语言代码' },
      { key: 'httpcode', label: 'HTTP 状态码', icon: '200', desc: 'HTTP 状态码含义速查与搜索' },
      { key: 'jwt', label: 'JWT 解析', icon: 'JWT', desc: '解码 JWT Token 的 Header 和 Payload' },
    ],
  },
  {
    category: '速查工具',
    categoryEn: 'REFERENCE',
    tools: [
      { key: 'ascii', label: 'ASCII 码表', icon: 'A=65', desc: '完整 ASCII 码对照表，支持搜索' },
      { key: 'cron', label: 'Cron 表达式', icon: '*/5', desc: '解析 Cron 为中文描述 + 执行时间' },
      { key: 'cssunit', label: 'CSS 单位', icon: 'px', desc: 'px/rem/em/vw/vh/pt 单位互转' },
    ],
  },
  {
    category: '文档生成',
    categoryEn: 'DOC',
    tools: [
      { key: 'apidoc', label: '接口文档', icon: '📄', desc: '根据接口数据生成 Markdown 文档' },
    ],
  },
];

const allTools = computed(() => toolGroups.flatMap(g => g.tools));
const currentTool = computed(() => allTools.value.find(t => t.key === activeTool.value));

/* ==================== 通用工具函数 ==================== */

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function copyText(text: string) {
  navigator.clipboard.writeText(text);
}

/* ==================== JSON 格式化工具 ==================== */

const jsonInput = ref('');
const jsonOutput = ref('');
const jsonError = ref('');
const jsonIndent = ref(2);

const jsonStats = computed(() => {
  if (!jsonInput.value.trim()) return null;
  try {
    const data = JSON.parse(jsonInput.value);
    let objects = 0, arrays = 0, strings = 0, numbers = 0, booleans = 0, nulls = 0, keys = 0, maxDepth = 0;
    function walk(val: any, depth: number) {
      if (depth > maxDepth) maxDepth = depth;
      if (val === null) { nulls++; return; }
      if (typeof val === 'string') { strings++; return; }
      if (typeof val === 'number') { numbers++; return; }
      if (typeof val === 'boolean') { booleans++; return; }
      if (Array.isArray(val)) { arrays++; val.forEach(v => walk(v, depth + 1)); return; }
      if (typeof val === 'object') { objects++; const ks = Object.keys(val); keys += ks.length; ks.forEach(k => walk(val[k], depth + 1)); }
    }
    walk(data, 0);
    return { objects, arrays, strings, numbers, booleans, nulls, keys, maxDepth };
  } catch { return null; }
});

function formatJson() {
  try {
    jsonOutput.value = JSON.stringify(JSON.parse(jsonInput.value), null, jsonIndent.value);
    jsonError.value = '';
  } catch (e: any) { jsonError.value = e.message; jsonOutput.value = ''; }
}

function compressJson() {
  try {
    jsonOutput.value = JSON.stringify(JSON.parse(jsonInput.value));
    jsonError.value = '';
  } catch (e: any) { jsonError.value = e.message; jsonOutput.value = ''; }
}

function escapeJsonString() {
  jsonOutput.value = jsonInput.value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t');
  jsonError.value = '';
}

function unescapeJsonString() {
  try {
    jsonOutput.value = JSON.parse(`"${jsonInput.value}"`);
    jsonError.value = '';
  } catch (e: any) { jsonError.value = e.message; }
}

function jsonToCsv() {
  jsonError.value = '';
  try {
    const data = JSON.parse(jsonInput.value);
    const arr = Array.isArray(data) ? data : [data];
    if (arr.length === 0 || typeof arr[0] !== 'object') { jsonError.value = '需要对象数组才能转CSV'; return; }
    const headers = [...new Set(arr.flatMap(item => Object.keys(item)))];
    const csvEscape = (v: any) => {
      const s = v == null ? '' : String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [headers.join(',')];
    for (const item of arr) lines.push(headers.map(h => csvEscape(item[h])).join(','));
    jsonOutput.value = lines.join('\n');
  } catch (e: any) { jsonError.value = e.message; }
}

function jsonTryFix() {
  jsonError.value = '';
  let s = jsonInput.value.trim();
  // 尝试常见修复
  s = s.replace(/,\s*([}\]])/g, '$1'); // 去除尾逗号
  s = s.replace(/([{,]\s*)(\w+)\s*:/g, '$1"$2":'); // 无引号key加引号
  s = s.replace(/'/g, '"'); // 单引号转双引号
  s = s.replace(/\t/g, '  ');
  // 尝试解析
  try {
    jsonOutput.value = JSON.stringify(JSON.parse(s), null, jsonIndent.value);
    jsonError.value = '';
  } catch (e: any) { jsonError.value = '修复失败：' + e.message; jsonOutput.value = s; }
}

/* ==================== URL 编解码工具 ==================== */

const urlInput = ref('');
const urlOutput = ref('');
const urlParsed = ref<{ protocol: string; host: string; port: string; pathname: string; search: string; hash: string; params: { key: string; value: string }[] } | null>(null);
const urlParseError = ref('');

function urlEncode() { urlOutput.value = encodeURIComponent(urlInput.value); }
function urlDecode() {
  try { urlOutput.value = decodeURIComponent(urlInput.value); }
  catch { urlOutput.value = '解码失败：输入不是有效的编码字符串'; }
}
function urlEncodeAll() { urlOutput.value = encodeURI(urlInput.value); }
function urlParseUrl() {
  urlParsed.value = null; urlParseError.value = '';
  try {
    const u = new URL(urlInput.value);
    const params: { key: string; value: string }[] = [];
    u.searchParams.forEach((v, k) => params.push({ key: k, value: v }));
    urlParsed.value = {
      protocol: u.protocol.replace(':', ''),
      host: u.hostname,
      port: u.port,
      pathname: u.pathname,
      search: u.search,
      hash: u.hash,
      params,
    };
  } catch { urlParseError.value = '无法解析，请输入完整 URL（如 https://example.com/path?a=1）'; }
}

/* ==================== Base64 编解码工具 ==================== */

const b64Input = ref('');
const b64Output = ref('');
const b64ImageSrc = ref('');
const b64ImageInfo = ref('');

function b64Encode() {
  try { b64Output.value = btoa(unescape(encodeURIComponent(b64Input.value))); }
  catch { b64Output.value = '编码失败'; }
}
function b64Decode() {
  try { b64Output.value = decodeURIComponent(escape(atob(b64Input.value))); }
  catch { b64Output.value = '解码失败：输入不是有效的 Base64 字符串'; }
}
function b64FromFile() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      b64Output.value = dataUrl;
      b64ImageSrc.value = dataUrl;
      const sizeKB = (file.size / 1024).toFixed(1);
      b64ImageInfo.value = `${file.name} (${sizeKB} KB, ${file.type})`;
    };
    reader.readAsDataURL(file);
  };
  input.click();
}
function b64DetectAndPreview() {
  b64ImageSrc.value = '';
  b64ImageInfo.value = '';
  const val = b64Input.value.trim();
  if (val.startsWith('data:image')) {
    b64ImageSrc.value = val;
    b64ImageInfo.value = 'DataURL 图片预览';
  } else {
    try {
      const binary = atob(val.replace(/^data:[^;]+;base64,/, ''));
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const isPng = bytes[0] === 0x89 && bytes[1] === 0x50;
      const isJpg = bytes[0] === 0xFF && bytes[1] === 0xD8;
      const isGif = bytes[0] === 0x47 && bytes[1] === 0x49;
      if (isPng || isJpg || isGif) {
        const mime = isPng ? 'image/png' : isJpg ? 'image/jpeg' : 'image/gif';
        b64ImageSrc.value = `data:${mime};base64,${val}`;
        b64ImageInfo.value = `检测到 ${mime} 图片`;
      }
    } catch { /* not an image */ }
  }
}

/* ==================== 时间戳转换工具 ==================== */

const tsInput = ref('');
const tsOutput = ref('');
const nowTs = ref(Math.floor(Date.now() / 1000));
const nowTsMs = ref(Date.now());
const tsFormat = ref('default');
setInterval(() => { nowTs.value = Math.floor(Date.now() / 1000); nowTsMs.value = Date.now(); }, 1000);

const tsFormats: { label: string; value: string }[] = [
  { label: '默认格式', value: 'default' },
  { label: 'ISO 8601', value: 'iso' },
  { label: 'YYYY-MM-DD', value: 'date' },
  { label: 'YYYY-MM-DD HH:mm:ss', value: 'datetime' },
  { label: 'YYYY/MM/DD HH:mm:ss', value: 'datetime2' },
  { label: 'Unix 秒级', value: 'unix' },
  { label: 'Unix 毫秒级', value: 'unixms' },
  { label: 'UTC 字符串', value: 'utc' },
  { label: '相对时间', value: 'relative' },
];

function formatDate(d: Date, fmt: string): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const Y = d.getFullYear(), M = pad(d.getMonth() + 1), D = pad(d.getDate());
  const h = pad(d.getHours()), m = pad(d.getMinutes()), s = pad(d.getSeconds());
  switch (fmt) {
    case 'iso': return d.toISOString();
    case 'date': return `${Y}-${M}-${D}`;
    case 'datetime': return `${Y}-${M}-${D} ${h}:${m}:${s}`;
    case 'datetime2': return `${Y}/${M}/${D} ${h}:${m}:${s}`;
    case 'unix': return String(Math.floor(d.getTime() / 1000));
    case 'unixms': return String(d.getTime());
    case 'utc': return d.toUTCString();
    case 'relative': return getRelativeTime(d);
    default: return d.toLocaleString('zh-CN', { hour12: false });
  }
}

function getRelativeTime(d: Date): string {
  const diff = Date.now() - d.getTime();
  const abs = Math.abs(diff);
  const suffix = diff > 0 ? '前' : '后';
  if (abs < 60000) return `${Math.floor(abs / 1000)} 秒${suffix}`;
  if (abs < 3600000) return `${Math.floor(abs / 60000)} 分钟${suffix}`;
  if (abs < 86400000) return `${Math.floor(abs / 3600000)} 小时${suffix}`;
  if (abs < 2592000000) return `${Math.floor(abs / 86400000)} 天${suffix}`;
  if (abs < 31536000000) return `${Math.floor(abs / 2592000000)} 个月${suffix}`;
  return `${Math.floor(abs / 31536000000)} 年${suffix}`;
}

function tsToDate() {
  const n = Number(tsInput.value);
  if (isNaN(n)) { tsOutput.value = '请输入有效数字'; return; }
  const ms = String(n).length > 10 ? n : n * 1000;
  const d = new Date(ms);
  const lines = [formatDate(d, tsFormat.value)];
  if (tsFormat.value === 'default') {
    lines.push(`ISO: ${d.toISOString()}`);
    lines.push(`UTC: ${d.toUTCString()}`);
    lines.push(`相对: ${getRelativeTime(d)}`);
    lines.push(`秒级: ${Math.floor(ms / 1000)}`);
    lines.push(`毫秒级: ${ms}`);
  }
  tsOutput.value = lines.join('\n');
}

function dateToTs() {
  const d = new Date(tsInput.value);
  if (isNaN(d.getTime())) { tsOutput.value = '请输入有效日期，如 2024-01-01 12:00:00'; return; }
  tsOutput.value = `秒级：${Math.floor(d.getTime() / 1000)}\n毫秒级：${d.getTime()}\nISO：${d.toISOString()}\n相对：${getRelativeTime(d)}`;
}

function tsNow() { tsInput.value = String(nowTs.value); tsToDate(); }
function tsNowMs() { tsInput.value = String(nowTsMs.value); tsToDate(); }

/* ==================== UUID / ID 生成工具 ==================== */

const uuidCount = ref(5);
const uuidOutput = ref('');
const uuidFormat = ref<'standard' | 'upper' | 'nodash' | 'braces'>('standard');
const uuidType = ref<'uuid' | 'nanoid' | 'objectid' | 'snowflake'>('uuid');
const nanoidLength = ref(21);
const nanoidAlphabet = ref('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_-');

function generateUUID() {
  const results: string[] = [];
  for (let i = 0; i < uuidCount.value; i++) {
    if (uuidType.value === 'uuid') {
      let id: string = crypto.randomUUID();
      if (uuidFormat.value === 'upper') id = id.toUpperCase();
      else if (uuidFormat.value === 'nodash') id = id.replace(/-/g, '');
      else if (uuidFormat.value === 'braces') id = `{${id}}`;
      results.push(id);
    } else if (uuidType.value === 'nanoid') {
      const chars = nanoidAlphabet.value;
      const arr = new Uint8Array(nanoidLength.value);
      crypto.getRandomValues(arr);
      results.push(Array.from(arr, v => chars[v % chars.length]).join(''));
    } else if (uuidType.value === 'objectid') {
      // 模拟 MongoDB ObjectId (24位十六进制)
      const ts = Math.floor(Date.now() / 1000).toString(16).padStart(8, '0');
      const rand = Array.from(crypto.getRandomValues(new Uint8Array(8)), b => b.toString(16).padStart(2, '0')).join('');
      results.push(ts + rand);
    } else if (uuidType.value === 'snowflake') {
      // 模拟雪花ID (纯数字，基于时间戳)
      const ts = BigInt(Date.now() - 1288834974657);
      const rand = BigInt(Math.floor(Math.random() * 4096));
      const seq = BigInt(i % 4096);
      results.push(String((ts << 22n) | (rand << 12n) | seq));
    }
  }
  uuidOutput.value = results.join('\n');
}

/* ==================== 正则测试工具 ==================== */

const regexPattern = ref('');
const regexFlags = ref('g');
const regexTestStr = ref('');

const regexReplace = ref('');
const regexReplaceResult = computed(() => {
  if (!regexPattern.value || !regexTestStr.value) return '';
  try {
    const re = new RegExp(regexPattern.value, regexFlags.value);
    return regexTestStr.value.replace(re, regexReplace.value);
  } catch { return ''; }
});
const regexError = computed(() => {
  if (!regexPattern.value) return '';
  try { new RegExp(regexPattern.value, regexFlags.value); return ''; }
  catch (e: any) { return e.message; }
});

const regexPresets = [
  { label: '手机号', pattern: '1[3-9]\\d{9}', flags: 'g' },
  { label: '邮箱', pattern: '[\\w.-]+@[\\w-]+(\\.[\\w-]+)+', flags: 'gi' },
  { label: 'URL', pattern: 'https?://[\\w\\-._~:/?#\\[\\]@!$&\'()*+,;=%]+', flags: 'gi' },
  { label: 'IPv4', pattern: '\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b', flags: 'g' },
  { label: 'IPv6', pattern: '([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}', flags: 'g' },
  { label: '身份证号', pattern: '\\d{17}[\\dXx]', flags: 'g' },
  { label: '中文字符', pattern: '[\\u4e00-\\u9fff]+', flags: 'g' },
  { label: '日期 YYYY-MM-DD', pattern: '\\d{4}-\\d{2}-\\d{2}', flags: 'g' },
  { label: 'HTML 标签', pattern: '<[^>]+>', flags: 'g' },
  { label: '十六进制颜色', pattern: '#[0-9a-fA-F]{3,8}\\b', flags: 'g' },
  { label: '数字（含小数）', pattern: '-?\\d+(\\.\\d+)?', flags: 'g' },
  { label: '文件路径', pattern: '(/[\\w.-]+)+/?', flags: 'g' },
  { label: '变量名', pattern: '[a-zA-Z_$][\\w$]*', flags: 'g' },
  { label: '密码强度（8+混合）', pattern: '(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^a-zA-Z0-9]).{8,}', flags: 'g' },
];

function applyRegexPreset(preset: typeof regexPresets[0]) {
  regexPattern.value = preset.pattern;
  regexFlags.value = preset.flags;
}

const regexMatches = computed(() => {
  if (!regexPattern.value || !regexTestStr.value) return [];
  try {
    const re = new RegExp(regexPattern.value, regexFlags.value);
    const matches: { start: number; end: number; text: string }[] = [];
    let m: RegExpExecArray | null;
    if (regexFlags.value.includes('g')) {
      while ((m = re.exec(regexTestStr.value)) !== null) {
        matches.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
        if (!m[0].length) re.lastIndex++;
      }
    } else {
      m = re.exec(regexTestStr.value);
      if (m) matches.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
    }
    return matches;
  } catch { return []; }
});

const regexHighlighted = computed(() => {
  if (!regexMatches.value.length) return escapeHtml(regexTestStr.value);
  let result = '';
  let last = 0;
  for (const m of regexMatches.value) {
    result += escapeHtml(regexTestStr.value.slice(last, m.start));
    result += `<mark class="regex-match">${escapeHtml(m.text)}</mark>`;
    last = m.end;
  }
  result += escapeHtml(regexTestStr.value.slice(last));
  return result;
});

/* ==================== JSON → TypeScript Interface 转换工具 ==================== */

const j2tsInput = ref('');
const j2tsOutput = ref('');
const j2tsError = ref('');
const j2tsRootName = ref('Root');

function jsonToTs() {
  j2tsError.value = '';
  j2tsOutput.value = '';
  try {
    const data = JSON.parse(j2tsInput.value);
    const interfaces: string[] = [];
    generateInterface(data, j2tsRootName.value || 'Root', interfaces);
    j2tsOutput.value = interfaces.join('\n\n');
  } catch (e: any) { j2tsError.value = e.message; }
}

function onJ2tsJsonChange(val: string) {
  j2tsInput.value = val;
  tryFormatJ2tsInput();
}

function tryFormatJ2tsInput() {
  try {
    const parsed = JSON.parse(j2tsInput.value);
    j2tsInput.value = JSON.stringify(parsed, null, 2);
    j2tsError.value = '';
  } catch (e: any) {
    j2tsError.value = j2tsInput.value.trim() ? e.message : '';
  }
}

function generateInterface(obj: any, name: string, out: string[]) {
  if (Array.isArray(obj)) {
    if (obj.length > 0 && typeof obj[0] === 'object' && obj[0] !== null) generateInterface(obj[0], name, out);
    return;
  }
  if (typeof obj !== 'object' || obj === null) return;
  const lines: string[] = [`export interface ${name} {`];
  for (const [key, val] of Object.entries(obj)) {
    lines.push(`  ${key}: ${inferType(val, capitalize(key), out)};`);
  }
  lines.push('}');
  out.push(lines.join('\n'));
}

function inferType(val: any, hint: string, out: string[]): string {
  if (val === null || val === undefined) return 'unknown';
  if (Array.isArray(val)) {
    if (val.length === 0) return 'unknown[]';
    return `${inferType(val[0], hint + 'Item', out)}[]`;
  }
  if (typeof val === 'object') { generateInterface(val, hint, out); return hint; }
  return typeof val;
}

function capitalize(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

/* ==================== 颜色转换工具 ==================== */

const colorHex = ref('#409EFF');
const colorR = ref(64);
const colorG = ref(158);
const colorB = ref(255);
const colorH = ref(210);
const colorS = ref(100);
const colorL = ref(63);

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = hex.replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return null;
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('').toUpperCase();
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: Math.round(l * 100) };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  h /= 360; s /= 100; l /= 100;
  if (s === 0) { const v = Math.round(l * 255); return { r: v, g: v, b: v }; }
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: Math.round(hue2rgb(p, q, h + 1/3) * 255),
    g: Math.round(hue2rgb(p, q, h) * 255),
    b: Math.round(hue2rgb(p, q, h - 1/3) * 255),
  };
}

const colorA = ref(100);
const colorPreview = computed(() => {
  const a = colorA.value / 100;
  return a < 1 ? `rgba(${colorR.value}, ${colorG.value}, ${colorB.value}, ${a})` : colorHex.value;
});
let colorSyncing = false;

function onColorHexInput() {
  if (colorSyncing) return;
  colorSyncing = true;
  const rgb = hexToRgb(colorHex.value);
  if (rgb) {
    colorR.value = rgb.r; colorG.value = rgb.g; colorB.value = rgb.b;
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    colorH.value = hsl.h; colorS.value = hsl.s; colorL.value = hsl.l;
  }
  colorSyncing = false;
}

function onColorRgbInput() {
  if (colorSyncing) return;
  colorSyncing = true;
  colorHex.value = rgbToHex(colorR.value, colorG.value, colorB.value);
  const hsl = rgbToHsl(colorR.value, colorG.value, colorB.value);
  colorH.value = hsl.h; colorS.value = hsl.s; colorL.value = hsl.l;
  colorSyncing = false;
}

function onColorHslInput() {
  if (colorSyncing) return;
  colorSyncing = true;
  const rgb = hslToRgb(colorH.value, colorS.value, colorL.value);
  colorR.value = rgb.r; colorG.value = rgb.g; colorB.value = rgb.b;
  colorHex.value = rgbToHex(rgb.r, rgb.g, rgb.b);
  colorSyncing = false;
}

// WCAG 对比度计算
function luminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map(c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

const colorContrastWhite = computed(() => {
  const l1 = luminance(colorR.value, colorG.value, colorB.value);
  return ((Math.max(l1, 1) + 0.05) / (Math.min(l1, 1) + 0.05)).toFixed(2);
});

const colorContrastBlack = computed(() => {
  const l1 = luminance(colorR.value, colorG.value, colorB.value);
  return ((Math.max(l1, 0) + 0.05) / (Math.min(l1, 0) + 0.05)).toFixed(2);
});

// 调色板生成
const colorPalette = computed(() => {
  const shades: { hex: string; label: string }[] = [];
  for (let i = 95; i >= 5; i -= 10) {
    const rgb = hslToRgb(colorH.value, colorS.value, i);
    shades.push({ hex: rgbToHex(rgb.r, rgb.g, rgb.b), label: `L${i}` });
  }
  return shades;
});

const colorPresets = [
  { label: 'Element Blue', hex: '#409EFF' }, { label: 'Success', hex: '#67C23A' },
  { label: 'Warning', hex: '#E6A23C' }, { label: 'Danger', hex: '#F56C6C' },
  { label: 'Info', hex: '#909399' }, { label: 'Tailwind Blue', hex: '#3B82F6' },
  { label: 'Tailwind Green', hex: '#22C55E' }, { label: 'Tailwind Purple', hex: '#A855F7' },
  { label: 'Ant Blue', hex: '#1677FF' }, { label: 'Material Teal', hex: '#009688' },
  { label: 'Material Amber', hex: '#FFC107' }, { label: 'Material Pink', hex: '#E91E63' },
];

function applyColorPreset(hex: string) {
  colorHex.value = hex;
  onColorHexInput();
}

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

/* ==================== 哈希生成工具 ==================== */

const hashInput = ref('');
const hashAlgo = ref('SHA-256');
const hashOutput = ref('');

async function generateHash() {
  if (!hashInput.value) { hashOutput.value = ''; return; }
  const data = new TextEncoder().encode(hashInput.value);
  const buffer = await crypto.subtle.digest(hashAlgo.value, data);
  hashOutput.value = Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/* ==================== 进制转换工具 ==================== */

const radixBin = ref('');
const radixOct = ref('');
const radixDec = ref('');
const radixHexVal = ref('');
const radixError = ref('');

function onRadixInput(from: 'bin' | 'oct' | 'dec' | 'hex') {
  radixError.value = '';
  const baseMap = { bin: 2, oct: 8, dec: 10, hex: 16 } as const;
  const valMap = { bin: radixBin, oct: radixOct, dec: radixDec, hex: radixHexVal } as const;
  const input = valMap[from].value.trim();
  if (!input) { radixBin.value = ''; radixOct.value = ''; radixDec.value = ''; radixHexVal.value = ''; return; }
  const num = parseInt(input, baseMap[from]);
  if (isNaN(num)) { radixError.value = '输入不是有效的数值'; return; }
  if (from !== 'bin') radixBin.value = num.toString(2);
  if (from !== 'oct') radixOct.value = num.toString(8);
  if (from !== 'dec') radixDec.value = num.toString(10);
  if (from !== 'hex') radixHexVal.value = num.toString(16).toUpperCase();
}

/* ==================== 文本对比工具 ==================== */

const diffLeft = ref('');
const diffRight = ref('');
const diffIgnoreWhitespace = ref(false);
const diffIgnoreCase = ref(false);
const diffTrimLines = ref(false);

const diffResult = computed(() => {
  if (!diffLeft.value && !diffRight.value) return [];
  let linesA = diffLeft.value.split('\n');
  let linesB = diffRight.value.split('\n');
  // 预处理
  const preprocess = (line: string) => {
    let l = line;
    if (diffTrimLines.value) l = l.trim();
    if (diffIgnoreWhitespace.value) l = l.replace(/\s+/g, ' ');
    if (diffIgnoreCase.value) l = l.toLowerCase();
    return l;
  };
  const procA = linesA.map(preprocess);
  const procB = linesB.map(preprocess);
  const m = linesA.length, n = linesB.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = procA[i - 1] === procB[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
  const result: { type: 'same' | 'del' | 'add'; text: string; lineNum: number }[] = [];
  let i = m, j = n;
  const stack: typeof result = [];
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && procA[i - 1] === procB[j - 1]) { stack.push({ type: 'same', text: linesA[i - 1], lineNum: i }); i--; j--; }
    else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) { stack.push({ type: 'add', text: linesB[j - 1], lineNum: j }); j--; }
    else { stack.push({ type: 'del', text: linesA[i - 1], lineNum: i }); i--; }
  }
  while (stack.length) result.push(stack.pop()!);
  return result;
});

const diffStats = computed(() => {
  const r = diffResult.value;
  return { total: r.length, same: r.filter(l => l.type === 'same').length, added: r.filter(l => l.type === 'add').length, deleted: r.filter(l => l.type === 'del').length };
});

/* ==================== HTML 实体编解码工具 ==================== */

const htmlEncInput = ref('');
const htmlEncOutput = ref('');

function htmlEntityEncode() {
  htmlEncOutput.value = htmlEncInput.value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function htmlEntityDecode() {
  htmlEncOutput.value = htmlEncInput.value
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&#(\d+);/g, (_, num: string) => String.fromCharCode(parseInt(num)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&amp;/g, '&');
}

/* ==================== 文本统计工具 ==================== */

const textStatInput = ref('');

const textStats = computed(() => {
  const text = textStatInput.value;
  if (!text) return { chars: 0, charsNoSpace: 0, words: 0, lines: 0, paragraphs: 0, bytes: 0, chineseChars: 0, englishWords: 0, uniqueLines: 0, readTime: '0 秒' };
  const chars = text.length;
  const charsNoSpace = text.replace(/\s/g, '').length;
  const lines = text.split('\n').length;
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim()).length || (text.trim() ? 1 : 0);
  const bytes = new TextEncoder().encode(text).length;
  const chineseChars = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
  const stripped = text.replace(/[\u4e00-\u9fff\u3400-\u4dbf]/g, ' ').trim();
  const englishWords = stripped ? stripped.split(/\s+/).filter(w => w.length > 0).length : 0;
  const words = chineseChars + englishWords;
  const uniqueLines = new Set(text.split('\n').map(l => l.trim()).filter(Boolean)).size;
  // 阅读时间：中文 300字/分钟，英文 200词/分钟
  const totalMinutes = chineseChars / 300 + englishWords / 200;
  let readTime: string;
  if (totalMinutes < 1) readTime = `${Math.max(1, Math.ceil(totalMinutes * 60))} 秒`;
  else if (totalMinutes < 60) readTime = `${Math.ceil(totalMinutes)} 分钟`;
  else readTime = `${Math.floor(totalMinutes / 60)} 小时 ${Math.ceil(totalMinutes % 60)} 分钟`;
  return { chars, charsNoSpace, words, lines, paragraphs, bytes, chineseChars, englishWords, uniqueLines, readTime };
});

/* ==================== 随机密码生成工具 ==================== */

const pwdLength = ref(16);
const pwdUppercase = ref(true);
const pwdLowercase = ref(true);
const pwdDigits = ref(true);
const pwdSpecial = ref(true);
const pwdOutput = ref('');

const pwdStrength = computed(() => {
  const pwd = pwdOutput.value;
  if (!pwd) return { level: 0, text: '', color: '' };
  let score = 0;
  if (pwd.length >= 8) score++;
  if (pwd.length >= 12) score++;
  if (pwd.length >= 16) score++;
  if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score++;
  if (/\d/.test(pwd)) score++;
  if (/[^a-zA-Z0-9]/.test(pwd)) score++;
  if (score <= 2) return { level: 1, text: '弱', color: '#f56c6c' };
  if (score <= 3) return { level: 2, text: '中等', color: '#e6a23c' };
  if (score <= 4) return { level: 3, text: '强', color: '#409eff' };
  return { level: 4, text: '很强', color: '#67c23a' };
});

function generatePassword() {
  let chars = '';
  if (pwdUppercase.value) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (pwdLowercase.value) chars += 'abcdefghijklmnopqrstuvwxyz';
  if (pwdDigits.value) chars += '0123456789';
  if (pwdSpecial.value) chars += '!@#$%^&*()_+-=[]{}|;:,.<>?';
  if (!chars) { pwdOutput.value = ''; return; }
  const arr = new Uint32Array(pwdLength.value);
  crypto.getRandomValues(arr);
  pwdOutput.value = Array.from(arr, v => chars[v % chars.length]).join('');
}

/* ==================== Markdown 预览工具 ==================== */

const mdInput = ref('');

function renderMarkdown(src: string): string {
  const lines = src.split('\n');
  let html = '';
  let inCode = false;
  let codeBuf = '';
  let inUl = false;
  let inOl = false;

  function closeList() {
    if (inUl) { html += '</ul>'; inUl = false; }
    if (inOl) { html += '</ol>'; inOl = false; }
  }

  function inlineRender(text: string): string {
    let s = escapeHtml(text);
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/\*(.+?)\*/g, '<em>$1</em>');
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
    return s;
  }

  for (const line of lines) {
    if (line.startsWith('```')) {
      if (inCode) {
        html += `<pre><code>${escapeHtml(codeBuf.replace(/\n$/, ''))}</code></pre>`;
        codeBuf = '';
      } else {
        closeList();
      }
      inCode = !inCode;
      continue;
    }
    if (inCode) { codeBuf += line + '\n'; continue; }

    const hMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (hMatch) {
      closeList();
      html += `<h${hMatch[1].length}>${inlineRender(hMatch[2])}</h${hMatch[1].length}>`;
      continue;
    }

    const ulMatch = line.match(/^[-*]\s+(.*)$/);
    if (ulMatch) {
      if (inOl) { html += '</ol>'; inOl = false; }
      if (!inUl) { html += '<ul>'; inUl = true; }
      html += `<li>${inlineRender(ulMatch[1])}</li>`;
      continue;
    }

    const olMatch = line.match(/^\d+\.\s+(.*)$/);
    if (olMatch) {
      if (inUl) { html += '</ul>'; inUl = false; }
      if (!inOl) { html += '<ol>'; inOl = true; }
      html += `<li>${inlineRender(olMatch[1])}</li>`;
      continue;
    }

    closeList();
    if (!line.trim()) continue;
    html += `<p>${inlineRender(line)}</p>`;
  }

  closeList();
  if (inCode) html += `<pre><code>${escapeHtml(codeBuf.replace(/\n$/, ''))}</code></pre>`;
  return html;
}

const mdRendered = computed(() => mdInput.value ? renderMarkdown(mdInput.value) : '<p style="color:var(--text-secondary)">预览区域</p>');

/* ==================== Cron 表达式工具 ==================== */

const cronInput = ref('');
const cronDesc = ref('');
const cronNextTimes = ref<string[]>([]);
const cronError = ref('');

function parseCron() {
  cronDesc.value = ''; cronNextTimes.value = []; cronError.value = '';
  const expr = cronInput.value.trim();
  if (!expr) return;
  const parts = expr.split(/\s+/);
  if (parts.length !== 5) { cronError.value = 'Cron 表达式需要 5 个字段：分 时 日 月 周'; return; }
  const [min, hour, dom, mon, dow] = parts;

  try { cronDesc.value = describeCron(min, hour, dom, mon, dow); }
  catch (e: any) { cronError.value = '无法解析：' + e.message; return; }

  try { cronNextTimes.value = getNextCronTimes(parts, 5); }
  catch { /* 计算失败则只显示描述 */ }
}

function describeCron(min: string, hour: string, dom: string, mon: string, dow: string): string {
  if (min.startsWith('*/') && hour === '*' && dom === '*' && mon === '*' && dow === '*')
    return `每隔 ${min.slice(2)} 分钟执行`;
  if (min === '0' && hour.startsWith('*/') && dom === '*' && mon === '*' && dow === '*')
    return `每隔 ${hour.slice(2)} 小时执行`;
  if (min === '0' && hour === '0' && dom === '*' && mon === '*' && dow === '*')
    return '每天 00:00 执行';
  if (min === '0' && hour === '*' && dom === '*' && mon === '*' && dow === '*')
    return '每小时整点执行';
  if (min === '*' && hour === '*' && dom === '*' && mon === '*' && dow === '*')
    return '每分钟执行';

  const dowNames: Record<string, string> = { '0':'日','1':'一','2':'二','3':'三','4':'四','5':'五','6':'六','7':'日' };
  const descs: string[] = [];

  if (mon !== '*') descs.push(mon.includes('/') ? `每隔 ${mon.split('/')[1]} 个月` : `${mon} 月`);
  if (dow !== '*') {
    const mapDow = (v: string) => '周' + (dowNames[v] || v);
    if (dow.includes('-')) { const [a, b] = dow.split('-'); descs.push(`${mapDow(a)}至${mapDow(b)}`); }
    else if (dow.includes(',')) descs.push(dow.split(',').map(mapDow).join('、'));
    else descs.push(`每${mapDow(dow)}`);
  }
  if (dom !== '*' && dow === '*') descs.push(dom.includes('/') ? `每隔 ${dom.split('/')[1]} 天` : `每月 ${dom} 日`);
  if (hour !== '*') {
    if (hour.includes('/')) descs.push(`每隔 ${hour.split('/')[1]} 小时`);
    else descs.push(`${hour} 时`);
  }
  if (min !== '*') {
    if (min.includes('/')) descs.push(`每隔 ${min.split('/')[1]} 分钟`);
    else descs.push(`${min} 分`);
  } else if (hour !== '*' && !hour.includes('/')) {
    descs.push('每分钟');
  }

  return descs.join(' ') + '执行';
}

function getNextCronTimes(parts: string[], count: number): string[] {
  const [minE, hourE, domE, monE, dowE] = parts;
  const results: string[] = [];
  const now = new Date();
  let check = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes() + 1, 0, 0);
  const maxIter = 525600;
  for (let i = 0; i < maxIter && results.length < count; i++) {
    if (
      matchField(check.getMinutes(), minE, 0, 59) &&
      matchField(check.getHours(), hourE, 0, 23) &&
      matchField(check.getDate(), domE, 1, 31) &&
      matchField(check.getMonth() + 1, monE, 1, 12) &&
      matchField(check.getDay(), dowE, 0, 6)
    ) {
      results.push(check.toLocaleString('zh-CN', { hour12: false }));
    }
    check = new Date(check.getTime() + 60000);
  }
  return results;
}

function matchField(value: number, expr: string, min: number, max: number): boolean {
  if (expr === '*') return true;
  for (const part of expr.split(',')) {
    if (part.includes('/')) {
      const [rangeStr, stepStr] = part.split('/');
      const step = parseInt(stepStr);
      let start = min;
      if (rangeStr !== '*') {
        if (rangeStr.includes('-')) {
          const [s, e] = rangeStr.split('-').map(Number);
          if (value >= s && value <= e && (value - s) % step === 0) return true;
          continue;
        }
        start = parseInt(rangeStr);
      }
      for (let v = start; v <= max; v += step) { if (v === value) return true; }
    } else if (part.includes('-')) {
      const [s, e] = part.split('-').map(Number);
      if (value >= s && value <= e) return true;
    } else {
      if (parseInt(part) === value) return true;
    }
  }
  return false;
}

/* ==================== JSONPath 查询工具 ==================== */

const jpInput = ref('');
const jpPath = ref('$');
const jpOutput = ref('');
const jpError = ref('');

const jpPresets = [
  { label: '根对象', path: '$' },
  { label: '所有属性', path: '$..*' },
  { label: '第一个元素', path: '$[0]' },
  { label: '所有元素', path: '$[*]' },
  { label: '嵌套属性', path: '$.store.book[*].author' },
  { label: '条件过滤', path: '$.store.book[?(@.price<10)]' },
];

function queryJsonPath() {
  jpOutput.value = ''; jpError.value = '';
  try {
    const data = JSON.parse(jpInput.value);
    const path = jpPath.value.trim();
    if (!path) { jpError.value = '请输入 JSONPath 表达式'; return; }
    const result = evaluateJsonPath(data, path);
    jpOutput.value = JSON.stringify(result, null, 2);
  } catch (e: any) { jpError.value = e.message; }
}

function evaluateJsonPath(data: any, path: string): any {
  if (path === '$') return data;
  if (path === '$..*') return collectAll(data);

  // 去掉开头的 $
  let expr = path.startsWith('$.') ? path.slice(2) : path.startsWith('$') ? path.slice(1) : path;

  // 解析路径段
  const segments = parsePathSegments(expr);
  let current: any[] = [data];

  for (const seg of segments) {
    const next: any[] = [];
    for (const item of current) {
      if (seg.type === 'key') {
        if (item != null && typeof item === 'object' && seg.value in item) {
          next.push(item[seg.value]);
        }
      } else if (seg.type === 'index') {
        if (Array.isArray(item)) {
          const idx = parseInt(seg.value);
          if (idx >= 0 && idx < item.length) next.push(item[idx]);
        }
      } else if (seg.type === 'wildcard') {
        if (Array.isArray(item)) next.push(...item);
        else if (item != null && typeof item === 'object') next.push(...Object.values(item));
      } else if (seg.type === 'filter') {
        if (Array.isArray(item)) {
          for (const el of item) {
            if (evalFilter(el, seg.value)) next.push(el);
          }
        }
      } else if (seg.type === 'deepScan') {
        const collected = collectByKey(item, seg.value);
        next.push(...collected);
      }
    }
    current = next;
  }

  return current.length === 1 ? current[0] : current;
}

function parsePathSegments(expr: string): { type: string; value: string }[] {
  const segments: { type: string; value: string }[] = [];
  let i = 0;
  while (i < expr.length) {
    if (expr[i] === '.') {
      i++;
      if (expr[i] === '.') {
        // deep scan: ..key
        i++;
        let key = '';
        while (i < expr.length && expr[i] !== '.' && expr[i] !== '[') key += expr[i++];
        segments.push({ type: 'deepScan', value: key });
      } else {
        let key = '';
        while (i < expr.length && expr[i] !== '.' && expr[i] !== '[') key += expr[i++];
        if (key === '*') segments.push({ type: 'wildcard', value: '*' });
        else if (key) segments.push({ type: 'key', value: key });
      }
    } else if (expr[i] === '[') {
      i++;
      if (expr[i] === '*') {
        segments.push({ type: 'wildcard', value: '*' });
        i++; // skip *
        if (expr[i] === ']') i++;
      } else if (expr[i] === '?') {
        // filter: [?(@.price<10)]
        i++; // skip ?
        let depth = 1;
        let filter = '';
        if (expr[i] === '(') { i++; depth = 1; }
        while (i < expr.length && depth > 0) {
          if (expr[i] === '(') depth++;
          else if (expr[i] === ')') { depth--; if (depth === 0) { i++; break; } }
          filter += expr[i++];
        }
        if (expr[i] === ']') i++;
        segments.push({ type: 'filter', value: filter });
      } else {
        let idx = '';
        while (i < expr.length && expr[i] !== ']') idx += expr[i++];
        if (expr[i] === ']') i++;
        const trimmed = idx.trim();
        if (/^\d+$/.test(trimmed)) segments.push({ type: 'index', value: trimmed });
        else if (trimmed.startsWith("'") || trimmed.startsWith('"')) {
          segments.push({ type: 'key', value: trimmed.slice(1, -1) });
        } else {
          segments.push({ type: 'key', value: trimmed });
        }
      }
    } else {
      let key = '';
      while (i < expr.length && expr[i] !== '.' && expr[i] !== '[') key += expr[i++];
      if (key === '*') segments.push({ type: 'wildcard', value: '*' });
      else if (key) segments.push({ type: 'key', value: key });
    }
  }
  return segments;
}

function evalFilter(item: any, filterExpr: string): boolean {
  // 简单支持 @.field op value 形式
  const m = filterExpr.match(/@\.(\w+)\s*(==|!=|>=|<=|>|<)\s*(.+)/);
  if (!m) return false;
  const [, field, op, rawVal] = m;
  const fieldVal = item?.[field];
  let cmpVal: any = rawVal.trim();
  if (cmpVal.startsWith("'") || cmpVal.startsWith('"')) cmpVal = cmpVal.slice(1, -1);
  else if (cmpVal === 'true') cmpVal = true;
  else if (cmpVal === 'false') cmpVal = false;
  else if (!isNaN(Number(cmpVal))) cmpVal = Number(cmpVal);
  switch (op) {
    case '==': return fieldVal == cmpVal;
    case '!=': return fieldVal != cmpVal;
    case '>': return fieldVal > cmpVal;
    case '<': return fieldVal < cmpVal;
    case '>=': return fieldVal >= cmpVal;
    case '<=': return fieldVal <= cmpVal;
    default: return false;
  }
}

function collectAll(obj: any): any[] {
  const result: any[] = [];
  if (obj == null || typeof obj !== 'object') return [obj];
  if (Array.isArray(obj)) {
    for (const item of obj) { result.push(item); result.push(...collectAll(item)); }
  } else {
    for (const val of Object.values(obj)) { result.push(val); result.push(...collectAll(val)); }
  }
  return result;
}

function collectByKey(obj: any, key: string): any[] {
  const result: any[] = [];
  if (obj == null || typeof obj !== 'object') return result;
  if (key in obj) result.push(obj[key]);
  for (const val of Object.values(obj)) {
    if (val != null && typeof val === 'object') result.push(...collectByKey(val, key));
  }
  if (Array.isArray(obj)) {
    for (const item of obj) {
      if (item != null && typeof item === 'object' && key in item) result.push(item[key]);
      result.push(...collectByKey(item, key));
    }
  }
  return [...new Set(result)];
}

/* ==================== Mock 数据生成工具 ==================== */

const mockType = ref('preset');
const mockPreset = ref('name');
const mockCount = ref(10);
const mockOutput = ref('');
const mockCustomTpl = ref('');

const mockPresets: { label: string; key: string; category: string }[] = [
  { label: '中文姓名', key: 'name', category: '个人信息' },
  { label: '英文姓名', key: 'nameEn', category: '个人信息' },
  { label: '手机号', key: 'phone', category: '个人信息' },
  { label: '邮箱', key: 'email', category: '个人信息' },
  { label: '身份证号', key: 'idcard', category: '个人信息' },
  { label: '省市区地址', key: 'address', category: '个人信息' },
  { label: 'IPv4 地址', key: 'ip', category: '网络' },
  { label: 'URL', key: 'url', category: '网络' },
  { label: '域名', key: 'domain', category: '网络' },
  { label: '日期时间', key: 'datetime', category: '日期' },
  { label: '日期', key: 'date', category: '日期' },
  { label: '时间', key: 'time', category: '日期' },
  { label: '整数(0-9999)', key: 'integer', category: '数字' },
  { label: '浮点数', key: 'float', category: '数字' },
  { label: '布尔值', key: 'boolean', category: '数字' },
  { label: '中文段落', key: 'paragraph', category: '文本' },
  { label: '中文句子', key: 'sentence', category: '文本' },
  { label: '英文单词', key: 'word', category: '文本' },
  { label: '颜色 HEX', key: 'color', category: '其他' },
  { label: '图片URL', key: 'image', category: '其他' },
  { label: 'UUID', key: 'uuid', category: '其他' },
];

const mockPresetCategories = computed(() => {
  const map = new Map<string, typeof mockPresets>();
  for (const p of mockPresets) {
    if (!map.has(p.category)) map.set(p.category, []);
    map.get(p.category)!.push(p);
  }
  return Array.from(map.entries());
});

function generateMockData() {
  const results: any[] = [];
  for (let i = 0; i < mockCount.value; i++) {
    if (mockType.value === 'preset') {
      results.push(generateMockValue(mockPreset.value));
    } else {
      // 自定义模板模式
      try {
        const tpl = JSON.parse(mockCustomTpl.value);
        results.push(generateMockFromTemplate(tpl));
      } catch (e: any) {
        mockOutput.value = '模板 JSON 解析失败：' + e.message;
        return;
      }
    }
  }
  mockOutput.value = JSON.stringify(results, null, 2);
}

function generateMockFromTemplate(tpl: any): any {
  if (typeof tpl === 'string') {
    // 检查是否是 mock 占位符，如 "@name" "@phone"
    const m = tpl.match(/^@(\w+)$/);
    if (m) return generateMockValue(m[1]);
    // 替换内嵌占位符 "Hello @name, your phone is @phone"
    return tpl.replace(/@(\w+)/g, (_, key: string) => String(generateMockValue(key)));
  }
  if (Array.isArray(tpl)) return tpl.map(item => generateMockFromTemplate(item));
  if (typeof tpl === 'object' && tpl !== null) {
    const result: Record<string, any> = {};
    for (const [key, val] of Object.entries(tpl)) {
      result[key] = generateMockFromTemplate(val);
    }
    return result;
  }
  return tpl;
}

// 姓/名素材库
const _surnames = '赵钱孙李周吴郑王冯陈褚卫蒋沈韩杨朱秦尤许何吕施张孔曹严华金魏陶姜戚谢邹喻柏水窦章云苏潘葛奚范彭郎鲁韦昌马苗凤花方俞任袁柳鲍史唐费廉岑薛雷贺倪汤滕殷罗毕郝邬安常乐于时傅皮卞齐康伍余元卜顾孟平黄和穆萧尹姚邵湛汪祁毛禹狄米贝明臧计伏成戴宋茅庞熊纪舒屈项祝董粱杜阮蓝闵席季麻强贾路娄危江童颜郭梅盛林刁钟徐邱骆高夏蔡田樊胡凌霍虞万支柯昝管卢莫经房裘缪干解应宗丁宣贲邓';
const _names = '伟刚勇毅俊峰强军平保东文辉力明永健世广志义兴良海山仁波宁贵福生龙元全国胜学祥才发武新利清飞彬富顺信子杰涛昌成康星光天达安岩中茂进林有坚和彪博诚先敬震振壮会思群豪心邦承乐绍功松善厚庆磊民友裕河哲江超浩亮政谦亨奇固之轮翰朗伯宏言若鸣朋斌梦龙佳涵蕾欣瑶婷桂萍雪珍琳晶莹倩玲珊素娜静淑惠雅秀巧慧丽美华翠容仪娟芳茜琴兰凤洁诗桃玉萌岚';
const _provinces = ['北京', '上海', '广东', '浙江', '江苏', '四川', '湖北', '湖南', '山东', '河南', '福建', '重庆', '天津', '河北', '辽宁', '吉林', '安徽', '江西', '陕西', '广西', '云南', '贵州', '甘肃', '海南', '山西', '内蒙古', '黑龙江', '新疆', '西藏', '青海', '宁夏'];
const _cities = ['市区', '新城区', '开发区', '高新区', '经济区', '科技园区'];
const _roads = ['人民路', '中山路', '解放路', '建设路', '和平路', '文化路', '长江路', '南京路', '北京路', '上海路', '科技路', '创新路', '学府路', '民主路', '富强路'];
const _firstNames = ['James', 'John', 'Robert', 'Michael', 'David', 'William', 'Richard', 'Joseph', 'Thomas', 'Charles', 'Mary', 'Patricia', 'Jennifer', 'Linda', 'Barbara', 'Elizabeth', 'Susan', 'Jessica', 'Sarah', 'Karen', 'Emily', 'Emma', 'Olivia', 'Ava', 'Sophia'];
const _lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Wilson', 'Anderson', 'Taylor', 'Thomas', 'Moore', 'Jackson', 'Martin', 'Lee', 'Thompson', 'White', 'Harris', 'Clark'];
const _domains = ['example.com', 'test.org', 'demo.net', 'sample.io', 'mock.dev', 'fake.co', 'data.app'];
const _words = ['lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit', 'sed', 'do', 'eiusmod', 'tempor', 'incididunt', 'labore', 'et', 'magna', 'aliqua', 'ut', 'enim', 'ad', 'minim', 'veniam', 'quis', 'nostrud', 'exercitation'];
const _cnWords = '天地玄黄宇宙洪荒日月盈昃辰宿列张寒来暑往秋收冬藏闰余成岁律吕调阳云腾致雨露结为霜金生丽水玉出昆冈剑号巨阙珠称夜光果珍李柰菜重芥姜海咸河淡鳞潜羽翔龙师火帝鸟官人皇始制文字乃服衣裳推位让国有虞陶唐';

function randInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randItem(arr: string): string;
function randItem<T>(arr: T[]): T;
function randItem(arr: any[] | string): any { return arr[randInt(0, arr.length - 1)]; }
function randPhone() { return '1' + randItem('3456789') + Array.from({ length: 9 }, () => randInt(0, 9)).join(''); }
function randDate(start = 2020, end = 2025) {
  const y = randInt(start, end), m = randInt(1, 12), d = randInt(1, 28);
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
function randTime() { return `${String(randInt(0, 23)).padStart(2, '0')}:${String(randInt(0, 59)).padStart(2, '0')}:${String(randInt(0, 59)).padStart(2, '0')}`; }

function generateMockValue(key: string): any {
  switch (key) {
    case 'name': return randItem(_surnames) + randItem(_names) + (Math.random() > 0.5 ? '' : String(randItem(_names)));
    case 'nameEn': return randItem(_firstNames) + ' ' + randItem(_lastNames);
    case 'phone': return randPhone();
    case 'email': return randItem(_firstNames).toString().toLowerCase() + randInt(10, 999) + '@' + randItem(_domains);
    case 'idcard': {
      const area = String(randInt(110000, 659999));
      const birth = randDate(1970, 2005).replace(/-/g, '');
      const seq = String(randInt(100, 999));
      const checkDigits = '0123456789X';
      return area + birth + seq + randItem(checkDigits);
    }
    case 'address': return randItem(_provinces) + '省' + randItem(_provinces) + randItem(_cities) + randItem(_roads) + randInt(1, 200) + '号';
    case 'ip': return `${randInt(1, 254)}.${randInt(0, 255)}.${randInt(0, 255)}.${randInt(1, 254)}`;
    case 'url': return `https://${randItem(_domains)}/${randItem(_words)}/${randItem(_words)}`;
    case 'domain': return randItem(['www', 'api', 'app', 'dev', 'test']) + '.' + randItem(_domains);
    case 'datetime': return randDate() + ' ' + randTime();
    case 'date': return randDate();
    case 'time': return randTime();
    case 'integer': return randInt(0, 9999);
    case 'float': return parseFloat((Math.random() * 10000).toFixed(2));
    case 'boolean': return Math.random() > 0.5;
    case 'paragraph': {
      const len = randInt(2, 5);
      return Array.from({ length: len }, () => {
        const sLen = randInt(8, 20);
        return Array.from({ length: sLen }, () => randItem(_cnWords)).join('') + '。';
      }).join('');
    }
    case 'sentence': {
      const sLen = randInt(8, 20);
      return Array.from({ length: sLen }, () => randItem(_cnWords)).join('') + '。';
    }
    case 'word': return randItem(_words);
    case 'color': return '#' + Array.from({ length: 6 }, () => '0123456789ABCDEF'[randInt(0, 15)]).join('');
    case 'image': return `https://picsum.photos/${randInt(2, 8) * 100}/${randInt(2, 6) * 100}`;
    case 'uuid': return crypto.randomUUID();
    default: return randItem(_words);
  }
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

/* ==================== 占位图生成工具 ==================== */

const phWidth = ref(400);
const phHeight = ref(300);
const phBgColor = ref('#CCCCCC');
const phTextColor = ref('#666666');
const phText = ref('');
const phFontSize = ref(0);
const phFormat = ref<'png' | 'svg'>('png');
const phDataUrl = ref('');

function generatePlaceholder() {
  const w = phWidth.value;
  const h = phHeight.value;
  const text = phText.value || `${w} × ${h}`;
  const fontSize = phFontSize.value || Math.max(12, Math.min(w, h) / 8);

  if (phFormat.value === 'svg') {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <rect width="100%" height="100%" fill="${phBgColor.value}"/>
  <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle"
    font-family="Arial, sans-serif" font-size="${fontSize}" fill="${phTextColor.value}">${escapeHtml(text)}</text>
</svg>`;
    phDataUrl.value = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  } else {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = phBgColor.value;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = phTextColor.value;
    ctx.font = `${fontSize}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2);
    phDataUrl.value = canvas.toDataURL('image/png');
  }
}

function downloadPlaceholder() {
  if (!phDataUrl.value) return;
  const a = document.createElement('a');
  a.href = phDataUrl.value;
  a.download = `placeholder-${phWidth.value}x${phHeight.value}.${phFormat.value}`;
  a.click();
}

/* ==================== JSON Diff 工具 ==================== */

const jdLeft = ref('');
const jdRight = ref('');
const jdOutput = ref<{ path: string; type: 'added' | 'removed' | 'changed'; oldVal?: string; newVal?: string }[]>([]);
const jdError = ref('');

function compareJson() {
  jdOutput.value = []; jdError.value = '';
  try {
    const a = JSON.parse(jdLeft.value);
    const b = JSON.parse(jdRight.value);
    const diffs: typeof jdOutput.value = [];
    function walk(objA: any, objB: any, path: string) {
      const keysA = objA != null && typeof objA === 'object' ? Object.keys(objA) : [];
      const keysB = objB != null && typeof objB === 'object' ? Object.keys(objB) : [];
      const allKeys = [...new Set([...keysA, ...keysB])];
      for (const key of allKeys) {
        const p = path ? (Array.isArray(objA) || Array.isArray(objB) ? `${path}[${key}]` : `${path}.${key}`) : key;
        const inA = objA != null && typeof objA === 'object' && key in objA;
        const inB = objB != null && typeof objB === 'object' && key in objB;
        if (inA && !inB) {
          diffs.push({ path: p, type: 'removed', oldVal: JSON.stringify(objA[key]) });
        } else if (!inA && inB) {
          diffs.push({ path: p, type: 'added', newVal: JSON.stringify(objB[key]) });
        } else if (inA && inB) {
          const va = objA[key], vb = objB[key];
          if (typeof va === 'object' && va !== null && typeof vb === 'object' && vb !== null) {
            walk(va, vb, p);
          } else if (va !== vb) {
            diffs.push({ path: p, type: 'changed', oldVal: JSON.stringify(va), newVal: JSON.stringify(vb) });
          }
        }
      }
    }
    walk(a, b, '$');
    jdOutput.value = diffs;
  } catch (e: any) { jdError.value = e.message; }
}

/* ==================== AES 加解密工具 ==================== */

const encMode = ref<'encrypt' | 'decrypt'>('encrypt');
const encAlgo = ref<'AES-CBC' | 'AES-GCM'>('AES-GCM');
const encInput = ref('');
const encKey = ref('');
const encOutput = ref('');
const encError = ref('');

async function deriveKey(password: string, salt: BufferSource, algo: string): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: algo, length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

function arrayBufferToBase64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return btoa(String.fromCharCode(...bytes));
}
function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

async function doEncrypt() {
  encOutput.value = ''; encError.value = '';
  if (!encInput.value || !encKey.value) { encError.value = '请输入内容和密钥'; return; }
  try {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(encAlgo.value === 'AES-GCM' ? 12 : 16));
    const key = await deriveKey(encKey.value, salt, encAlgo.value);
    const data = new TextEncoder().encode(encInput.value);
    const encrypted = await crypto.subtle.encrypt(
      encAlgo.value === 'AES-GCM' ? { name: 'AES-GCM', iv } : { name: 'AES-CBC', iv },
      key, data
    );
    // 格式: algo:salt:iv:ciphertext (全部 base64)
    encOutput.value = `${encAlgo.value}:${arrayBufferToBase64(salt)}:${arrayBufferToBase64(iv)}:${arrayBufferToBase64(encrypted)}`;
  } catch (e: any) { encError.value = '加密失败：' + e.message; }
}

async function doDecrypt() {
  encOutput.value = ''; encError.value = '';
  if (!encInput.value || !encKey.value) { encError.value = '请输入密文和密钥'; return; }
  try {
    const parts = encInput.value.split(':');
    if (parts.length !== 4) { encError.value = '密文格式无效（需要 algo:salt:iv:data）'; return; }
    const [algo, saltB64, ivB64, dataB64] = parts;
    const salt = new Uint8Array(base64ToArrayBuffer(saltB64));
    const iv = new Uint8Array(base64ToArrayBuffer(ivB64));
    const ciphertext = base64ToArrayBuffer(dataB64);
    const key = await deriveKey(encKey.value, salt, algo);
    const decrypted = await crypto.subtle.decrypt(
      algo === 'AES-GCM' ? { name: 'AES-GCM', iv } : { name: 'AES-CBC', iv },
      key, ciphertext
    );
    encOutput.value = new TextDecoder().decode(decrypted);
  } catch (e: any) { encError.value = '解密失败：密钥错误或密文损坏'; }
}

function generateEncKey() {
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  encKey.value = arrayBufferToBase64(arr);
}

/* ==================== Unicode 工具 ==================== */

const uniInput = ref('');
const uniOutput = ref('');

const uniAnalysis = computed(() => {
  if (!uniInput.value) return [];
  return Array.from(uniInput.value).map(char => {
    const code = char.codePointAt(0)!;
    return {
      char,
      decimal: code,
      hex: code.toString(16).toUpperCase().padStart(4, '0'),
      unicode: code > 0xFFFF ? `U+${code.toString(16).toUpperCase()}` : `U+${code.toString(16).toUpperCase().padStart(4, '0')}`,
      jsEscape: code > 0xFFFF ? `\\u{${code.toString(16)}}` : `\\u${code.toString(16).padStart(4, '0')}`,
      htmlEntity: `&#${code};`,
      htmlHex: `&#x${code.toString(16)};`,
      utf8Bytes: new TextEncoder().encode(char).length,
      category: getUnicodeCategory(code),
    };
  });
});

function getUnicodeCategory(code: number): string {
  if (code <= 0x7F) return 'ASCII';
  if (code >= 0x4E00 && code <= 0x9FFF) return 'CJK 基本汉字';
  if (code >= 0x3400 && code <= 0x4DBF) return 'CJK 扩展A';
  if (code >= 0x3000 && code <= 0x303F) return 'CJK 符号';
  if (code >= 0x3040 && code <= 0x309F) return '日文平假名';
  if (code >= 0x30A0 && code <= 0x30FF) return '日文片假名';
  if (code >= 0xAC00 && code <= 0xD7AF) return '韩文音节';
  if (code >= 0x0080 && code <= 0x00FF) return 'Latin-1 补充';
  if (code >= 0x0100 && code <= 0x024F) return 'Latin 扩展';
  if (code >= 0x0370 && code <= 0x03FF) return '希腊字母';
  if (code >= 0x0400 && code <= 0x04FF) return '西里尔字母';
  if (code >= 0x0600 && code <= 0x06FF) return '阿拉伯文';
  if (code >= 0x1F600 && code <= 0x1F64F) return 'Emoji 表情';
  if (code >= 0x1F300 && code <= 0x1F5FF) return 'Emoji 符号';
  if (code >= 0x2000 && code <= 0x206F) return '常用标点';
  if (code >= 0xFF00 && code <= 0xFFEF) return '全角字符';
  if (code >= 0xFE30 && code <= 0xFE4F) return 'CJK 兼容';
  return '其他';
}

function unicodeEscape() {
  uniOutput.value = Array.from(uniInput.value).map(c => {
    const code = c.codePointAt(0)!;
    return code > 0xFFFF ? `\\u{${code.toString(16)}}` : `\\u${code.toString(16).padStart(4, '0')}`;
  }).join('');
}

function unicodeUnescape() {
  try {
    uniOutput.value = uniInput.value.replace(/\\u\{([0-9a-fA-F]+)\}|\\u([0-9a-fA-F]{4})/g, (_, hex1: string, hex2: string) =>
      String.fromCodePoint(parseInt(hex1 || hex2, 16))
    );
  } catch (e: any) { uniOutput.value = '解码失败：' + e.message; }
}

/* ==================== 数字格式化工具 ==================== */

const numInput = ref('');

const numFormats = computed(() => {
  const s = numInput.value.trim();
  if (!s) return null;
  const n = Number(s);
  if (isNaN(n)) return null;
  const abs = Math.abs(n);

  // 千分位
  const thousands = n.toLocaleString('zh-CN');
  // 货币
  const cny = new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(n);
  const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
  // 科学计数
  const scientific = n.toExponential();
  // 百分比
  const percent = (n * 100).toFixed(2) + '%';
  // 大写金额
  const upperCny = numberToChineseUpper(n);
  // 文件大小
  const fileSize = formatFileSize(abs);
  // 进制
  const intN = Math.floor(abs);
  const bin = intN.toString(2);
  const oct = intN.toString(8);
  const hex = intN.toString(16).toUpperCase();
  // 罗马数字
  const roman = intN > 0 && intN <= 3999 ? toRoman(intN) : '-';
  // 中文数字
  const chineseNum = numberToChinese(abs);

  return { thousands, cny, usd, scientific, percent, upperCny, fileSize, bin, oct, hex, roman, chineseNum };
});

function numberToChineseUpper(n: number): string {
  if (n === 0) return '零元整';
  const digits = '零壹贰叁肆伍陆柒捌玖';
  const units = ['', '拾', '佰', '仟'];
  const bigUnits = ['', '万', '亿', '兆'];
  const isNeg = n < 0;
  const abs = Math.abs(n);
  const intPart = Math.floor(abs);
  const decPart = Math.round((abs - intPart) * 100);
  const jiao = Math.floor(decPart / 10);
  const fen = decPart % 10;

  let result = '';
  if (intPart === 0) {
    result = '零';
  } else {
    const str = String(intPart);
    const groups: string[] = [];
    for (let i = str.length; i > 0; i -= 4) groups.unshift(str.slice(Math.max(0, i - 4), i));
    for (let gi = 0; gi < groups.length; gi++) {
      const g = groups[gi];
      let groupStr = '';
      let hasZero = false;
      for (let i = 0; i < g.length; i++) {
        const d = parseInt(g[i]);
        const unitIdx = g.length - 1 - i;
        if (d === 0) { hasZero = true; }
        else { if (hasZero) { groupStr += '零'; hasZero = false; } groupStr += digits[d] + units[unitIdx]; }
      }
      if (groupStr) result += groupStr + bigUnits[groups.length - 1 - gi];
    }
  }

  result += '元';
  if (jiao === 0 && fen === 0) { result += '整'; }
  else {
    if (jiao > 0) result += digits[jiao] + '角';
    else if (fen > 0) result += '零';
    if (fen > 0) result += digits[fen] + '分';
  }
  return (isNeg ? '负' : '') + result;
}

function numberToChinese(n: number): string {
  if (n === 0) return '零';
  const digits = '零一二三四五六七八九';
  const units = ['', '十', '百', '千'];
  const bigUnits = ['', '万', '亿'];
  const intPart = Math.floor(n);
  const str = String(intPart);
  const groups: string[] = [];
  for (let i = str.length; i > 0; i -= 4) groups.unshift(str.slice(Math.max(0, i - 4), i));
  let result = '';
  for (let gi = 0; gi < groups.length; gi++) {
    const g = groups[gi];
    let groupStr = '';
    let hasZero = false;
    for (let i = 0; i < g.length; i++) {
      const d = parseInt(g[i]);
      const unitIdx = g.length - 1 - i;
      if (d === 0) { hasZero = true; }
      else { if (hasZero) { groupStr += '零'; hasZero = false; } groupStr += digits[d] + units[unitIdx]; }
    }
    if (groupStr) result += groupStr + bigUnits[groups.length - 1 - gi];
  }
  // 十几的情况省略前导一
  if (result.startsWith('一十')) result = result.slice(1);
  return result;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + units[i];
}

function toRoman(num: number): string {
  const map: [number, string][] = [[1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],[100,'C'],[90,'XC'],[50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']];
  let result = '';
  for (const [val, sym] of map) { while (num >= val) { result += sym; num -= val; } }
  return result;
}

/* ==================== 二维码生成工具 ==================== */

const qrText = ref('');
const qrSize = ref(256);
const qrErrorLevel = ref<'L' | 'M' | 'Q' | 'H'>('M');
const qrFgColor = ref('#000000');
const qrBgColor = ref('#FFFFFF');
const qrDataUrl = ref('');

// 简化版 QR Code 生成器（支持数字/字母/低 ASCII）
function generateQrCode() {
  if (!qrText.value) return;
  const modules = encodeQR(qrText.value, qrErrorLevel.value);
  if (!modules) { qrDataUrl.value = ''; return; }
  const size = qrSize.value;
  const moduleCount = modules.length;
  const cellSize = size / moduleCount;

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = qrBgColor.value;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = qrFgColor.value;
  for (let r = 0; r < moduleCount; r++) {
    for (let c = 0; c < moduleCount; c++) {
      if (modules[r][c]) {
        ctx.fillRect(Math.round(c * cellSize), Math.round(r * cellSize), Math.ceil(cellSize), Math.ceil(cellSize));
      }
    }
  }
  qrDataUrl.value = canvas.toDataURL('image/png');
}

// 最小 QR Code 实现 - 使用 QR Code Model 2
function encodeQR(text: string, ecLevel: string): boolean[][] | null {
  // 使用 Byte mode 编码
  const data = new TextEncoder().encode(text);
  // 根据数据长度选择版本
  const version = selectVersion(data.length, ecLevel);
  if (version < 1 || version > 10) return null; // 限制版本 1-10
  const size = version * 4 + 17;
  const modules: (boolean | null)[][] = Array.from({ length: size }, () => Array(size).fill(null));

  // 放置功能图案
  placeFinder(modules, 0, 0);
  placeFinder(modules, size - 7, 0);
  placeFinder(modules, 0, size - 7);
  placeTiming(modules, size);
  if (version >= 2) placeAlignment(modules, version);

  // 预留格式信息区域
  reserveFormatArea(modules, size);

  // 编码数据
  const encoded = encodeData(data, version, ecLevel);
  if (!encoded) return null;

  // 放置数据
  placeData(modules, encoded, size);

  // 应用掩码 (使用掩码0简化)
  applyMask(modules, size, 0);

  // 写入格式信息
  writeFormatInfo(modules, size, ecLevel, 0);

  return modules.map(row => row.map(v => v === true));
}

function selectVersion(dataLen: number, ecLevel: string): number {
  // 每个版本在不同纠错级别下的 byte mode 容量
  const caps: Record<string, number[]> = {
    'L': [17, 32, 53, 78, 106, 134, 154, 192, 230, 271],
    'M': [14, 26, 42, 62, 84, 106, 122, 152, 180, 213],
    'Q': [11, 20, 32, 46, 60, 74, 86, 108, 130, 151],
    'H': [7, 14, 24, 34, 44, 58, 64, 84, 98, 119],
  };
  const cap = caps[ecLevel] || caps['M'];
  for (let i = 0; i < cap.length; i++) { if (dataLen <= cap[i]) return i + 1; }
  return -1;
}

function placeFinder(modules: (boolean | null)[][], row: number, col: number) {
  for (let r = -1; r <= 7; r++) {
    for (let c = -1; c <= 7; c++) {
      const rr = row + r, cc = col + c;
      if (rr < 0 || cc < 0 || rr >= modules.length || cc >= modules.length) continue;
      const isBlack = (r >= 0 && r <= 6 && (c === 0 || c === 6)) || (c >= 0 && c <= 6 && (r === 0 || r === 6)) || (r >= 2 && r <= 4 && c >= 2 && c <= 4);
      modules[rr][cc] = isBlack;
    }
  }
}

function placeTiming(modules: (boolean | null)[][], size: number) {
  for (let i = 8; i < size - 8; i++) {
    if (modules[6][i] === null) modules[6][i] = i % 2 === 0;
    if (modules[i][6] === null) modules[i][6] = i % 2 === 0;
  }
}

function placeAlignment(modules: (boolean | null)[][], version: number) {
  const positions = getAlignmentPositions(version);
  for (const r of positions) {
    for (const c of positions) {
      if (modules[r][c] !== null) continue; // 跳过与 finder 重叠
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const isBlack = Math.abs(dr) === 2 || Math.abs(dc) === 2 || (dr === 0 && dc === 0);
          modules[r + dr][c + dc] = isBlack;
        }
      }
    }
  }
}

function getAlignmentPositions(version: number): number[] {
  if (version === 1) return [];
  const positions: number[][] = [[], [6,18],[6,22],[6,26],[6,30],[6,34],[6,22,38],[6,24,42],[6,26,46],[6,28,50]];
  return positions[version] || [];
}

function reserveFormatArea(modules: (boolean | null)[][], size: number) {
  for (let i = 0; i < 8; i++) {
    if (modules[8][i] === null) modules[8][i] = false;
    if (modules[i][8] === null) modules[i][8] = false;
    if (modules[8][size - 1 - i] === null) modules[8][size - 1 - i] = false;
    if (modules[size - 1 - i][8] === null) modules[size - 1 - i][8] = false;
  }
  modules[size - 8][8] = true; // Dark module
}

function encodeData(data: Uint8Array, version: number, ecLevel: string): Uint8Array | null {
  // 数据位流
  const bits: number[] = [];
  // Mode indicator: 0100 (byte mode)
  bits.push(0, 1, 0, 0);
  // Character count (8 bits for version 1-9, 16 for 10+)
  const countBits = version <= 9 ? 8 : 16;
  for (let i = countBits - 1; i >= 0; i--) bits.push((data.length >> i) & 1);
  // Data
  for (const byte of data) { for (let i = 7; i >= 0; i--) bits.push((byte >> i) & 1); }
  // Terminator
  const totalDataBits = getDataCapacityBits(version, ecLevel);
  const terminatorLen = Math.min(4, totalDataBits - bits.length);
  for (let i = 0; i < terminatorLen; i++) bits.push(0);
  // Pad to byte boundary
  while (bits.length % 8 !== 0) bits.push(0);
  // Pad bytes
  const padBytes = [0xEC, 0x11];
  let padIdx = 0;
  while (bits.length < totalDataBits) {
    for (let i = 7; i >= 0; i--) bits.push((padBytes[padIdx] >> i) & 1);
    padIdx = (padIdx + 1) % 2;
  }
  // Convert to bytes
  const dataBytes: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | (bits[i + j] || 0);
    dataBytes.push(byte);
  }
  // Generate EC codewords using Reed-Solomon
  const ecInfo = getEcInfo(version, ecLevel);
  const result: number[] = [];
  let offset = 0;
  const dataBlocks: number[][] = [];
  const ecBlocks: number[][] = [];
  for (const block of ecInfo.blocks) {
    for (let b = 0; b < block.count; b++) {
      const blockData = dataBytes.slice(offset, offset + block.dataCodewords);
      offset += block.dataCodewords;
      dataBlocks.push(blockData);
      ecBlocks.push(generateEC(blockData, ecInfo.ecCodewordsPerBlock));
    }
  }
  // Interleave
  const maxDataLen = Math.max(...dataBlocks.map(b => b.length));
  const maxEcLen = ecInfo.ecCodewordsPerBlock;
  for (let i = 0; i < maxDataLen; i++) { for (const block of dataBlocks) { if (i < block.length) result.push(block[i]); } }
  for (let i = 0; i < maxEcLen; i++) { for (const block of ecBlocks) { if (i < block.length) result.push(block[i]); } }
  // Convert to bit array
  const resultBits = new Uint8Array(result.length * 8);
  for (let i = 0; i < result.length; i++) {
    for (let j = 0; j < 8; j++) resultBits[i * 8 + j] = (result[i] >> (7 - j)) & 1;
  }
  return resultBits;
}

function getDataCapacityBits(version: number, ecLevel: string): number {
  const table: Record<string, number[]> = {
    'L': [152,272,440,640,864,1088,1248,1552,1856,2192],
    'M': [128,224,352,512,688,864,992,1232,1456,1728],
    'Q': [104,176,272,384,496,608,704,880,1056,1232],
    'H': [72,128,208,288,368,480,528,688,800,976],
  };
  return (table[ecLevel] || table['M'])[version - 1] || 0;
}

function getEcInfo(version: number, ecLevel: string): { ecCodewordsPerBlock: number; blocks: { count: number; dataCodewords: number }[] } {
  // 简化的 EC 信息表 (版本 1-10)
  const table: Record<string, { ec: number; blocks: [number, number][] }[]> = {
    'L': [
      { ec: 7, blocks: [[1,19]] }, { ec: 10, blocks: [[1,34]] }, { ec: 15, blocks: [[1,55]] },
      { ec: 20, blocks: [[1,80]] }, { ec: 26, blocks: [[1,108]] }, { ec: 18, blocks: [[2,68]] },
      { ec: 20, blocks: [[2,78]] }, { ec: 24, blocks: [[2,97]] }, { ec: 30, blocks: [[2,116]] },
      { ec: 18, blocks: [[2,68],[2,69]] },
    ],
    'M': [
      { ec: 10, blocks: [[1,16]] }, { ec: 16, blocks: [[1,28]] }, { ec: 26, blocks: [[1,44]] },
      { ec: 18, blocks: [[2,32]] }, { ec: 24, blocks: [[2,43]] }, { ec: 16, blocks: [[4,27]] },
      { ec: 18, blocks: [[4,31]] }, { ec: 22, blocks: [[2,38],[2,39]] }, { ec: 22, blocks: [[3,36],[2,37]] },
      { ec: 26, blocks: [[4,43],[1,44]] },
    ],
    'Q': [
      { ec: 13, blocks: [[1,13]] }, { ec: 22, blocks: [[1,22]] }, { ec: 18, blocks: [[2,17]] },
      { ec: 26, blocks: [[2,24]] }, { ec: 18, blocks: [[2,15],[2,16]] }, { ec: 24, blocks: [[4,19]] },
      { ec: 18, blocks: [[2,14],[4,15]] }, { ec: 22, blocks: [[4,18],[2,19]] }, { ec: 20, blocks: [[4,16],[4,17]] },
      { ec: 24, blocks: [[6,19],[2,20]] },
    ],
    'H': [
      { ec: 17, blocks: [[1,9]] }, { ec: 28, blocks: [[1,16]] }, { ec: 22, blocks: [[2,13]] },
      { ec: 16, blocks: [[4,9]] }, { ec: 22, blocks: [[2,11],[2,12]] }, { ec: 28, blocks: [[4,15]] },
      { ec: 26, blocks: [[4,13],[1,14]] }, { ec: 26, blocks: [[4,14],[2,15]] }, { ec: 24, blocks: [[4,12],[4,13]] },
      { ec: 28, blocks: [[6,15],[2,16]] },
    ],
  };
  const info = (table[ecLevel] || table['M'])[version - 1];
  return {
    ecCodewordsPerBlock: info.ec,
    blocks: info.blocks.map(([count, data]) => ({ count, dataCodewords: data })),
  };
}

// GF(256) Reed-Solomon
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(function initGF() {
  let x = 1;
  for (let i = 0; i < 255; i++) { GF_EXP[i] = x; GF_LOG[x] = i; x = (x << 1) ^ (x & 0x80 ? 0x11D : 0); }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function generateEC(data: number[], ecCount: number): number[] {
  // Generator polynomial
  let gen = [1];
  for (let i = 0; i < ecCount; i++) {
    const newGen = new Array(gen.length + 1).fill(0);
    for (let j = 0; j < gen.length; j++) {
      newGen[j] ^= gen[j];
      newGen[j + 1] ^= gfMul(gen[j], GF_EXP[i]);
    }
    gen = newGen;
  }
  const result = new Array(ecCount).fill(0);
  const msg = [...data, ...result];
  for (let i = 0; i < data.length; i++) {
    const coeff = msg[i];
    if (coeff !== 0) {
      for (let j = 0; j < gen.length; j++) msg[i + j] ^= gfMul(gen[j], coeff);
    }
  }
  return msg.slice(data.length);
}

function placeData(modules: (boolean | null)[][], bits: Uint8Array, size: number) {
  let bitIdx = 0;
  let upward = true;
  for (let col = size - 1; col >= 0; col -= 2) {
    if (col === 6) col = 5; // 跳过 timing column
    const rows = upward ? Array.from({ length: size }, (_, i) => size - 1 - i) : Array.from({ length: size }, (_, i) => i);
    for (const row of rows) {
      for (let dc = 0; dc <= 1; dc++) {
        const c = col - dc;
        if (c < 0) continue;
        if (modules[row][c] !== null) continue;
        modules[row][c] = bitIdx < bits.length ? bits[bitIdx++] === 1 : false;
      }
    }
    upward = !upward;
  }
}

function applyMask(modules: (boolean | null)[][], size: number, mask: number) {
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (isFunction(modules, r, c, size)) continue;
      let swap = false;
      switch (mask) {
        case 0: swap = (r + c) % 2 === 0; break;
        case 1: swap = r % 2 === 0; break;
        case 2: swap = c % 3 === 0; break;
        case 3: swap = (r + c) % 3 === 0; break;
      }
      if (swap) modules[r][c] = !modules[r][c];
    }
  }
}

function isFunction(modules: (boolean | null)[][], r: number, c: number, size: number): boolean {
  // Finder + separator areas
  if ((r < 9 && c < 9) || (r < 9 && c >= size - 8) || (r >= size - 8 && c < 9)) return true;
  // Timing
  if (r === 6 || c === 6) return true;
  return false;
}

function writeFormatInfo(modules: (boolean | null)[][], size: number, ecLevel: string, mask: number) {
  const ecBits: Record<string, number> = { 'L': 1, 'M': 0, 'Q': 3, 'H': 2 };
  const formatData = (ecBits[ecLevel] << 3) | mask;
  // Pre-calculated format info with BCH error correction + XOR mask
  const formatStrings: number[] = [
    0x5412, 0x5125, 0x5E7C, 0x5B4B, 0x45F9, 0x40CE, 0x4F97, 0x4AA0,
    0x77C4, 0x72F3, 0x7DAA, 0x789D, 0x662F, 0x6318, 0x6C41, 0x6976,
    0x1689, 0x13BE, 0x1CE7, 0x19D0, 0x0762, 0x0255, 0x0D0C, 0x083B,
    0x355F, 0x3068, 0x3F31, 0x3A06, 0x24B4, 0x2183, 0x2EDA, 0x2BED,
  ];
  const info = formatStrings[formatData] || 0;
  // Horizontal: modules[8][0..7] and modules[8][size-8..size-1]
  for (let i = 0; i < 8; i++) {
    const bit = (info >> (14 - i)) & 1;
    modules[8][i <= 5 ? i : i + 1] = bit === 1;
    modules[size - 1 - i][8] = bit === 1;
  }
  for (let i = 8; i < 15; i++) {
    const bit = (info >> (14 - i)) & 1;
    modules[14 - i <= 5 ? 14 - i : 15 - i][8] = bit === 1;
    modules[8][size - 15 + i] = bit === 1;
  }
}

function downloadQrCode() {
  if (!qrDataUrl.value) return;
  const a = document.createElement('a');
  a.href = qrDataUrl.value;
  a.download = 'qrcode.png';
  a.click();
}

/* ==================== 文本变换工具 ==================== */

const ttInput = ref('');
const ttOutput = ref('');
const ttMode = ref('camelCase');

const ttModes: { label: string; key: string; category: string }[] = [
  { label: 'camelCase', key: 'camelCase', category: '命名风格' },
  { label: 'PascalCase', key: 'PascalCase', category: '命名风格' },
  { label: 'snake_case', key: 'snake_case', category: '命名风格' },
  { label: 'kebab-case', key: 'kebab-case', category: '命名风格' },
  { label: 'CONSTANT_CASE', key: 'CONSTANT_CASE', category: '命名风格' },
  { label: 'dot.case', key: 'dot.case', category: '命名风格' },
  { label: 'path/case', key: 'path/case', category: '命名风格' },
  { label: 'Title Case', key: 'Title Case', category: '命名风格' },
  { label: '全部大写', key: 'upper', category: '大小写' },
  { label: '全部小写', key: 'lower', category: '大小写' },
  { label: '首字母大写', key: 'capitalize', category: '大小写' },
  { label: '大小写反转', key: 'swapCase', category: '大小写' },
  { label: '行排序 (升序)', key: 'sortAsc', category: '行操作' },
  { label: '行排序 (降序)', key: 'sortDesc', category: '行操作' },
  { label: '行去重', key: 'dedupe', category: '行操作' },
  { label: '行反转', key: 'reverse', category: '行操作' },
  { label: '行打乱', key: 'shuffle', category: '行操作' },
  { label: '去除空行', key: 'removeEmpty', category: '行操作' },
  { label: 'Trim 每行', key: 'trimLines', category: '行操作' },
  { label: '添加行号', key: 'addLineNum', category: '行操作' },
  { label: '去除行号', key: 'removeLineNum', category: '行操作' },
];

const ttModeCategories = computed(() => {
  const map = new Map<string, typeof ttModes>();
  for (const m of ttModes) {
    if (!map.has(m.category)) map.set(m.category, []);
    map.get(m.category)!.push(m);
  }
  return Array.from(map.entries());
});

function transformText() {
  const input = ttInput.value;
  if (!input) { ttOutput.value = ''; return; }

  switch (ttMode.value) {
    // 命名风格 - 先拆分为单词
    case 'camelCase':
    case 'PascalCase':
    case 'snake_case':
    case 'kebab-case':
    case 'CONSTANT_CASE':
    case 'dot.case':
    case 'path/case':
    case 'Title Case': {
      const words = splitToWords(input);
      ttOutput.value = joinWords(words, ttMode.value);
      break;
    }
    case 'upper': ttOutput.value = input.toUpperCase(); break;
    case 'lower': ttOutput.value = input.toLowerCase(); break;
    case 'capitalize': ttOutput.value = input.replace(/\b\w/g, c => c.toUpperCase()); break;
    case 'swapCase': ttOutput.value = Array.from(input).map(c => c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase()).join(''); break;
    case 'sortAsc': ttOutput.value = input.split('\n').sort((a, b) => a.localeCompare(b)).join('\n'); break;
    case 'sortDesc': ttOutput.value = input.split('\n').sort((a, b) => b.localeCompare(a)).join('\n'); break;
    case 'dedupe': ttOutput.value = [...new Set(input.split('\n'))].join('\n'); break;
    case 'reverse': ttOutput.value = input.split('\n').reverse().join('\n'); break;
    case 'shuffle': {
      const lines = input.split('\n');
      for (let i = lines.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [lines[i], lines[j]] = [lines[j], lines[i]]; }
      ttOutput.value = lines.join('\n');
      break;
    }
    case 'removeEmpty': ttOutput.value = input.split('\n').filter(l => l.trim()).join('\n'); break;
    case 'trimLines': ttOutput.value = input.split('\n').map(l => l.trim()).join('\n'); break;
    case 'addLineNum': ttOutput.value = input.split('\n').map((l, i) => `${i + 1}. ${l}`).join('\n'); break;
    case 'removeLineNum': ttOutput.value = input.split('\n').map(l => l.replace(/^\d+[\.\)\]:：、]\s*/, '')).join('\n'); break;
    default: ttOutput.value = input;
  }
}

function splitToWords(text: string): string[] {
  // 处理多种命名风格的分割
  return text
    .replace(/([a-z])([A-Z])/g, '$1 $2') // camelCase -> camel Case
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2') // HTMLParser -> HTML Parser
    .replace(/[-_./]+/g, ' ') // separators
    .trim()
    .split(/\s+/)
    .filter(w => w.length > 0);
}

function joinWords(words: string[], style: string): string {
  const lower = words.map(w => w.toLowerCase());
  switch (style) {
    case 'camelCase': return lower.map((w, i) => i === 0 ? w : w[0].toUpperCase() + w.slice(1)).join('');
    case 'PascalCase': return lower.map(w => w[0].toUpperCase() + w.slice(1)).join('');
    case 'snake_case': return lower.join('_');
    case 'kebab-case': return lower.join('-');
    case 'CONSTANT_CASE': return words.map(w => w.toUpperCase()).join('_');
    case 'dot.case': return lower.join('.');
    case 'path/case': return lower.join('/');
    case 'Title Case': return lower.map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
    default: return words.join(' ');
  }
}

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
    // 跳过空格
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

/* ==================== ASCII 码表工具 ==================== */

const asciiSearch = ref('');

const asciiTable: { dec: number; hex: string; char: string; desc: string }[] = (() => {
  const names: Record<number, string> = {
    0:'NUL 空', 1:'SOH 标题开始', 2:'STX 正文开始', 3:'ETX 正文结束',
    4:'EOT 传输结束', 5:'ENQ 请求', 6:'ACK 确认', 7:'BEL 响铃',
    8:'BS 退格', 9:'HT 水平制表', 10:'LF 换行', 11:'VT 垂直制表',
    12:'FF 换页', 13:'CR 回车', 14:'SO 移出', 15:'SI 移入',
    16:'DLE 数据链路转义', 17:'DC1 设备控制1', 18:'DC2 设备控制2', 19:'DC3 设备控制3',
    20:'DC4 设备控制4', 21:'NAK 拒绝', 22:'SYN 同步', 23:'ETB 传输块结束',
    24:'CAN 取消', 25:'EM 媒介结束', 26:'SUB 替代', 27:'ESC 转义',
    28:'FS 文件分隔', 29:'GS 组分隔', 30:'RS 记录分隔', 31:'US 单元分隔',
    32:'SP 空格', 127:'DEL 删除',
  };
  const table: { dec: number; hex: string; char: string; desc: string }[] = [];
  for (let i = 0; i <= 127; i++) {
    table.push({
      dec: i,
      hex: i.toString(16).toUpperCase().padStart(2, '0'),
      char: i >= 33 && i <= 126 ? String.fromCharCode(i) : (i === 32 ? '␣' : '·'),
      desc: names[i] || String.fromCharCode(i),
    });
  }
  return table;
})();

const filteredAscii = computed(() => {
  const q = asciiSearch.value.trim().toLowerCase();
  if (!q) return asciiTable;
  return asciiTable.filter(a =>
    String(a.dec) === q || a.hex.toLowerCase() === q || a.char.toLowerCase().includes(q) || a.desc.toLowerCase().includes(q)
  );
});

/* ==================== CSS 单位转换工具 ==================== */

const cssValue = ref(16);
const cssBaseFontSize = ref(16);
const cssViewportWidth = ref(1920);
const cssViewportHeight = ref(1080);

const cssUnits = computed(() => {
  const val = cssValue.value;
  const base = cssBaseFontSize.value;
  const vw = cssViewportWidth.value;
  const vh = cssViewportHeight.value;

  return {
    px: val,
    rem: parseFloat((val / base).toFixed(4)),
    em: parseFloat((val / base).toFixed(4)),
    vw: parseFloat((val / vw * 100).toFixed(4)),
    vh: parseFloat((val / vh * 100).toFixed(4)),
    pt: parseFloat((val * 0.75).toFixed(4)),
    percent: parseFloat((val / base * 100).toFixed(4)),
    cm: parseFloat((val / 96 * 2.54).toFixed(4)),
    mm: parseFloat((val / 96 * 25.4).toFixed(4)),
    in: parseFloat((val / 96).toFixed(4)),
  };
});

/* ==================== Markdown 表格生成器 ==================== */

const mdTableRows = ref(3);
const mdTableCols = ref(3);
const mdTableAlign = ref<'left' | 'center' | 'right'>('left');

function insertMdTable() {
  const rows = mdTableRows.value;
  const cols = mdTableCols.value;
  const align = mdTableAlign.value;
  const alignStr = align === 'center' ? ':---:' : align === 'right' ? '---:' : '---';
  const lines: string[] = [];
  // Header
  lines.push('| ' + Array.from({ length: cols }, (_, i) => `列${i + 1}`).join(' | ') + ' |');
  lines.push('| ' + Array.from({ length: cols }, () => alignStr).join(' | ') + ' |');
  // Rows
  for (let r = 0; r < rows; r++) {
    lines.push('| ' + Array.from({ length: cols }, () => '   ').join(' | ') + ' |');
  }
  const table = lines.join('\n');
  // 插入到 markdown input
  mdInput.value = mdInput.value ? mdInput.value + '\n\n' + table : table;
}

/* ==================== 接口文档生成 ==================== */

const API_BASE = ref('http://localhost:3000');
const docProjects = ref<Project[]>([]);
const docGroups = ref<MockGroup[]>([]);
const docScope = ref<'all' | 'project' | 'group'>('all');
const docProjectId = ref<number | null>(null);
const docGroupId = ref<number | null>(null);
const docResult = ref('');
const docLoading = ref(false);

const loadDocData = async () => {
  try {
    const [pRes, gRes] = await Promise.all([
      fetch(`${API_BASE.value}/_admin/projects`),
      fetch(`${API_BASE.value}/_admin/rules`),
    ]);
    docProjects.value = await pRes.json();
    docGroups.value = await gRes.json();
  } catch {}
};

const generateDoc = () => {
  docLoading.value = true;
  let targetGroups: MockGroup[] = [];

  if (docScope.value === 'project' && docProjectId.value) {
    targetGroups = docGroups.value.filter(g => g.projectId === docProjectId.value);
  } else if (docScope.value === 'group' && docGroupId.value) {
    targetGroups = docGroups.value.filter(g => g.id === docGroupId.value);
  } else {
    targetGroups = docGroups.value;
  }

  const lines: string[] = [];
  const title = docScope.value === 'project'
    ? docProjects.value.find(p => p.id === docProjectId.value)?.name || '项目'
    : docScope.value === 'group'
    ? targetGroups[0]?.name || '分组'
    : 'API';

  lines.push(`# ${title} 接口文档`);
  lines.push('');
  lines.push(`> 生成时间：${new Date().toLocaleString('zh-CN')}`);
  lines.push('');

  // 目录
  lines.push('## 目录');
  lines.push('');
  for (const group of targetGroups) {
    lines.push(`- **${group.name}**${group.description ? ` - ${group.description}` : ''}`);
    for (const rule of group.children) {
      const name = rule.name || rule.url;
      lines.push(`  - \`${rule.method}\` ${name}`);
    }
  }
  lines.push('');
  lines.push('---');
  lines.push('');

  // 详细接口
  for (const group of targetGroups) {
    lines.push(`## ${group.name}`);
    if (group.description) lines.push(`> ${group.description}`);
    lines.push('');

    for (const rule of group.children) {
      const name = rule.name || rule.url;
      lines.push(`### ${name}`);
      lines.push('');
      lines.push(`- **方法**: \`${rule.method}\``);
      lines.push(`- **路径**: \`${rule.url}\``);
      lines.push(`- **状态**: ${rule.active ? '✅ 启用' : '❌ 禁用'}`);
      if (rule.delay) lines.push(`- **延迟**: ${rule.delay}ms`);
      lines.push('');

      // 请求头
      const reqHeaders = rule.headers?.filter(h => h.key);
      if (reqHeaders?.length) {
        lines.push('#### 请求头');
        lines.push('');
        lines.push('| Key | Value | 必填 | 说明 |');
        lines.push('|-----|-------|------|------|');
        for (const h of reqHeaders) {
          lines.push(`| ${h.key} | ${h.value || '-'} | ${h.required ? '是' : '否'} | ${h.description || '-'} |`);
        }
        lines.push('');
      }

      // Query 参数
      const params = rule.params?.filter(p => p.key);
      if (params?.length) {
        lines.push('#### Query 参数');
        lines.push('');
        lines.push('| 参数名 | 示例值 | 必填 | 说明 |');
        lines.push('|--------|--------|------|------|');
        for (const p of params) {
          lines.push(`| ${p.key} | ${p.value || '-'} | ${p.required ? '是' : '否'} | ${p.description || '-'} |`);
        }
        lines.push('');
      }

      // 请求体
      if (rule.body && rule.body.type !== 'none') {
        lines.push('#### 请求体');
        lines.push('');
        lines.push(`类型: \`${rule.body.type}\``);
        lines.push('');
        if (rule.body.type === 'json' && rule.body.raw) {
          lines.push('```json');
          try { lines.push(JSON.stringify(JSON.parse(rule.body.raw), null, 2)); }
          catch { lines.push(rule.body.raw); }
          lines.push('```');
        } else if (rule.body.formData?.length) {
          lines.push('| Key | Value | 说明 |');
          lines.push('|-----|-------|------|');
          for (const f of rule.body.formData.filter(f => f.key)) {
            lines.push(`| ${f.key} | ${f.value || '-'} | ${f.description || '-'} |`);
          }
        }
        lines.push('');
      }

      // 响应
      lines.push('#### 响应');
      lines.push('');
      if (rule.responseMode === 'basic') {
        lines.push(`Content-Type: \`${rule.responseType || 'application/json'}\``);
        lines.push('');
        if (rule.responseBasic) {
          const lang = rule.responseType?.includes('json') ? 'json' : 'text';
          lines.push(`\`\`\`${lang}`);
          if (lang === 'json') {
            try { lines.push(JSON.stringify(JSON.parse(rule.responseBasic), null, 2)); }
            catch { lines.push(rule.responseBasic); }
          } else {
            lines.push(rule.responseBasic);
          }
          lines.push('```');
        }
      } else {
        lines.push('> 高级模式（脚本生成响应）');
      }
      lines.push('');
      lines.push('---');
      lines.push('');
    }
  }

  docResult.value = lines.join('\n');
  docLoading.value = false;
};

const copyDoc = () => {
  navigator.clipboard.writeText(docResult.value).then(() => {
    // use a simple alert since we don't import ElMessage here
    alert('已复制到剪贴板');
  });
};

const downloadDoc = () => {
  const blob = new Blob([docResult.value], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `api-doc-${Date.now()}.md`;
  a.click();
  URL.revokeObjectURL(url);
};

onMounted(() => {
  if (window.services) {
    API_BASE.value = window.services.getServerUrl();
  }
  loadDocData();
});
</script>

<template>
  <div class="tools-panel">
    <!-- 左侧分组导航栏 -->
    <aside class="tools-sidebar">
      <div v-for="group in toolGroups" :key="group.categoryEn" class="tool-group">
        <div class="tool-group-title">
          <span class="group-indicator"></span>
          <span>{{ group.categoryEn }}</span>
        </div>
        <div
          v-for="t in group.tools" :key="t.key"
          class="tool-item" :class="{ active: activeTool === t.key }"
          @click="activeTool = t.key"
        >
          <span class="tool-icon">{{ t.icon }}</span>
          <span class="tool-label">{{ t.label }}</span>
        </div>
      </div>
    </aside>

    <!-- 右侧工具内容区域 -->
    <div class="tools-content">
      <div class="tool-card" v-if="currentTool">
        <div class="tool-card-header">
          <h3>{{ currentTool.label }}</h3>
          <p class="tool-desc">{{ currentTool.desc }}</p>
          <div class="tool-card-divider"></div>
        </div>
        <div class="tool-card-body">

          <!-- JSON 格式化 -->
          <template v-if="activeTool === 'json'">
            <div class="tool-row json-editors">
              <div class="tool-col">
                <label>输入</label>
                <div class="editor-box">
                  <CodeEditor v-model="jsonInput" language="json" :isDark="isDark" />
                </div>
              </div>
              <div class="tool-col">
                <label>输出</label>
                <div class="editor-box">
                  <CodeEditor v-model="jsonOutput" language="json" :isDark="isDark" :readonly="true" />
                </div>
              </div>
            </div>
            <div v-if="jsonError" class="tool-error">{{ jsonError }}</div>
            <div v-if="jsonStats" class="json-stats">
              <span>对象: <b>{{ jsonStats.objects }}</b></span>
              <span>数组: <b>{{ jsonStats.arrays }}</b></span>
              <span>键: <b>{{ jsonStats.keys }}</b></span>
              <span>字符串: <b>{{ jsonStats.strings }}</b></span>
              <span>数字: <b>{{ jsonStats.numbers }}</b></span>
              <span>布尔: <b>{{ jsonStats.booleans }}</b></span>
              <span>null: <b>{{ jsonStats.nulls }}</b></span>
              <span>深度: <b>{{ jsonStats.maxDepth }}</b></span>
            </div>
            <div class="tool-toolbar">
              <el-button type="primary" @click="formatJson">格式化</el-button>
              <el-button @click="compressJson">压缩</el-button>
              <el-button @click="escapeJsonString">转义字符串</el-button>
              <el-button @click="unescapeJsonString">反转义</el-button>
              <el-button @click="jsonToCsv">→ CSV</el-button>
              <el-button @click="jsonTryFix">尝试修复</el-button>
              <el-select v-model="jsonIndent" style="width: 90px;" size="default">
                <el-option :value="2" label="2 空格" /><el-option :value="4" label="4 空格" /><el-option :value="1" label="Tab" />
              </el-select>
              <el-button @click="copyText(jsonOutput)" :disabled="!jsonOutput">复制结果</el-button>
            </div>
          </template>

          <!-- JSON → TypeScript Interface -->
          <template v-if="activeTool === 'json2ts'">
            <div class="tool-col" style="margin-bottom: 12px;">
              <label>根 Interface 名称</label>
              <el-input v-model="j2tsRootName" placeholder="Root" style="width: 200px;" />
            </div>
            <div class="tool-row j2ts-editors">
              <div class="tool-col">
                <label>JSON 输入</label>
                <div class="editor-box">
                  <CodeEditor :modelValue="j2tsInput" @change="onJ2tsJsonChange" language="json" :isDark="isDark" />
                </div>
              </div>
              <div class="tool-col">
                <label>TypeScript Interface 输出</label>
                <div class="editor-box">
                  <CodeEditor v-model="j2tsOutput" language="typescript" :isDark="isDark" :readonly="true" />
                </div>
              </div>
            </div>
            <div v-if="j2tsError" class="tool-error">{{ j2tsError }}</div>
            <div class="tool-toolbar">
              <el-button type="primary" @click="jsonToTs">转换</el-button>
              <el-button @click="copyText(j2tsOutput)" :disabled="!j2tsOutput">复制结果</el-button>
            </div>
          </template>

          <!-- URL 编解码 -->
          <template v-if="activeTool === 'url'">
            <div class="tool-row">
              <div class="tool-col">
                <label>输入</label>
                <el-input v-model="urlInput" type="textarea" :rows="6" placeholder="输入文本或 URL..." />
              </div>
              <div class="tool-col">
                <label>输出</label>
                <el-input v-model="urlOutput" type="textarea" :rows="6" readonly />
              </div>
            </div>
            <div class="tool-toolbar">
              <el-button type="primary" @click="urlEncode">编码 (encodeURIComponent)</el-button>
              <el-button type="primary" @click="urlDecode">解码 (decode)</el-button>
              <el-button @click="urlEncodeAll">整体编码 (encodeURI)</el-button>
              <el-button @click="urlParseUrl">解析 URL</el-button>
              <el-button @click="copyText(urlOutput)" :disabled="!urlOutput">复制结果</el-button>
            </div>
            <div v-if="urlParseError" class="tool-error">{{ urlParseError }}</div>
            <div v-if="urlParsed" class="url-parsed">
              <label>URL 解析结果</label>
              <div class="url-parsed-grid">
                <div class="url-parsed-item">
                  <span class="url-parsed-key">协议</span>
                  <span class="url-parsed-val">{{ urlParsed.protocol }}</span>
                </div>
                <div class="url-parsed-item">
                  <span class="url-parsed-key">主机</span>
                  <span class="url-parsed-val">{{ urlParsed.host }}</span>
                </div>
                <div class="url-parsed-item">
                  <span class="url-parsed-key">端口</span>
                  <span class="url-parsed-val">{{ urlParsed.port || '(默认)' }}</span>
                </div>
                <div class="url-parsed-item">
                  <span class="url-parsed-key">路径</span>
                  <span class="url-parsed-val">{{ urlParsed.pathname }}</span>
                </div>
                <div class="url-parsed-item">
                  <span class="url-parsed-key">查询</span>
                  <span class="url-parsed-val">{{ urlParsed.search || '(无)' }}</span>
                </div>
                <div class="url-parsed-item">
                  <span class="url-parsed-key">哈希</span>
                  <span class="url-parsed-val">{{ urlParsed.hash || '(无)' }}</span>
                </div>
              </div>
              <div v-if="urlParsed.params.length" class="url-params-table">
                <label>Query 参数</label>
                <div class="url-param-row url-param-header">
                  <span>Key</span><span>Value</span>
                </div>
                <div v-for="(p, i) in urlParsed.params" :key="i" class="url-param-row">
                  <span>{{ p.key }}</span><span>{{ p.value }}</span>
                </div>
              </div>
            </div>
          </template>

          <!-- Base64 编解码 -->
          <template v-if="activeTool === 'base64'">
            <div class="tool-row">
              <div class="tool-col">
                <label>输入</label>
                <el-input v-model="b64Input" type="textarea" :rows="6" placeholder="输入文本或 Base64 字符串..." @input="b64DetectAndPreview" />
              </div>
              <div class="tool-col">
                <label>输出</label>
                <el-input v-model="b64Output" type="textarea" :rows="6" readonly />
              </div>
            </div>
            <div class="tool-toolbar">
              <el-button type="primary" @click="b64Encode">编码 (Encode)</el-button>
              <el-button type="primary" @click="b64Decode">解码 (Decode)</el-button>
              <el-button @click="b64FromFile">图片转 DataURL</el-button>
              <el-button @click="copyText(b64Output)" :disabled="!b64Output">复制结果</el-button>
            </div>
            <div v-if="b64ImageSrc" class="b64-image-preview">
              <label>{{ b64ImageInfo }}</label>
              <img :src="b64ImageSrc" alt="preview" />
            </div>
          </template>

          <!-- HTML 实体编解码 -->
          <template v-if="activeTool === 'htmlencode'">
            <div class="tool-row">
              <div class="tool-col">
                <label>输入</label>
                <el-input v-model="htmlEncInput" type="textarea" :rows="6" placeholder="输入 HTML 或实体编码文本..." />
              </div>
              <div class="tool-col">
                <label>输出</label>
                <el-input v-model="htmlEncOutput" type="textarea" :rows="6" readonly />
              </div>
            </div>
            <div class="tool-toolbar">
              <el-button type="primary" @click="htmlEntityEncode">编码 (Encode)</el-button>
              <el-button type="primary" @click="htmlEntityDecode">解码 (Decode)</el-button>
              <el-button @click="copyText(htmlEncOutput)" :disabled="!htmlEncOutput">复制结果</el-button>
            </div>
          </template>

          <!-- 时间戳转换 -->
          <template v-if="activeTool === 'timestamp'">
            <div class="tool-hint">
              当前时间戳 — 秒：<code>{{ nowTs }}</code>　毫秒：<code>{{ nowTsMs }}</code>
            </div>
            <div class="tool-row">
              <div class="tool-col">
                <label>输入（时间戳或日期字符串）</label>
                <el-input v-model="tsInput" placeholder="如 1700000000 或 2024-01-01 12:00:00" />
              </div>
              <div class="tool-col" style="flex: 0 0 180px;">
                <label>输出格式</label>
                <el-select v-model="tsFormat" size="default">
                  <el-option v-for="f in tsFormats" :key="f.value" :label="f.label" :value="f.value" />
                </el-select>
              </div>
            </div>
            <div class="tool-col">
              <label>输出</label>
              <el-input v-model="tsOutput" type="textarea" :rows="4" readonly />
            </div>
            <div class="tool-toolbar">
              <el-button type="primary" @click="tsToDate">时间戳 → 日期</el-button>
              <el-button type="primary" @click="dateToTs">日期 → 时间戳</el-button>
              <el-button @click="tsNow">填入当前秒级</el-button>
              <el-button @click="tsNowMs">填入当前毫秒级</el-button>
              <el-button @click="copyText(tsOutput)" :disabled="!tsOutput">复制结果</el-button>
            </div>
          </template>

          <!-- UUID 生成 -->
          <template v-if="activeTool === 'uuid'">
            <div class="tool-row" style="align-items: flex-start;">
              <div class="tool-col" style="flex: 0 0 auto;">
                <label>ID 类型</label>
                <el-radio-group v-model="uuidType" size="small">
                  <el-radio-button value="uuid">UUID v4</el-radio-button>
                  <el-radio-button value="nanoid">NanoID</el-radio-button>
                  <el-radio-button value="objectid">ObjectID</el-radio-button>
                  <el-radio-button value="snowflake">Snowflake</el-radio-button>
                </el-radio-group>
              </div>
              <div v-if="uuidType === 'uuid'" class="tool-col" style="flex: 0 0 auto;">
                <label>UUID 格式</label>
                <el-radio-group v-model="uuidFormat" size="small">
                  <el-radio-button value="standard">标准</el-radio-button>
                  <el-radio-button value="upper">大写</el-radio-button>
                  <el-radio-button value="nodash">无横线</el-radio-button>
                  <el-radio-button value="braces">带括号</el-radio-button>
                </el-radio-group>
              </div>
              <div v-if="uuidType === 'nanoid'" class="tool-col" style="flex: 0 0 140px;">
                <label>长度</label>
                <el-input-number v-model="nanoidLength" :min="4" :max="64" size="small" />
              </div>
              <div class="tool-col" style="flex: 0 0 140px;">
                <label>生成数量</label>
                <el-input-number v-model="uuidCount" :min="1" :max="100" size="small" />
              </div>
            </div>
            <div v-if="uuidType === 'nanoid'" class="tool-col" style="margin-bottom: 12px;">
              <label>字符集</label>
              <el-input v-model="nanoidAlphabet" placeholder="自定义字符集" size="small" />
            </div>
            <div class="tool-col">
              <label>结果</label>
              <el-input v-model="uuidOutput" type="textarea" :rows="8" readonly />
            </div>
            <div class="tool-toolbar">
              <el-button type="primary" @click="generateUUID">生成</el-button>
              <el-button @click="copyText(uuidOutput)" :disabled="!uuidOutput">复制结果</el-button>
            </div>
          </template>

          <!-- 颜色转换 -->
          <template v-if="activeTool === 'color'">
            <div class="color-presets-row">
              <span v-for="p in colorPresets" :key="p.label"
                class="color-preset-swatch" :style="{ background: p.hex }"
                :title="p.label" @click="applyColorPreset(p.hex)"
              ></span>
            </div>
            <div class="color-tool-layout">
              <div class="color-inputs">
                <div class="tool-col">
                  <label>HEX</label>
                  <el-input v-model="colorHex" placeholder="#409EFF" @input="onColorHexInput" />
                </div>
                <div class="tool-col">
                  <label>RGB (R, G, B)</label>
                  <div class="color-rgb-row">
                    <el-input-number v-model="colorR" :min="0" :max="255" controls-position="right" @change="onColorRgbInput" />
                    <el-input-number v-model="colorG" :min="0" :max="255" controls-position="right" @change="onColorRgbInput" />
                    <el-input-number v-model="colorB" :min="0" :max="255" controls-position="right" @change="onColorRgbInput" />
                  </div>
                </div>
                <div class="tool-col">
                  <label>HSL (H, S%, L%)</label>
                  <div class="color-rgb-row">
                    <el-input-number v-model="colorH" :min="0" :max="360" controls-position="right" @change="onColorHslInput" />
                    <el-input-number v-model="colorS" :min="0" :max="100" controls-position="right" @change="onColorHslInput" />
                    <el-input-number v-model="colorL" :min="0" :max="100" controls-position="right" @change="onColorHslInput" />
                  </div>
                </div>
                <div class="tool-col">
                  <label>Alpha (不透明度)</label>
                  <el-slider v-model="colorA" :min="0" :max="100" :format-tooltip="(v: number) => v + '%'" />
                </div>
              </div>
              <div class="color-preview-area">
                <div class="color-preview" :style="{ background: colorPreview }"></div>
                <div class="color-contrast-info">
                  <div>白色文字对比度: <b>{{ colorContrastWhite }}:1</b> <span :style="{ color: Number(colorContrastWhite) >= 4.5 ? '#67c23a' : '#f56c6c' }">{{ Number(colorContrastWhite) >= 4.5 ? 'AA Pass' : 'Fail' }}</span></div>
                  <div>黑色文字对比度: <b>{{ colorContrastBlack }}:1</b> <span :style="{ color: Number(colorContrastBlack) >= 4.5 ? '#67c23a' : '#f56c6c' }">{{ Number(colorContrastBlack) >= 4.5 ? 'AA Pass' : 'Fail' }}</span></div>
                </div>
              </div>
            </div>
            <div class="color-palette-row">
              <label>色阶调色板</label>
              <div class="color-palette">
                <div v-for="s in colorPalette" :key="s.label"
                  class="color-palette-swatch"
                  :style="{ background: s.hex }"
                  :title="`${s.label}: ${s.hex}`"
                  @click="applyColorPreset(s.hex)"
                >
                  <span class="color-palette-label">{{ s.hex }}</span>
                </div>
              </div>
            </div>
            <div class="tool-toolbar">
              <el-button @click="copyText(colorHex)">复制 HEX</el-button>
              <el-button @click="copyText(`rgb(${colorR}, ${colorG}, ${colorB})`)">复制 RGB</el-button>
              <el-button @click="copyText(`rgba(${colorR}, ${colorG}, ${colorB}, ${(colorA / 100).toFixed(2)})`)">复制 RGBA</el-button>
              <el-button @click="copyText(`hsl(${colorH}, ${colorS}%, ${colorL}%)`)">复制 HSL</el-button>
            </div>
          </template>

          <!-- 进制转换 -->
          <template v-if="activeTool === 'radix'">
            <div class="tool-row">
              <div class="tool-col">
                <label>二进制 (BIN)</label>
                <el-input v-model="radixBin" placeholder="如 11111111" @input="onRadixInput('bin')" />
              </div>
              <div class="tool-col">
                <label>八进制 (OCT)</label>
                <el-input v-model="radixOct" placeholder="如 377" @input="onRadixInput('oct')" />
              </div>
            </div>
            <div class="tool-row">
              <div class="tool-col">
                <label>十进制 (DEC)</label>
                <el-input v-model="radixDec" placeholder="如 255" @input="onRadixInput('dec')" />
              </div>
              <div class="tool-col">
                <label>十六进制 (HEX)</label>
                <el-input v-model="radixHexVal" placeholder="如 FF" @input="onRadixInput('hex')" />
              </div>
            </div>
            <div v-if="radixError" class="tool-error">{{ radixError }}</div>
          </template>

          <!-- 哈希生成 -->
          <template v-if="activeTool === 'hash'">
            <div class="tool-row">
              <div class="tool-col">
                <label>输入文本</label>
                <el-input v-model="hashInput" type="textarea" :rows="6" placeholder="输入要计算哈希的文本..." />
              </div>
              <div class="tool-col">
                <label>哈希结果</label>
                <el-input v-model="hashOutput" type="textarea" :rows="6" readonly />
              </div>
            </div>
            <div class="tool-toolbar">
              <el-select v-model="hashAlgo" style="width: 140px;">
                <el-option label="SHA-1" value="SHA-1" />
                <el-option label="SHA-256" value="SHA-256" />
                <el-option label="SHA-512" value="SHA-512" />
              </el-select>
              <el-button type="primary" @click="generateHash">生成</el-button>
              <el-button @click="copyText(hashOutput)" :disabled="!hashOutput">复制结果</el-button>
            </div>
          </template>

          <!-- 随机密码生成 -->
          <template v-if="activeTool === 'password'">
            <div class="tool-row" style="align-items: flex-start;">
              <div class="tool-col" style="flex: 0 0 220px;">
                <label>密码长度：{{ pwdLength }}</label>
                <el-slider v-model="pwdLength" :min="4" :max="64" />
              </div>
              <div class="tool-col">
                <label>字符类型</label>
                <div class="pwd-options">
                  <el-checkbox v-model="pwdUppercase">大写字母 (A-Z)</el-checkbox>
                  <el-checkbox v-model="pwdLowercase">小写字母 (a-z)</el-checkbox>
                  <el-checkbox v-model="pwdDigits">数字 (0-9)</el-checkbox>
                  <el-checkbox v-model="pwdSpecial">特殊字符 (!@#$...)</el-checkbox>
                </div>
              </div>
            </div>
            <div v-if="pwdOutput" class="tool-col" style="margin-top: 12px;">
              <label>生成结果</label>
              <el-input v-model="pwdOutput" readonly />
              <div class="pwd-strength-bar">
                <div class="pwd-strength-track">
                  <div
                    v-for="i in 4" :key="i"
                    class="pwd-strength-segment"
                    :style="{ background: i <= pwdStrength.level ? pwdStrength.color : 'var(--border-color)' }"
                  ></div>
                </div>
                <span class="pwd-strength-text" :style="{ color: pwdStrength.color }">{{ pwdStrength.text }}</span>
              </div>
            </div>
            <div class="tool-toolbar">
              <el-button type="primary" @click="generatePassword">生成密码</el-button>
              <el-button @click="copyText(pwdOutput)" :disabled="!pwdOutput">复制密码</el-button>
            </div>
          </template>

          <!-- 正则测试 -->
          <template v-if="activeTool === 'regex'">
            <div class="regex-presets">
              <label>常用预设</label>
              <div class="regex-preset-list">
                <span
                  v-for="p in regexPresets" :key="p.label"
                  class="regex-preset-tag"
                  @click="applyRegexPreset(p)"
                >{{ p.label }}</span>
              </div>
            </div>
            <div class="tool-row">
              <div class="tool-col" style="flex: 2;">
                <label>正则表达式</label>
                <el-input v-model="regexPattern" placeholder="如 \d+" />
              </div>
              <div class="tool-col" style="flex: 0 0 120px;">
                <label>Flags</label>
                <el-input v-model="regexFlags" placeholder="g" />
              </div>
            </div>
            <div v-if="regexError" class="tool-error">{{ regexError }}</div>
            <div class="tool-col" style="margin-top: 12px;">
              <label>测试文本</label>
              <el-input v-model="regexTestStr" type="textarea" :rows="4" placeholder="输入要测试的文本..." />
            </div>
            <div class="tool-row" style="margin-top: 12px;">
              <div class="tool-col">
                <label>替换为（支持 $1 $2 等引用）</label>
                <el-input v-model="regexReplace" placeholder="替换文本" />
              </div>
            </div>
            <div v-if="regexTestStr" class="regex-result">
              <label>匹配结果（{{ regexMatches.length }} 个匹配）</label>
              <div class="regex-preview" v-html="regexHighlighted"></div>
              <div v-if="regexMatches.length" class="regex-match-list">
                <div v-for="(m, i) in regexMatches" :key="i" class="regex-match-item">
                  <span class="regex-match-idx">#{{ i + 1 }}</span>
                  <code>{{ m.text }}</code>
                  <span class="regex-match-pos">位置 {{ m.start }}-{{ m.end }}</span>
                </div>
              </div>
            </div>
            <div v-if="regexReplace && regexReplaceResult" class="tool-col" style="margin-top: 12px;">
              <label>替换结果</label>
              <el-input v-model="regexReplaceResult" type="textarea" :rows="4" readonly />
              <div class="tool-toolbar" style="margin-top: 8px;">
                <el-button @click="copyText(regexReplaceResult)">复制替换结果</el-button>
              </div>
            </div>
          </template>

          <!-- 文本对比 -->
          <template v-if="activeTool === 'diff'">
            <div class="diff-options">
              <el-checkbox v-model="diffIgnoreWhitespace">忽略连续空格</el-checkbox>
              <el-checkbox v-model="diffIgnoreCase">忽略大小写</el-checkbox>
              <el-checkbox v-model="diffTrimLines">Trim 每行</el-checkbox>
            </div>
            <div class="tool-row">
              <div class="tool-col">
                <label>原始文本</label>
                <el-input v-model="diffLeft" type="textarea" :rows="8" placeholder="输入原始文本..." />
              </div>
              <div class="tool-col">
                <label>对比文本</label>
                <el-input v-model="diffRight" type="textarea" :rows="8" placeholder="输入对比文本..." />
              </div>
            </div>
            <div v-if="diffResult.length" class="diff-output">
              <div class="diff-stats-bar">
                <span>共 <b>{{ diffStats.total }}</b> 行</span>
                <span style="color: var(--text-secondary);">相同 <b>{{ diffStats.same }}</b></span>
                <span style="color: #67c23a;">新增 <b>+{{ diffStats.added }}</b></span>
                <span style="color: #f56c6c;">删除 <b>-{{ diffStats.deleted }}</b></span>
              </div>
              <div class="diff-lines">
                <div
                  v-for="(line, idx) in diffResult" :key="idx"
                  class="diff-line"
                  :class="{ 'diff-del': line.type === 'del', 'diff-add': line.type === 'add' }"
                >
                  <span class="diff-line-num">{{ line.lineNum }}</span>
                  <span class="diff-prefix">{{ line.type === 'del' ? '-' : line.type === 'add' ? '+' : ' ' }}</span>
                  <span>{{ line.text }}</span>
                </div>
              </div>
            </div>
          </template>

          <!-- Markdown 预览 -->
          <template v-if="activeTool === 'markdown'">
            <div class="md-table-gen">
              <label>快速插入表格</label>
              <div class="md-table-gen-row">
                <span>行:</span><el-input-number v-model="mdTableRows" :min="1" :max="20" size="small" />
                <span>列:</span><el-input-number v-model="mdTableCols" :min="1" :max="10" size="small" />
                <span>对齐:</span>
                <el-radio-group v-model="mdTableAlign" size="small">
                  <el-radio-button value="left">左</el-radio-button>
                  <el-radio-button value="center">中</el-radio-button>
                  <el-radio-button value="right">右</el-radio-button>
                </el-radio-group>
                <el-button type="primary" size="small" @click="insertMdTable">插入表格</el-button>
              </div>
            </div>
            <div class="tool-row md-layout">
              <div class="tool-col">
                <label>Markdown 输入</label>
                <el-input v-model="mdInput" type="textarea" :rows="16" placeholder="输入 Markdown 内容..." />
              </div>
              <div class="tool-col">
                <label>预览</label>
                <div class="md-preview" v-html="mdRendered"></div>
              </div>
            </div>
            <div class="tool-toolbar">
              <el-button @click="copyText(mdInput)" :disabled="!mdInput">复制 Markdown</el-button>
              <el-button @click="copyText(mdRendered)" :disabled="!mdInput">复制 HTML</el-button>
            </div>
          </template>

          <!-- 文本统计 -->
          <template v-if="activeTool === 'textstat'">
            <div class="tool-col">
              <label>输入文本</label>
              <el-input v-model="textStatInput" type="textarea" :rows="8" placeholder="输入或粘贴文本..." />
            </div>
            <div class="stat-cards">
              <div class="stat-card">
                <div class="stat-value">{{ textStats.chars }}</div>
                <div class="stat-label-text">字符数</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">{{ textStats.charsNoSpace }}</div>
                <div class="stat-label-text">字符数(不含空格)</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">{{ textStats.words }}</div>
                <div class="stat-label-text">总字数</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">{{ textStats.chineseChars }}</div>
                <div class="stat-label-text">中文字数</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">{{ textStats.englishWords }}</div>
                <div class="stat-label-text">英文词数</div>
              </div>
            </div>
            <div class="stat-cards">
              <div class="stat-card">
                <div class="stat-value">{{ textStats.lines }}</div>
                <div class="stat-label-text">行数</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">{{ textStats.paragraphs }}</div>
                <div class="stat-label-text">段落数</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">{{ textStats.uniqueLines }}</div>
                <div class="stat-label-text">去重行数</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">{{ textStats.bytes }}</div>
                <div class="stat-label-text">字节数 (UTF-8)</div>
              </div>
              <div class="stat-card">
                <div class="stat-value stat-value-sm">{{ textStats.readTime }}</div>
                <div class="stat-label-text">预计阅读时间</div>
              </div>
            </div>
          </template>

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

          <!-- Cron 表达式 -->
          <template v-if="activeTool === 'cron'">
            <div class="tool-col">
              <label>Cron 表达式（5 字段：分 时 日 月 周）</label>
              <el-input v-model="cronInput" placeholder="如 */5 * * * *" />
            </div>
            <div class="tool-toolbar">
              <el-button type="primary" @click="parseCron">解析</el-button>
            </div>
            <div v-if="cronError" class="tool-error">{{ cronError }}</div>
            <div v-if="cronDesc" class="cron-desc">{{ cronDesc }}</div>
            <div v-if="cronNextTimes.length" class="cron-times">
              <label>接下来 5 次执行时间</label>
              <div v-for="(t, i) in cronNextTimes" :key="i" class="cron-time-item">
                {{ i + 1 }}. {{ t }}
              </div>
            </div>
          </template>

          <!-- JSONPath 查询 -->
          <template v-if="activeTool === 'jsonpath'">
            <div class="tool-row json-editors">
              <div class="tool-col">
                <label>JSON 数据</label>
                <div class="editor-box">
                  <CodeEditor v-model="jpInput" language="json" :isDark="isDark" />
                </div>
              </div>
              <div class="tool-col">
                <label>查询结果</label>
                <div class="editor-box">
                  <CodeEditor v-model="jpOutput" language="json" :isDark="isDark" :readonly="true" />
                </div>
              </div>
            </div>
            <div class="tool-col" style="margin-top: 12px;">
              <label>JSONPath 表达式</label>
              <el-input v-model="jpPath" placeholder="如 $.store.book[*].author" />
            </div>
            <div class="regex-presets" style="margin-top: 12px;">
              <label>常用表达式</label>
              <div class="regex-preset-list">
                <span
                  v-for="p in jpPresets" :key="p.label"
                  class="regex-preset-tag"
                  @click="jpPath = p.path"
                >{{ p.label }} <code>{{ p.path }}</code></span>
              </div>
            </div>
            <div v-if="jpError" class="tool-error">{{ jpError }}</div>
            <div class="tool-toolbar">
              <el-button type="primary" @click="queryJsonPath">查询</el-button>
              <el-button @click="copyText(jpOutput)" :disabled="!jpOutput">复制结果</el-button>
            </div>
          </template>

          <!-- Mock 数据生成 -->
          <template v-if="activeTool === 'mockdata'">
            <div class="tool-row" style="align-items: flex-start;">
              <div class="tool-col" style="flex: 0 0 auto;">
                <label>生成模式</label>
                <el-radio-group v-model="mockType" size="small">
                  <el-radio-button value="preset">预设类型</el-radio-button>
                  <el-radio-button value="template">自定义模板</el-radio-button>
                </el-radio-group>
              </div>
              <div class="tool-col" style="flex: 0 0 140px;">
                <label>生成数量</label>
                <el-input-number v-model="mockCount" :min="1" :max="100" size="small" />
              </div>
            </div>
            <div v-if="mockType === 'preset'" class="mock-presets">
              <div v-for="[cat, presets] in mockPresetCategories" :key="cat" class="mock-preset-group">
                <label>{{ cat }}</label>
                <div class="mock-preset-list">
                  <span
                    v-for="p in presets" :key="p.key"
                    class="regex-preset-tag"
                    :class="{ 'preset-active': mockPreset === p.key }"
                    @click="mockPreset = p.key"
                  >{{ p.label }}</span>
                </div>
              </div>
            </div>
            <div v-else class="tool-col" style="margin-top: 12px;">
              <label>自定义 JSON 模板（使用 @type 占位符）</label>
              <el-input
                v-model="mockCustomTpl"
                type="textarea" :rows="6"
                placeholder='如 {"name": "@name", "phone": "@phone", "email": "@email", "age": "@integer"}'
              />
              <div class="tool-hint" style="margin-top: 4px;">
                支持的占位符：@name @nameEn @phone @email @idcard @address @ip @url @domain @datetime @date @time @integer @float @boolean @paragraph @sentence @word @color @image @uuid
              </div>
            </div>
            <div class="tool-toolbar">
              <el-button type="primary" @click="generateMockData">生成</el-button>
              <el-button @click="copyText(mockOutput)" :disabled="!mockOutput">复制结果</el-button>
            </div>
            <div v-if="mockOutput" class="tool-col" style="margin-top: 12px;">
              <label>生成结果</label>
              <div class="editor-box" style="height: 350px;">
                <CodeEditor v-model="mockOutput" language="json" :isDark="isDark" :readonly="true" />
              </div>
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

          <!-- 占位图生成 -->
          <template v-if="activeTool === 'placeholder'">
            <div class="tool-row">
              <div class="tool-col" style="flex: 0 0 130px;">
                <label>宽度 (px)</label>
                <el-input-number v-model="phWidth" :min="10" :max="2000" />
              </div>
              <div class="tool-col" style="flex: 0 0 130px;">
                <label>高度 (px)</label>
                <el-input-number v-model="phHeight" :min="10" :max="2000" />
              </div>
              <div class="tool-col" style="flex: 0 0 100px;">
                <label>背景色</label>
                <el-color-picker v-model="phBgColor" />
              </div>
              <div class="tool-col" style="flex: 0 0 100px;">
                <label>文字色</label>
                <el-color-picker v-model="phTextColor" />
              </div>
              <div class="tool-col" style="flex: 0 0 130px;">
                <label>字号 (0=自动)</label>
                <el-input-number v-model="phFontSize" :min="0" :max="200" />
              </div>
              <div class="tool-col" style="flex: 0 0 auto;">
                <label>格式</label>
                <el-radio-group v-model="phFormat" size="small">
                  <el-radio-button value="png">PNG</el-radio-button>
                  <el-radio-button value="svg">SVG</el-radio-button>
                </el-radio-group>
              </div>
            </div>
            <div class="tool-col">
              <label>自定义文字（留空则显示尺寸）</label>
              <el-input v-model="phText" placeholder="如 Logo / Banner / 400x300" />
            </div>
            <div class="tool-toolbar">
              <el-button type="primary" @click="generatePlaceholder">生成</el-button>
              <el-button @click="downloadPlaceholder" :disabled="!phDataUrl">下载图片</el-button>
              <el-button @click="copyText(phDataUrl)" :disabled="!phDataUrl">复制 DataURL</el-button>
            </div>
            <div v-if="phDataUrl" class="ph-preview">
              <label>预览</label>
              <img :src="phDataUrl" alt="placeholder" />
            </div>
          </template>

          <!-- JSON Diff -->
          <template v-if="activeTool === 'jsondiff'">
            <div class="tool-row json-editors">
              <div class="tool-col">
                <label>左侧 JSON</label>
                <div class="editor-box">
                  <CodeEditor v-model="jdLeft" language="json" :isDark="isDark" />
                </div>
              </div>
              <div class="tool-col">
                <label>右侧 JSON</label>
                <div class="editor-box">
                  <CodeEditor v-model="jdRight" language="json" :isDark="isDark" />
                </div>
              </div>
            </div>
            <div v-if="jdError" class="tool-error">{{ jdError }}</div>
            <div class="tool-toolbar">
              <el-button type="primary" @click="compareJson">对比</el-button>
            </div>
            <div v-if="jdOutput.length" class="jd-results">
              <label>差异结果（{{ jdOutput.length }} 处不同）</label>
              <div class="jd-list">
                <div v-for="(d, i) in jdOutput" :key="i" class="jd-item" :class="'jd-' + d.type">
                  <span class="jd-path">{{ d.path }}</span>
                  <span class="jd-type-badge">{{ d.type === 'added' ? '新增' : d.type === 'removed' ? '删除' : '修改' }}</span>
                  <span v-if="d.oldVal" class="jd-old">{{ d.oldVal }}</span>
                  <span v-if="d.type === 'changed'" class="jd-arrow">→</span>
                  <span v-if="d.newVal" class="jd-new">{{ d.newVal }}</span>
                </div>
              </div>
            </div>
            <div v-if="jdOutput.length === 0 && jdLeft && jdRight && !jdError" class="tool-hint" style="margin-top: 16px; text-align: center;">
              两个 JSON 完全相同
            </div>
          </template>

          <!-- AES 加解密 -->
          <template v-if="activeTool === 'encrypt'">
            <div class="tool-row">
              <div class="tool-col" style="flex: 0 0 auto;">
                <label>操作</label>
                <el-radio-group v-model="encMode" size="small">
                  <el-radio-button value="encrypt">加密</el-radio-button>
                  <el-radio-button value="decrypt">解密</el-radio-button>
                </el-radio-group>
              </div>
              <div class="tool-col" style="flex: 0 0 auto;">
                <label>算法</label>
                <el-radio-group v-model="encAlgo" size="small">
                  <el-radio-button value="AES-GCM">AES-GCM</el-radio-button>
                  <el-radio-button value="AES-CBC">AES-CBC</el-radio-button>
                </el-radio-group>
              </div>
            </div>
            <div class="tool-col">
              <label>{{ encMode === 'encrypt' ? '明文' : '密文' }}</label>
              <el-input v-model="encInput" type="textarea" :rows="4" :placeholder="encMode === 'encrypt' ? '输入要加密的文本...' : '输入密文（格式: AES-GCM:salt:iv:data）'" />
            </div>
            <div class="tool-row" style="margin-top: 12px;">
              <div class="tool-col">
                <label>密钥</label>
                <el-input v-model="encKey" placeholder="输入密钥" show-password />
              </div>
              <div class="tool-col" style="flex: 0 0 auto; justify-content: flex-end;">
                <el-button size="small" @click="generateEncKey">生成随机密钥</el-button>
              </div>
            </div>
            <div v-if="encError" class="tool-error">{{ encError }}</div>
            <div class="tool-toolbar">
              <el-button type="primary" @click="encMode === 'encrypt' ? doEncrypt() : doDecrypt()">
                {{ encMode === 'encrypt' ? '加密' : '解密' }}
              </el-button>
              <el-button @click="copyText(encOutput)" :disabled="!encOutput">复制结果</el-button>
            </div>
            <div v-if="encOutput" class="tool-col" style="margin-top: 12px;">
              <label>{{ encMode === 'encrypt' ? '密文' : '明文' }}</label>
              <el-input v-model="encOutput" type="textarea" :rows="4" readonly />
            </div>
          </template>

          <!-- Unicode 工具 -->
          <template v-if="activeTool === 'unicode'">
            <div class="tool-col">
              <label>输入字符/文本</label>
              <el-input v-model="uniInput" type="textarea" :rows="3" placeholder="输入任意字符，如：你好世界🌍 Hello" />
            </div>
            <div class="tool-toolbar">
              <el-button type="primary" @click="unicodeEscape">→ Unicode 转义</el-button>
              <el-button type="primary" @click="unicodeUnescape">Unicode 转义 → 文本</el-button>
              <el-button @click="copyText(uniOutput)" :disabled="!uniOutput">复制结果</el-button>
            </div>
            <div v-if="uniOutput" class="tool-col" style="margin-top: 12px;">
              <label>转换结果</label>
              <el-input v-model="uniOutput" type="textarea" :rows="3" readonly />
            </div>
            <div v-if="uniAnalysis.length" class="uni-table">
              <label>字符详情 ({{ uniAnalysis.length }} 个字符)</label>
              <div class="uni-grid">
                <div class="uni-grid-header">
                  <span>字符</span><span>Unicode</span><span>十进制</span><span>JS 转义</span><span>HTML</span><span>UTF-8 字节</span><span>分类</span>
                </div>
                <div v-for="(c, i) in uniAnalysis" :key="i" class="uni-grid-row">
                  <span class="uni-char">{{ c.char }}</span>
                  <span><code>{{ c.unicode }}</code></span>
                  <span>{{ c.decimal }}</span>
                  <span><code>{{ c.jsEscape }}</code></span>
                  <span><code>{{ c.htmlEntity }}</code></span>
                  <span>{{ c.utf8Bytes }}</span>
                  <span class="uni-category">{{ c.category }}</span>
                </div>
              </div>
            </div>
          </template>

          <!-- 数字格式化 -->
          <template v-if="activeTool === 'number'">
            <div class="tool-col">
              <label>输入数字</label>
              <el-input v-model="numInput" placeholder="如 12345678.9" size="large" />
            </div>
            <div v-if="numFormats" class="num-formats">
              <div class="num-format-item" @click="copyText(numFormats.thousands)">
                <span class="num-format-label">千分位</span>
                <span class="num-format-value">{{ numFormats.thousands }}</span>
              </div>
              <div class="num-format-item" @click="copyText(numFormats.cny)">
                <span class="num-format-label">人民币</span>
                <span class="num-format-value">{{ numFormats.cny }}</span>
              </div>
              <div class="num-format-item" @click="copyText(numFormats.usd)">
                <span class="num-format-label">美元</span>
                <span class="num-format-value">{{ numFormats.usd }}</span>
              </div>
              <div class="num-format-item" @click="copyText(numFormats.upperCny)">
                <span class="num-format-label">大写金额</span>
                <span class="num-format-value">{{ numFormats.upperCny }}</span>
              </div>
              <div class="num-format-item" @click="copyText(numFormats.chineseNum)">
                <span class="num-format-label">中文数字</span>
                <span class="num-format-value">{{ numFormats.chineseNum }}</span>
              </div>
              <div class="num-format-item" @click="copyText(numFormats.scientific)">
                <span class="num-format-label">科学计数</span>
                <span class="num-format-value">{{ numFormats.scientific }}</span>
              </div>
              <div class="num-format-item" @click="copyText(numFormats.percent)">
                <span class="num-format-label">百分比</span>
                <span class="num-format-value">{{ numFormats.percent }}</span>
              </div>
              <div class="num-format-item" @click="copyText(numFormats.fileSize)">
                <span class="num-format-label">文件大小</span>
                <span class="num-format-value">{{ numFormats.fileSize }}</span>
              </div>
              <div class="num-format-item" @click="copyText(numFormats.roman)">
                <span class="num-format-label">罗马数字</span>
                <span class="num-format-value">{{ numFormats.roman }}</span>
              </div>
              <div class="num-format-item" @click="copyText(numFormats.bin)">
                <span class="num-format-label">二进制</span>
                <span class="num-format-value mono">{{ numFormats.bin }}</span>
              </div>
              <div class="num-format-item" @click="copyText(numFormats.oct)">
                <span class="num-format-label">八进制</span>
                <span class="num-format-value mono">{{ numFormats.oct }}</span>
              </div>
              <div class="num-format-item" @click="copyText(numFormats.hex)">
                <span class="num-format-label">十六进制</span>
                <span class="num-format-value mono">{{ numFormats.hex }}</span>
              </div>
            </div>
            <div v-if="numFormats" class="tool-hint" style="margin-top: 8px;">点击任意项可复制</div>
          </template>

          <!-- 二维码生成 -->
          <template v-if="activeTool === 'qrcode'">
            <div class="tool-col">
              <label>文本内容</label>
              <el-input v-model="qrText" type="textarea" :rows="3" placeholder="输入文本或 URL..." />
            </div>
            <div class="tool-row" style="margin-top: 12px;">
              <div class="tool-col" style="flex: 0 0 130px;">
                <label>尺寸 (px)</label>
                <el-input-number v-model="qrSize" :min="64" :max="1024" :step="64" />
              </div>
              <div class="tool-col" style="flex: 0 0 auto;">
                <label>纠错级别</label>
                <el-radio-group v-model="qrErrorLevel" size="small">
                  <el-radio-button value="L">L (7%)</el-radio-button>
                  <el-radio-button value="M">M (15%)</el-radio-button>
                  <el-radio-button value="Q">Q (25%)</el-radio-button>
                  <el-radio-button value="H">H (30%)</el-radio-button>
                </el-radio-group>
              </div>
              <div class="tool-col" style="flex: 0 0 80px;">
                <label>前景色</label>
                <el-color-picker v-model="qrFgColor" />
              </div>
              <div class="tool-col" style="flex: 0 0 80px;">
                <label>背景色</label>
                <el-color-picker v-model="qrBgColor" />
              </div>
            </div>
            <div class="tool-toolbar">
              <el-button type="primary" @click="generateQrCode">生成二维码</el-button>
              <el-button @click="downloadQrCode" :disabled="!qrDataUrl">下载 PNG</el-button>
              <el-button @click="copyText(qrDataUrl)" :disabled="!qrDataUrl">复制 DataURL</el-button>
            </div>
            <div v-if="qrDataUrl" class="ph-preview">
              <label>预览</label>
              <img :src="qrDataUrl" alt="QR Code" />
            </div>
          </template>

          <!-- 文本变换 -->
          <template v-if="activeTool === 'texttransform'">
            <div class="tt-modes">
              <div v-for="[cat, modes] in ttModeCategories" :key="cat" class="tt-mode-group">
                <label>{{ cat }}</label>
                <div class="regex-preset-list">
                  <span
                    v-for="m in modes" :key="m.key"
                    class="regex-preset-tag"
                    :class="{ 'preset-active': ttMode === m.key }"
                    @click="ttMode = m.key; transformText()"
                  >{{ m.label }}</span>
                </div>
              </div>
            </div>
            <div class="tool-row" style="margin-top: 12px;">
              <div class="tool-col">
                <label>输入</label>
                <el-input v-model="ttInput" type="textarea" :rows="8" placeholder="输入文本..." />
              </div>
              <div class="tool-col">
                <label>输出</label>
                <el-input v-model="ttOutput" type="textarea" :rows="8" readonly />
              </div>
            </div>
            <div class="tool-toolbar">
              <el-button type="primary" @click="transformText">转换</el-button>
              <el-button @click="copyText(ttOutput)" :disabled="!ttOutput">复制结果</el-button>
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

          <!-- ASCII 码表 -->
          <template v-if="activeTool === 'ascii'">
            <div class="tool-col">
              <el-input v-model="asciiSearch" placeholder="搜索：输入字符、十进制、十六进制或描述..." clearable />
            </div>
            <div class="ascii-grid">
              <div class="ascii-header">
                <span>DEC</span><span>HEX</span><span>CHAR</span><span>描述</span>
              </div>
              <div v-for="a in filteredAscii" :key="a.dec" class="ascii-row" @click="copyText(a.char)">
                <span class="ascii-dec">{{ a.dec }}</span>
                <span class="ascii-hex">0x{{ a.hex }}</span>
                <span class="ascii-char">{{ a.char }}</span>
                <span class="ascii-desc">{{ a.desc }}</span>
              </div>
            </div>
          </template>

          <!-- CSS 单位转换 -->
          <template v-if="activeTool === 'cssunit'">
            <div class="tool-row">
              <div class="tool-col" style="flex: 0 0 200px;">
                <label>像素值 (px)</label>
                <el-input-number v-model="cssValue" :min="0" :max="9999" size="large" />
              </div>
              <div class="tool-col" style="flex: 0 0 180px;">
                <label>根字号 (px)</label>
                <el-input-number v-model="cssBaseFontSize" :min="1" :max="100" />
              </div>
              <div class="tool-col" style="flex: 0 0 180px;">
                <label>视口宽度 (px)</label>
                <el-input-number v-model="cssViewportWidth" :min="100" :max="7680" />
              </div>
              <div class="tool-col" style="flex: 0 0 180px;">
                <label>视口高度 (px)</label>
                <el-input-number v-model="cssViewportHeight" :min="100" :max="4320" />
              </div>
            </div>
            <div class="css-units-grid">
              <div class="css-unit-card" @click="copyText(String(cssUnits.px) + 'px')">
                <div class="css-unit-val">{{ cssUnits.px }}px</div><div class="css-unit-name">Pixels</div>
              </div>
              <div class="css-unit-card" @click="copyText(String(cssUnits.rem) + 'rem')">
                <div class="css-unit-val">{{ cssUnits.rem }}rem</div><div class="css-unit-name">Root EM</div>
              </div>
              <div class="css-unit-card" @click="copyText(String(cssUnits.em) + 'em')">
                <div class="css-unit-val">{{ cssUnits.em }}em</div><div class="css-unit-name">EM</div>
              </div>
              <div class="css-unit-card" @click="copyText(String(cssUnits.vw) + 'vw')">
                <div class="css-unit-val">{{ cssUnits.vw }}vw</div><div class="css-unit-name">Viewport Width</div>
              </div>
              <div class="css-unit-card" @click="copyText(String(cssUnits.vh) + 'vh')">
                <div class="css-unit-val">{{ cssUnits.vh }}vh</div><div class="css-unit-name">Viewport Height</div>
              </div>
              <div class="css-unit-card" @click="copyText(String(cssUnits.pt) + 'pt')">
                <div class="css-unit-val">{{ cssUnits.pt }}pt</div><div class="css-unit-name">Points</div>
              </div>
              <div class="css-unit-card" @click="copyText(String(cssUnits.percent) + '%')">
                <div class="css-unit-val">{{ cssUnits.percent }}%</div><div class="css-unit-name">Percent (of root)</div>
              </div>
              <div class="css-unit-card" @click="copyText(String(cssUnits.cm) + 'cm')">
                <div class="css-unit-val">{{ cssUnits.cm }}cm</div><div class="css-unit-name">Centimeters</div>
              </div>
              <div class="css-unit-card" @click="copyText(String(cssUnits.mm) + 'mm')">
                <div class="css-unit-val">{{ cssUnits.mm }}mm</div><div class="css-unit-name">Millimeters</div>
              </div>
              <div class="css-unit-card" @click="copyText(String(cssUnits.in) + 'in')">
                <div class="css-unit-val">{{ cssUnits.in }}in</div><div class="css-unit-name">Inches</div>
              </div>
            </div>
            <div class="tool-hint" style="margin-top: 8px;">点击任意项可复制</div>
          </template>

          <!-- 接口文档生成 -->
          <template v-if="activeTool === 'apidoc'">
            <div class="tool-col">
              <label>生成范围</label>
              <el-radio-group v-model="docScope" size="small">
                <el-radio-button value="all">全部</el-radio-button>
                <el-radio-button value="project">按项目</el-radio-button>
                <el-radio-button value="group">按分组</el-radio-button>
              </el-radio-group>
            </div>
            <div v-if="docScope === 'project'" class="tool-col">
              <label>选择项目</label>
              <el-select v-model="docProjectId" placeholder="请选择" size="small" style="width: 240px">
                <el-option v-for="p in docProjects" :key="p.id" :label="`${p.icon || '📦'} ${p.name}`" :value="p.id" />
              </el-select>
            </div>
            <div v-if="docScope === 'group'" class="tool-col">
              <label>选择分组</label>
              <el-select v-model="docGroupId" placeholder="请选择" size="small" style="width: 240px">
                <el-option v-for="g in docGroups" :key="g.id" :label="g.name" :value="g.id" />
              </el-select>
            </div>
            <div class="tool-toolbar">
              <el-button type="primary" @click="generateDoc" :loading="docLoading">生成文档</el-button>
              <el-button v-if="docResult" @click="copyDoc">复制</el-button>
              <el-button v-if="docResult" @click="downloadDoc">下载 .md</el-button>
            </div>
            <div v-if="docResult" class="doc-preview">
              <CodeEditor :modelValue="docResult" :readOnly="true" :isDark="isDark" />
            </div>
          </template>

        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ==================== 整体布局 ==================== */

.tools-panel {
  display: flex;
  height: 100%;
  overflow: hidden;
}

/* ==================== 侧边栏 ==================== */

.tools-sidebar {
  width: 160px;
  flex-shrink: 0;
  border-right: 1px solid var(--border-color);
  padding: 12px 8px;
  overflow-y: auto;
}

.tool-group {
  margin-bottom: 16px;
}

.tool-group-title {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 12px;
  margin-bottom: 4px;
  font-size: 11px;
  font-weight: 700;
  color: var(--text-secondary);
  letter-spacing: 1px;
}

.group-indicator {
  width: 3px;
  height: 12px;
  background: var(--primary-color);
  border-radius: 2px;
  flex-shrink: 0;
}

.tool-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  color: var(--text-secondary);
  font-size: 13px;
  transition: all 0.2s;
  margin-bottom: 2px;
}
.tool-item:hover { background: var(--bg-hover); color: var(--text-primary); }
.tool-item.active { background: var(--primary-bg); color: var(--primary-color); font-weight: 600; }

.tool-icon {
  font-size: 11px;
  font-weight: 700;
  width: 28px;
  text-align: center;
  flex-shrink: 0;
  font-family: 'Courier New', Courier, monospace;
}
.tool-label { white-space: nowrap; font-size: 12px; }

/* ==================== 内容区域 ==================== */

.tools-content {
  flex: 1;
  padding: 20px 24px;
  overflow-y: auto;
}

/* ==================== 卡片系统 ==================== */

.tool-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  overflow: hidden;
}

.tool-card-header {
  padding: 20px 24px 0;
}

.tool-card-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.tool-desc {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--text-secondary);
}

.tool-card-divider {
  height: 1px;
  background: var(--border-color);
  margin-top: 16px;
}

.tool-card-body {
  padding: 20px 24px;
}

/* ==================== 通用布局组件 ==================== */

.tool-row {
  display: flex;
  gap: 16px;
  margin-bottom: 12px;
}

.tool-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.tool-col label {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 500;
}

.tool-toolbar {
  display: flex;
  gap: 8px;
  margin-top: 16px;
  padding: 10px 12px;
  background: var(--bg-hover);
  border-radius: 8px;
  align-items: center;
}

.tool-error {
  color: #f56c6c;
  font-size: 12px;
  margin-top: 8px;
}

.tool-hint {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 12px;
}
.tool-hint code {
  color: var(--primary-color);
  font-weight: 600;
  font-size: 14px;
}

/* ==================== 正则测试 ==================== */

.regex-result {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.regex-result label {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 500;
}
.regex-preview {
  padding: 12px;
  background: var(--bg-hover);
  border-radius: 6px;
  font-family: monospace;
  font-size: 13px;
  line-height: 1.8;
  white-space: pre-wrap;
  word-break: break-all;
  color: var(--text-primary);
}
.regex-preview :deep(.regex-match) {
  background: rgba(64, 158, 255, 0.3);
  color: var(--primary-color);
  padding: 1px 2px;
  border-radius: 2px;
}

/* ==================== JSON → TS ==================== */

.json-editors,
.j2ts-editors {
  height: 350px;
}
.editor-box {
  flex: 1;
  min-height: 0;
  border-radius: 6px;
  overflow: hidden;
}

/* ==================== 颜色转换 ==================== */

.color-tool-layout {
  display: flex;
  gap: 24px;
  margin-bottom: 12px;
}
.color-inputs {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.color-rgb-row {
  display: flex;
  gap: 8px;
}
.color-rgb-row .el-input-number { flex: 1; }
.color-preview {
  width: 120px;
  height: 120px;
  border-radius: 12px;
  border: 1px solid var(--border-color);
  flex-shrink: 0;
  align-self: center;
}

/* ==================== 文本对比 ==================== */

.diff-output {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.diff-output label {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 500;
}
.diff-lines {
  border: 1px solid var(--border-color);
  border-radius: 6px;
  overflow: hidden;
  font-family: monospace;
  font-size: 13px;
  max-height: 400px;
  overflow-y: auto;
}
.diff-line {
  padding: 2px 12px;
  white-space: pre-wrap;
  word-break: break-all;
  line-height: 1.6;
}
.diff-prefix {
  display: inline-block;
  width: 16px;
  font-weight: 700;
  user-select: none;
}
.diff-del { background: rgba(245, 108, 108, 0.15); color: #f56c6c; }
.diff-add { background: rgba(103, 194, 58, 0.15); color: #67c23a; }

/* ==================== 文本统计 ==================== */

.stat-cards {
  display: flex;
  gap: 12px;
  margin-top: 16px;
}

.stat-card {
  flex: 1;
  background: var(--bg-hover);
  border-radius: 8px;
  padding: 16px;
  text-align: center;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: var(--primary-color);
  font-family: 'Courier New', Courier, monospace;
}

.stat-label-text {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 4px;
}

/* ==================== 随机密码 ==================== */

.pwd-options {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.pwd-strength-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}

.pwd-strength-track {
  display: flex;
  gap: 4px;
  flex: 1;
}

.pwd-strength-segment {
  flex: 1;
  height: 6px;
  border-radius: 3px;
  transition: background 0.3s;
}

.pwd-strength-text {
  font-size: 12px;
  font-weight: 600;
  min-width: 32px;
}

/* ==================== Markdown 预览 ==================== */

.md-layout {
  align-items: stretch;
}

.md-preview {
  flex: 1;
  padding: 16px;
  background: var(--bg-hover);
  border-radius: 6px;
  overflow-y: auto;
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-primary);
  min-height: 300px;
  max-height: 500px;
}

.md-preview :deep(h1) { font-size: 24px; font-weight: 700; margin: 0 0 12px; padding-bottom: 8px; border-bottom: 1px solid var(--border-color); }
.md-preview :deep(h2) { font-size: 20px; font-weight: 700; margin: 16px 0 8px; }
.md-preview :deep(h3) { font-size: 16px; font-weight: 600; margin: 12px 0 6px; }
.md-preview :deep(h4) { font-size: 14px; font-weight: 600; margin: 10px 0 4px; }
.md-preview :deep(p) { margin: 0 0 8px; }
.md-preview :deep(strong) { font-weight: 700; }
.md-preview :deep(em) { font-style: italic; }
.md-preview :deep(code) {
  background: rgba(64, 158, 255, 0.1);
  color: var(--primary-color);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Courier New', Courier, monospace;
  font-size: 13px;
}
.md-preview :deep(pre) {
  background: rgba(0, 0, 0, 0.06);
  border-radius: 6px;
  padding: 12px 16px;
  overflow-x: auto;
  margin: 8px 0;
}
.md-preview :deep(pre code) {
  background: none;
  padding: 0;
  color: var(--text-primary);
  font-size: 13px;
  line-height: 1.6;
}
.md-preview :deep(ul),
.md-preview :deep(ol) {
  margin: 4px 0 8px;
  padding-left: 24px;
}
.md-preview :deep(li) {
  margin-bottom: 2px;
}
.md-preview :deep(a) {
  color: var(--primary-color);
  text-decoration: none;
}
.md-preview :deep(a:hover) {
  text-decoration: underline;
}

/* ==================== Cron 表达式 ==================== */

.cron-desc {
  margin-top: 16px;
  padding: 12px 16px;
  background: var(--primary-bg);
  border-radius: 8px;
  color: var(--primary-color);
  font-weight: 600;
  font-size: 14px;
}

.cron-times {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.cron-times label {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 500;
  margin-bottom: 4px;
}

.cron-time-item {
  padding: 8px 12px;
  background: var(--bg-hover);
  border-radius: 6px;
  font-family: 'Courier New', Courier, monospace;
  font-size: 13px;
  color: var(--text-primary);
}

/* 文档生成 */
.doc-preview {
  flex: 1;
  min-height: 300px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  overflow: hidden;
}

/* ==================== URL 解析结果 ==================== */

.url-parsed {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.url-parsed > label {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 500;
}
.url-parsed-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.url-parsed-item {
  background: var(--bg-hover);
  border-radius: 6px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.url-parsed-key {
  font-size: 11px;
  color: var(--text-secondary);
  font-weight: 500;
}
.url-parsed-val {
  font-family: 'Courier New', Courier, monospace;
  font-size: 13px;
  color: var(--text-primary);
  word-break: break-all;
}
.url-params-table {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.url-params-table > label {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 500;
}
.url-param-row {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 8px;
  padding: 6px 12px;
  font-size: 13px;
  font-family: 'Courier New', Courier, monospace;
  background: var(--bg-hover);
  border-radius: 4px;
}
.url-param-header {
  font-weight: 600;
  font-family: inherit;
  color: var(--text-secondary);
  font-size: 12px;
}

/* ==================== Base64 图片预览 ==================== */

.b64-image-preview {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.b64-image-preview > label {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 500;
}
.b64-image-preview img {
  max-width: 400px;
  max-height: 300px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  object-fit: contain;
}

/* ==================== 文本统计增强 ==================== */

.stat-value-sm {
  font-size: 18px !important;
}

/* ==================== 正则预设 ==================== */

.regex-presets {
  margin-bottom: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.regex-presets > label {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 500;
}
.regex-preset-list {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.regex-preset-tag {
  padding: 4px 10px;
  background: var(--bg-hover);
  border-radius: 4px;
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid transparent;
}
.regex-preset-tag:hover {
  color: var(--primary-color);
  border-color: var(--primary-color);
  background: var(--primary-bg);
}

.regex-match-list {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 200px;
  overflow-y: auto;
}
.regex-match-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 10px;
  background: var(--bg-hover);
  border-radius: 4px;
  font-size: 12px;
}
.regex-match-idx {
  color: var(--text-secondary);
  font-weight: 600;
  min-width: 28px;
}
.regex-match-item code {
  color: var(--primary-color);
  font-family: 'Courier New', Courier, monospace;
  flex: 1;
  word-break: break-all;
}
.regex-match-pos {
  color: var(--text-secondary);
  font-size: 11px;
  white-space: nowrap;
}

/* ==================== Mock 数据生成 ==================== */

.mock-presets {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.mock-preset-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.mock-preset-group > label {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 500;
}
.mock-preset-list {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.preset-active {
  color: var(--primary-color) !important;
  border-color: var(--primary-color) !important;
  background: var(--primary-bg) !important;
}

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

/* ==================== 占位图生成 ==================== */

.ph-preview {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ph-preview > label {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 500;
}
.ph-preview img {
  max-width: 100%;
  max-height: 400px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  object-fit: contain;
  align-self: flex-start;
}

/* ==================== JSON 统计 ==================== */

.json-stats {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 8px;
  padding: 8px 12px;
  background: var(--bg-hover);
  border-radius: 6px;
  font-size: 12px;
  color: var(--text-secondary);
}
.json-stats b { color: var(--primary-color); }

/* ==================== JSON Diff ==================== */

.jd-results { margin-top: 16px; }
.jd-results > label { font-size: 12px; color: var(--text-secondary); font-weight: 500; display: block; margin-bottom: 8px; }
.jd-list { display: flex; flex-direction: column; gap: 4px; max-height: 400px; overflow-y: auto; }
.jd-item {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 12px; border-radius: 6px; font-size: 13px;
  font-family: 'Courier New', Courier, monospace;
}
.jd-added { background: rgba(103, 194, 58, 0.1); }
.jd-removed { background: rgba(245, 108, 108, 0.1); }
.jd-changed { background: rgba(230, 162, 60, 0.1); }
.jd-path { font-weight: 600; color: var(--text-primary); min-width: 150px; }
.jd-type-badge {
  font-size: 11px; padding: 2px 6px; border-radius: 3px; font-weight: 600; font-family: inherit;
}
.jd-added .jd-type-badge { background: rgba(103, 194, 58, 0.2); color: #67c23a; }
.jd-removed .jd-type-badge { background: rgba(245, 108, 108, 0.2); color: #f56c6c; }
.jd-changed .jd-type-badge { background: rgba(230, 162, 60, 0.2); color: #e6a23c; }
.jd-old { color: #f56c6c; text-decoration: line-through; }
.jd-arrow { color: var(--text-secondary); }
.jd-new { color: #67c23a; }

/* ==================== Diff 增强 ==================== */

.diff-options { display: flex; gap: 16px; margin-bottom: 12px; }
.diff-stats-bar { display: flex; gap: 16px; font-size: 13px; margin-bottom: 8px; }
.diff-stats-bar b { margin: 0 2px; }
.diff-line-num {
  display: inline-block; min-width: 30px; text-align: right;
  color: var(--text-secondary); font-size: 12px; user-select: none;
  padding-right: 8px; margin-right: 4px; border-right: 1px solid var(--border-color);
}

/* ==================== 颜色增强 ==================== */

.color-presets-row { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px; }
.color-preset-swatch {
  width: 28px; height: 28px; border-radius: 6px; cursor: pointer;
  border: 2px solid transparent; transition: all 0.2s;
}
.color-preset-swatch:hover { border-color: var(--primary-color); transform: scale(1.15); }
.color-preview-area { display: flex; flex-direction: column; align-items: center; gap: 12px; flex-shrink: 0; }
.color-contrast-info { font-size: 12px; color: var(--text-secondary); display: flex; flex-direction: column; gap: 4px; }
.color-contrast-info b { color: var(--text-primary); }
.color-palette-row { margin-top: 12px; }
.color-palette-row > label { font-size: 12px; color: var(--text-secondary); font-weight: 500; display: block; margin-bottom: 6px; }
.color-palette { display: flex; gap: 2px; border-radius: 8px; overflow: hidden; }
.color-palette-swatch {
  flex: 1; height: 48px; display: flex; align-items: flex-end;
  justify-content: center; cursor: pointer; transition: transform 0.15s;
}
.color-palette-swatch:hover { transform: scaleY(1.15); }
.color-palette-label { font-size: 9px; color: white; text-shadow: 0 1px 2px rgba(0,0,0,0.5); padding-bottom: 4px; }

/* ==================== Unicode 工具 ==================== */

.uni-table { margin-top: 16px; }
.uni-table > label { font-size: 12px; color: var(--text-secondary); font-weight: 500; display: block; margin-bottom: 8px; }
.uni-grid { border: 1px solid var(--border-color); border-radius: 6px; overflow: hidden; max-height: 400px; overflow-y: auto; }
.uni-grid-header {
  display: grid; grid-template-columns: 60px 90px 70px 120px 80px 80px 1fr;
  padding: 8px 12px; background: var(--bg-hover); font-size: 12px;
  font-weight: 600; color: var(--text-secondary);
}
.uni-grid-row {
  display: grid; grid-template-columns: 60px 90px 70px 120px 80px 80px 1fr;
  padding: 6px 12px; font-size: 13px; border-top: 1px solid var(--border-color);
}
.uni-grid-row:hover { background: var(--bg-hover); }
.uni-char { font-size: 18px; text-align: center; }
.uni-category { font-size: 11px; color: var(--text-secondary); }
.uni-grid-row code { font-size: 12px; color: var(--primary-color); }

/* ==================== 数字格式化 ==================== */

.num-formats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 16px; }
.num-format-item {
  display: flex; flex-direction: column; gap: 2px;
  padding: 12px; background: var(--bg-hover); border-radius: 8px;
  cursor: pointer; transition: all 0.2s; border: 1px solid transparent;
}
.num-format-item:hover { border-color: var(--primary-color); background: var(--primary-bg); }
.num-format-label { font-size: 11px; color: var(--text-secondary); font-weight: 500; }
.num-format-value { font-size: 15px; font-weight: 600; color: var(--text-primary); word-break: break-all; }
.num-format-value.mono { font-family: 'Courier New', Courier, monospace; font-size: 13px; }

/* ==================== 文本变换 ==================== */

.tt-modes { display: flex; flex-direction: column; gap: 10px; }
.tt-mode-group { display: flex; flex-direction: column; gap: 6px; }
.tt-mode-group > label { font-size: 12px; color: var(--text-secondary); font-weight: 500; }

/* ==================== cURL 解析 ==================== */

.curl-parsed { margin-top: 16px; }
.curl-header-row {
  padding: 4px 10px; background: var(--bg-hover); border-radius: 4px;
  margin-bottom: 4px; font-size: 12px;
}
.curl-header-row code { color: var(--text-primary); }

/* ==================== ASCII 表 ==================== */

.ascii-grid { margin-top: 12px; border: 1px solid var(--border-color); border-radius: 6px; overflow: hidden; max-height: 500px; overflow-y: auto; }
.ascii-header {
  display: grid; grid-template-columns: 50px 60px 60px 1fr;
  padding: 8px 12px; background: var(--bg-hover);
  font-size: 12px; font-weight: 600; color: var(--text-secondary);
  position: sticky; top: 0; z-index: 1;
}
.ascii-row {
  display: grid; grid-template-columns: 50px 60px 60px 1fr;
  padding: 4px 12px; font-size: 13px; border-top: 1px solid var(--border-color);
  cursor: pointer; transition: background 0.15s;
}
.ascii-row:hover { background: var(--bg-hover); }
.ascii-dec { font-family: 'Courier New', Courier, monospace; }
.ascii-hex { font-family: 'Courier New', Courier, monospace; color: var(--primary-color); }
.ascii-char { font-weight: 700; text-align: center; font-size: 14px; }
.ascii-desc { color: var(--text-secondary); font-size: 12px; }

/* ==================== CSS 单位转换 ==================== */

.css-units-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-top: 16px; }
.css-unit-card {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  padding: 16px 8px; background: var(--bg-hover); border-radius: 8px;
  cursor: pointer; transition: all 0.2s; border: 1px solid transparent;
}
.css-unit-card:hover { border-color: var(--primary-color); background: var(--primary-bg); }
.css-unit-val {
  font-size: 16px; font-weight: 700; color: var(--primary-color);
  font-family: 'Courier New', Courier, monospace;
}
.css-unit-name { font-size: 11px; color: var(--text-secondary); }

/* ==================== Markdown 表格生成器 ==================== */

.md-table-gen { margin-bottom: 12px; display: flex; flex-direction: column; gap: 6px; }
.md-table-gen > label { font-size: 12px; color: var(--text-secondary); font-weight: 500; }
.md-table-gen-row { display: flex; align-items: center; gap: 8px; }
.md-table-gen-row > span { font-size: 12px; color: var(--text-secondary); }
</style>
