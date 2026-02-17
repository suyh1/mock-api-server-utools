<script setup lang="ts">
import { ref, computed, inject } from 'vue';
import CodeEditor from '../CodeEditor.vue';

const isDark = inject('isDark', ref(false));

const activeTool = ref('json');

const tools = [
  { key: 'json', label: 'JSON 格式化', icon: '{ }' },
  { key: 'url', label: 'URL 编解码', icon: '%' },
  { key: 'base64', label: 'Base64 编解码', icon: 'B64' },
  { key: 'timestamp', label: '时间戳转换', icon: '⏱' },
  { key: 'uuid', label: 'UUID 生成', icon: 'ID' },
  { key: 'regex', label: '正则测试', icon: '.*' },
  { key: 'json2ts', label: 'JSON → TS', icon: 'TS' },
];

// JSON
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

// URL
const urlInput = ref('');
const urlOutput = ref('');
function urlEncode() { urlOutput.value = encodeURIComponent(urlInput.value); }
function urlDecode() {
  try { urlOutput.value = decodeURIComponent(urlInput.value); }
  catch { urlOutput.value = '解码失败：输入不是有效的编码字符串'; }
}

// Base64
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

// Timestamp
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

// UUID
const uuidCount = ref(1);
const uuidOutput = ref('');
function generateUUID() {
  const results: string[] = [];
  for (let i = 0; i < uuidCount.value; i++) {
    results.push(crypto.randomUUID());
  }
  uuidOutput.value = results.join('\n');
}

// Regex
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

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function copyText(text: string) {
  navigator.clipboard.writeText(text);
}

// JSON → TS
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
    if (obj.length > 0 && typeof obj[0] === 'object' && obj[0] !== null) {
      generateInterface(obj[0], name, out);
    }
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
    const itemType = inferType(val[0], hint + 'Item', out);
    return `${itemType}[]`;
  }
  if (typeof val === 'object') {
    generateInterface(val, hint, out);
    return hint;
  }
  return typeof val;
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
</script>

<template>
  <div class="tools-panel">
    <aside class="tools-sidebar">
      <div
        v-for="t in tools" :key="t.key"
        class="tool-item" :class="{ active: activeTool === t.key }"
        @click="activeTool = t.key"
      >
        <span class="tool-icon">{{ t.icon }}</span>
        <span class="tool-label">{{ t.label }}</span>
      </div>
    </aside>

    <div class="tools-content">
      <!-- JSON 格式化 -->
      <div v-if="activeTool === 'json'" class="tool-area">
        <h3>JSON 格式化</h3>
        <div class="tool-row">
          <div class="tool-col">
            <label>输入</label>
            <el-input v-model="jsonInput" type="textarea" :rows="12" placeholder="粘贴 JSON 字符串..." />
          </div>
          <div class="tool-col">
            <label>输出</label>
            <el-input v-model="jsonOutput" type="textarea" :rows="12" readonly />
          </div>
        </div>
        <div v-if="jsonError" class="tool-error">{{ jsonError }}</div>
        <div class="tool-actions">
          <el-button type="primary" @click="formatJson">格式化</el-button>
          <el-button @click="compressJson">压缩</el-button>
          <el-button @click="copyText(jsonOutput)" :disabled="!jsonOutput">复制结果</el-button>
        </div>
      </div>

      <!-- URL 编解码 -->
      <div v-if="activeTool === 'url'" class="tool-area">
        <h3>URL 编解码</h3>
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
        <div class="tool-actions">
          <el-button type="primary" @click="urlEncode">编码 (Encode)</el-button>
          <el-button type="primary" @click="urlDecode">解码 (Decode)</el-button>
          <el-button @click="copyText(urlOutput)" :disabled="!urlOutput">复制结果</el-button>
        </div>
      </div>

      <!-- Base64 编解码 -->
      <div v-if="activeTool === 'base64'" class="tool-area">
        <h3>Base64 编解码</h3>
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
        <div class="tool-actions">
          <el-button type="primary" @click="b64Encode">编码 (Encode)</el-button>
          <el-button type="primary" @click="b64Decode">解码 (Decode)</el-button>
          <el-button @click="copyText(b64Output)" :disabled="!b64Output">复制结果</el-button>
        </div>
      </div>

      <!-- 时间戳转换 -->
      <div v-if="activeTool === 'timestamp'" class="tool-area">
        <h3>时间戳转换</h3>
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
        <div class="tool-actions">
          <el-button type="primary" @click="tsToDate">时间戳 → 日期</el-button>
          <el-button type="primary" @click="dateToTs">日期 → 时间戳</el-button>
          <el-button @click="copyText(tsOutput)" :disabled="!tsOutput">复制结果</el-button>
        </div>
      </div>

      <!-- UUID 生成 -->
      <div v-if="activeTool === 'uuid'" class="tool-area">
        <h3>UUID 生成</h3>
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
        <div class="tool-actions">
          <el-button type="primary" @click="generateUUID">生成</el-button>
          <el-button @click="copyText(uuidOutput)" :disabled="!uuidOutput">复制结果</el-button>
        </div>
      </div>

      <!-- 正则测试 -->
      <div v-if="activeTool === 'regex'" class="tool-area">
        <h3>正则测试</h3>
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
      </div>

      <!-- JSON → TS -->
      <div v-if="activeTool === 'json2ts'" class="tool-area">
        <h3>JSON → TypeScript Interface</h3>
        <div class="tool-col" style="margin-bottom: 12px;">
          <label>根 Interface 名称</label>
          <el-input v-model="j2tsRootName" placeholder="Root" style="width: 200px;" />
        </div>
        <div class="tool-row j2ts-editors">
          <div class="tool-col">
            <label>JSON 输入</label>
            <div class="editor-box">
              <CodeEditor
                :modelValue="j2tsInput"
                @change="onJ2tsJsonChange"
                language="json"
                :isDark="isDark"
              />
            </div>
          </div>
          <div class="tool-col">
            <label>TypeScript Interface 输出</label>
            <div class="editor-box">
              <CodeEditor
                v-model="j2tsOutput"
                language="typescript"
                :isDark="isDark"
                :readonly="true"
              />
            </div>
          </div>
        </div>
        <div v-if="j2tsError" class="tool-error">{{ j2tsError }}</div>
        <div class="tool-actions">
          <el-button type="primary" @click="jsonToTs">转换</el-button>
          <el-button @click="copyText(j2tsOutput)" :disabled="!j2tsOutput">复制结果</el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tools-panel {
  display: flex;
  height: 100%;
  overflow: hidden;
}
.tools-sidebar {
  width: 140px;
  flex-shrink: 0;
  border-right: 1px solid var(--border-color);
  padding: 12px 8px;
  overflow-y: auto;
}
.tool-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  color: var(--text-secondary);
  font-size: 13px;
  transition: all 0.2s;
  margin-bottom: 4px;
}
.tool-item:hover { background: var(--bg-hover); color: var(--text-primary); }
.tool-item.active { background: var(--primary-bg); color: var(--primary-color); font-weight: 600; }
.tool-icon {
  font-size: 12px;
  font-weight: 700;
  width: 28px;
  text-align: center;
  flex-shrink: 0;
  font-family: monospace;
}
.tool-label { white-space: nowrap; }
.tools-content {
  flex: 1;
  padding: 20px 24px;
  overflow-y: auto;
}
.tool-area h3 {
  margin: 0 0 16px;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}
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
.tool-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
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
.j2ts-editors {
  height: 350px;
}
.editor-box {
  flex: 1;
  min-height: 0;
  border-radius: 6px;
  overflow: hidden;
}
</style>