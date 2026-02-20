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
      { key: 'json', label: 'JSON 格式化', icon: '{ }', desc: '格式化或压缩 JSON 字符串' },
      { key: 'json2ts', label: 'JSON → TS', icon: 'TS', desc: '将 JSON 转换为 TypeScript Interface' },
    ],
  },
  {
    category: '编码转换',
    categoryEn: 'ENCODE',
    tools: [
      { key: 'url', label: 'URL 编解码', icon: '%', desc: 'URL 编码与解码转换' },
      { key: 'base64', label: 'Base64 编解码', icon: 'B64', desc: 'Base64 编码与解码转换' },
      { key: 'htmlencode', label: 'HTML 实体', icon: '&;', desc: 'HTML 特殊字符实体编码与解码' },
    ],
  },
  {
    category: '数据工具',
    categoryEn: 'DATA',
    tools: [
      { key: 'timestamp', label: '时间戳转换', icon: 'T', desc: '时间戳与日期字符串互转' },
      { key: 'uuid', label: 'UUID 生成', icon: 'ID', desc: '批量生成 UUID v4' },
      { key: 'color', label: '颜色转换', icon: 'Clr', desc: 'HEX / RGB / HSL 颜色互转' },
      { key: 'radix', label: '进制转换', icon: '0x', desc: '二/八/十/十六进制互转' },
      { key: 'hash', label: '哈希生成', icon: '#', desc: 'SHA-1 / SHA-256 / SHA-512 哈希' },
      { key: 'password', label: '随机密码', icon: '***', desc: '可配置长度和字符类型的密码生成' },
    ],
  },
  {
    category: '文本工具',
    categoryEn: 'TEXT',
    tools: [
      { key: 'regex', label: '正则测试', icon: '.*', desc: '正则表达式在线测试与匹配高亮' },
      { key: 'diff', label: '文本对比', icon: 'Ab', desc: '基于 LCS 的逐行文本差异对比' },
      { key: 'markdown', label: 'Markdown 预览', icon: 'Md', desc: '输入 Markdown 实时预览渲染结果' },
      { key: 'textstat', label: '文本统计', icon: 'Aa', desc: '统计字符数、字数、行数、字节数' },
    ],
  },
  {
    category: '解析工具',
    categoryEn: 'PARSE',
    tools: [
      { key: 'jwt', label: 'JWT 解析', icon: 'JWT', desc: '解码 JWT Token 的 Header 和 Payload' },
      { key: 'cron', label: 'Cron 表达式', icon: '*/5', desc: '解析 Cron 为中文描述 + 执行时间' },
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

function formatJson() {
  try {
    jsonOutput.value = JSON.stringify(JSON.parse(jsonInput.value), null, 2);
    jsonError.value = '';
  } catch (e: any) { jsonError.value = e.message; jsonOutput.value = ''; }
}

function compressJson() {
  try {
    jsonOutput.value = JSON.stringify(JSON.parse(jsonInput.value));
    jsonError.value = '';
  } catch (e: any) { jsonError.value = e.message; jsonOutput.value = ''; }
}

/* ==================== URL 编解码工具 ==================== */

const urlInput = ref('');
const urlOutput = ref('');

function urlEncode() { urlOutput.value = encodeURIComponent(urlInput.value); }
function urlDecode() {
  try { urlOutput.value = decodeURIComponent(urlInput.value); }
  catch { urlOutput.value = '解码失败：输入不是有效的编码字符串'; }
}

/* ==================== Base64 编解码工具 ==================== */

const b64Input = ref('');
const b64Output = ref('');

function b64Encode() {
  try { b64Output.value = btoa(unescape(encodeURIComponent(b64Input.value))); }
  catch { b64Output.value = '编码失败'; }
}
function b64Decode() {
  try { b64Output.value = decodeURIComponent(escape(atob(b64Input.value))); }
  catch { b64Output.value = '解码失败：输入不是有效的 Base64 字符串'; }
}

/* ==================== 时间戳转换工具 ==================== */

const tsInput = ref('');
const tsOutput = ref('');
const nowTs = ref(Math.floor(Date.now() / 1000));
setInterval(() => { nowTs.value = Math.floor(Date.now() / 1000); }, 1000);

function tsToDate() {
  const n = Number(tsInput.value);
  if (isNaN(n)) { tsOutput.value = '请输入有效数字'; return; }
  const ms = String(n).length > 10 ? n : n * 1000;
  tsOutput.value = new Date(ms).toLocaleString('zh-CN', { hour12: false });
}

function dateToTs() {
  const d = new Date(tsInput.value);
  if (isNaN(d.getTime())) { tsOutput.value = '请输入有效日期，如 2024-01-01 12:00:00'; return; }
  tsOutput.value = `秒级：${Math.floor(d.getTime() / 1000)}\n毫秒级：${d.getTime()}`;
}

/* ==================== UUID 生成工具 ==================== */

const uuidCount = ref(1);
const uuidOutput = ref('');

function generateUUID() {
  const results: string[] = [];
  for (let i = 0; i < uuidCount.value; i++) results.push(crypto.randomUUID());
  uuidOutput.value = results.join('\n');
}

/* ==================== 正则测试工具 ==================== */

const regexPattern = ref('');
const regexFlags = ref('g');
const regexTestStr = ref('');

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

const colorPreview = computed(() => colorHex.value);
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

const diffResult = computed(() => {
  const linesA = diffLeft.value.split('\n');
  const linesB = diffRight.value.split('\n');
  if (!diffLeft.value && !diffRight.value) return [];
  const m = linesA.length, n = linesB.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = linesA[i - 1] === linesB[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
  const result: { type: 'same' | 'del' | 'add'; text: string }[] = [];
  let i = m, j = n;
  const stack: typeof result = [];
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && linesA[i - 1] === linesB[j - 1]) { stack.push({ type: 'same', text: linesA[i - 1] }); i--; j--; }
    else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) { stack.push({ type: 'add', text: linesB[j - 1] }); j--; }
    else { stack.push({ type: 'del', text: linesA[i - 1] }); i--; }
  }
  while (stack.length) result.push(stack.pop()!);
  return result;
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
  if (!text) return { chars: 0, words: 0, lines: 0, bytes: 0 };
  const chars = text.length;
  const lines = text.split('\n').length;
  const bytes = new TextEncoder().encode(text).length;
  const chineseChars = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
  const stripped = text.replace(/[\u4e00-\u9fff\u3400-\u4dbf]/g, ' ').trim();
  const englishWords = stripped ? stripped.split(/\s+/).filter(w => w.length > 0).length : 0;
  const words = chineseChars + englishWords;
  return { chars, words, lines, bytes };
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
            <div class="tool-toolbar">
              <el-button type="primary" @click="formatJson">格式化</el-button>
              <el-button @click="compressJson">压缩</el-button>
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
              <el-button type="primary" @click="urlEncode">编码 (Encode)</el-button>
              <el-button type="primary" @click="urlDecode">解码 (Decode)</el-button>
              <el-button @click="copyText(urlOutput)" :disabled="!urlOutput">复制结果</el-button>
            </div>
          </template>

          <!-- Base64 编解码 -->
          <template v-if="activeTool === 'base64'">
            <div class="tool-row">
              <div class="tool-col">
                <label>输入</label>
                <el-input v-model="b64Input" type="textarea" :rows="6" placeholder="输入文本或 Base64 字符串..." />
              </div>
              <div class="tool-col">
                <label>输出</label>
                <el-input v-model="b64Output" type="textarea" :rows="6" readonly />
              </div>
            </div>
            <div class="tool-toolbar">
              <el-button type="primary" @click="b64Encode">编码 (Encode)</el-button>
              <el-button type="primary" @click="b64Decode">解码 (Decode)</el-button>
              <el-button @click="copyText(b64Output)" :disabled="!b64Output">复制结果</el-button>
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
            <div class="tool-hint">当前时间戳（秒）：<code>{{ nowTs }}</code></div>
            <div class="tool-row">
              <div class="tool-col">
                <label>输入（时间戳或日期字符串）</label>
                <el-input v-model="tsInput" placeholder="如 1700000000 或 2024-01-01 12:00:00" />
              </div>
              <div class="tool-col">
                <label>输出</label>
                <el-input v-model="tsOutput" type="textarea" :rows="3" readonly />
              </div>
            </div>
            <div class="tool-toolbar">
              <el-button type="primary" @click="tsToDate">时间戳 → 日期</el-button>
              <el-button type="primary" @click="dateToTs">日期 → 时间戳</el-button>
              <el-button @click="copyText(tsOutput)" :disabled="!tsOutput">复制结果</el-button>
            </div>
          </template>

          <!-- UUID 生成 -->
          <template v-if="activeTool === 'uuid'">
            <div class="tool-row" style="align-items: flex-start;">
              <div class="tool-col" style="flex: 0 0 200px;">
                <label>生成数量</label>
                <el-input-number v-model="uuidCount" :min="1" :max="100" />
              </div>
              <div class="tool-col">
                <label>结果</label>
                <el-input v-model="uuidOutput" type="textarea" :rows="8" readonly />
              </div>
            </div>
            <div class="tool-toolbar">
              <el-button type="primary" @click="generateUUID">生成</el-button>
              <el-button @click="copyText(uuidOutput)" :disabled="!uuidOutput">复制结果</el-button>
            </div>
          </template>

          <!-- 颜色转换 -->
          <template v-if="activeTool === 'color'">
            <div class="color-tool-layout">
              <div class="color-inputs">
                <div class="tool-col">
                  <label>HEX</label>
                  <el-input v-model="colorHex" placeholder="#409EFF" @input="onColorHexInput" />
                </div>
                <div class="tool-col">
                  <label>RGB</label>
                  <div class="color-rgb-row">
                    <el-input-number v-model="colorR" :min="0" :max="255" controls-position="right" @change="onColorRgbInput" />
                    <el-input-number v-model="colorG" :min="0" :max="255" controls-position="right" @change="onColorRgbInput" />
                    <el-input-number v-model="colorB" :min="0" :max="255" controls-position="right" @change="onColorRgbInput" />
                  </div>
                </div>
                <div class="tool-col">
                  <label>HSL</label>
                  <div class="color-rgb-row">
                    <el-input-number v-model="colorH" :min="0" :max="360" controls-position="right" @change="onColorHslInput" />
                    <el-input-number v-model="colorS" :min="0" :max="100" controls-position="right" @change="onColorHslInput" />
                    <el-input-number v-model="colorL" :min="0" :max="100" controls-position="right" @change="onColorHslInput" />
                  </div>
                </div>
              </div>
              <div class="color-preview" :style="{ background: colorPreview }"></div>
            </div>
            <div class="tool-toolbar">
              <el-button @click="copyText(colorHex)">复制 HEX</el-button>
              <el-button @click="copyText(`rgb(${colorR}, ${colorG}, ${colorB})`)">复制 RGB</el-button>
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
            <div class="tool-col" style="margin-top: 12px;">
              <label>测试文本</label>
              <el-input v-model="regexTestStr" type="textarea" :rows="4" placeholder="输入要测试的文本..." />
            </div>
            <div v-if="regexTestStr" class="regex-result">
              <label>匹配结果（{{ regexMatches.length }} 个匹配）</label>
              <div class="regex-preview" v-html="regexHighlighted"></div>
            </div>
          </template>

          <!-- 文本对比 -->
          <template v-if="activeTool === 'diff'">
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
              <label>对比结果</label>
              <div class="diff-lines">
                <div
                  v-for="(line, idx) in diffResult" :key="idx"
                  class="diff-line"
                  :class="{ 'diff-del': line.type === 'del', 'diff-add': line.type === 'add' }"
                >
                  <span class="diff-prefix">{{ line.type === 'del' ? '-' : line.type === 'add' ? '+' : ' ' }}</span>
                  <span>{{ line.text }}</span>
                </div>
              </div>
            </div>
          </template>

          <!-- Markdown 预览 -->
          <template v-if="activeTool === 'markdown'">
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
                <div class="stat-value">{{ textStats.words }}</div>
                <div class="stat-label-text">字数</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">{{ textStats.lines }}</div>
                <div class="stat-label-text">行数</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">{{ textStats.bytes }}</div>
                <div class="stat-label-text">字节数 (UTF-8)</div>
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
              <CodeEditor :modelValue="docResult" language="markdown" :readOnly="true" :isDark="isDark" />
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
</style>
