<script setup lang="ts">
import { ref, computed } from 'vue';
import { copyText } from './tools-utils';

defineProps<{
  activeTool: string;
  isDark: boolean;
}>();

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
</script>

<template>
  <div>
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
  </div>
</template>

<style scoped>
@import './tools-common.css';

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
</style>
