<script setup lang="ts">
import { ref, computed } from 'vue';
import CodeEditor from '../CodeEditor.vue';
import { escapeHtml, copyText } from './tools-utils';

defineProps<{
  activeTool: string;
  isDark: boolean;
}>();

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
  s = s.replace(/,\s*([}\]])/g, '$1');
  s = s.replace(/([{,]\s*)(\w+)\s*:/g, '$1"$2":');
  s = s.replace(/'/g, '"');
  s = s.replace(/\t/g, '  ');
  try {
    jsonOutput.value = JSON.stringify(JSON.parse(s), null, jsonIndent.value);
    jsonError.value = '';
  } catch (e: any) { jsonError.value = '修复失败：' + e.message; jsonOutput.value = s; }
}

/* ==================== JSON → TypeScript Interface ==================== */

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
  let expr = path.startsWith('$.') ? path.slice(2) : path.startsWith('$') ? path.slice(1) : path;
  const segments = parsePathSegments(expr);
  let current: any[] = [data];
  for (const seg of segments) {
    const next: any[] = [];
    for (const item of current) {
      if (seg.type === 'key') {
        if (item != null && typeof item === 'object' && seg.value in item) next.push(item[seg.value]);
      } else if (seg.type === 'index') {
        if (Array.isArray(item)) { const idx = parseInt(seg.value); if (idx >= 0 && idx < item.length) next.push(item[idx]); }
      } else if (seg.type === 'wildcard') {
        if (Array.isArray(item)) next.push(...item);
        else if (item != null && typeof item === 'object') next.push(...Object.values(item));
      } else if (seg.type === 'filter') {
        if (Array.isArray(item)) { for (const el of item) { if (evalFilter(el, seg.value)) next.push(el); } }
      } else if (seg.type === 'deepScan') {
        next.push(...collectByKey(item, seg.value));
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
        segments.push({ type: 'wildcard', value: '*' }); i++;
        if (expr[i] === ']') i++;
      } else if (expr[i] === '?') {
        i++;
        let depth = 1; let filter = '';
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
        else if (trimmed.startsWith("'") || trimmed.startsWith('"')) segments.push({ type: 'key', value: trimmed.slice(1, -1) });
        else segments.push({ type: 'key', value: trimmed });
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
    case '==': return fieldVal == cmpVal; case '!=': return fieldVal != cmpVal;
    case '>': return fieldVal > cmpVal; case '<': return fieldVal < cmpVal;
    case '>=': return fieldVal >= cmpVal; case '<=': return fieldVal <= cmpVal;
    default: return false;
  }
}

function collectAll(obj: any): any[] {
  const result: any[] = [];
  if (obj == null || typeof obj !== 'object') return [obj];
  if (Array.isArray(obj)) { for (const item of obj) { result.push(item); result.push(...collectAll(item)); } }
  else { for (const val of Object.values(obj)) { result.push(val); result.push(...collectAll(val)); } }
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

/* ==================== JSON Diff ==================== */

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
        if (inA && !inB) diffs.push({ path: p, type: 'removed', oldVal: JSON.stringify(objA[key]) });
        else if (!inA && inB) diffs.push({ path: p, type: 'added', newVal: JSON.stringify(objB[key]) });
        else if (inA && inB) {
          const va = objA[key], vb = objB[key];
          if (typeof va === 'object' && va !== null && typeof vb === 'object' && vb !== null) walk(va, vb, p);
          else if (va !== vb) diffs.push({ path: p, type: 'changed', oldVal: JSON.stringify(va), newVal: JSON.stringify(vb) });
        }
      }
    }
    walk(a, b, '$');
    jdOutput.value = diffs;
  } catch (e: any) { jdError.value = e.message; }
}
</script>

<template>
  <!-- JSON 格式化 -->
  <template v-if="activeTool === 'json'">
    <div class="tool-row json-editors">
      <div class="tool-col">
        <label>输入</label>
        <div class="editor-box"><CodeEditor v-model="jsonInput" language="json" :isDark="isDark" /></div>
      </div>
      <div class="tool-col">
        <label>输出</label>
        <div class="editor-box"><CodeEditor v-model="jsonOutput" language="json" :isDark="isDark" :readonly="true" /></div>
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
        <div class="editor-box"><CodeEditor :modelValue="j2tsInput" @change="onJ2tsJsonChange" language="json" :isDark="isDark" /></div>
      </div>
      <div class="tool-col">
        <label>TypeScript Interface 输出</label>
        <div class="editor-box"><CodeEditor v-model="j2tsOutput" language="typescript" :isDark="isDark" :readonly="true" /></div>
      </div>
    </div>
    <div v-if="j2tsError" class="tool-error">{{ j2tsError }}</div>
    <div class="tool-toolbar">
      <el-button type="primary" @click="jsonToTs">转换</el-button>
      <el-button @click="copyText(j2tsOutput)" :disabled="!j2tsOutput">复制结果</el-button>
    </div>
  </template>

  <!-- JSONPath 查询 -->
  <template v-if="activeTool === 'jsonpath'">
    <div class="tool-row json-editors">
      <div class="tool-col">
        <label>JSON 数据</label>
        <div class="editor-box"><CodeEditor v-model="jpInput" language="json" :isDark="isDark" /></div>
      </div>
      <div class="tool-col">
        <label>查询结果</label>
        <div class="editor-box"><CodeEditor v-model="jpOutput" language="json" :isDark="isDark" :readonly="true" /></div>
      </div>
    </div>
    <div class="tool-col" style="margin-top: 12px;">
      <label>JSONPath 表达式</label>
      <el-input v-model="jpPath" placeholder="如 $.store.book[*].author" />
    </div>
    <div class="regex-presets" style="margin-top: 12px;">
      <label>常用表达式</label>
      <div class="regex-preset-list">
        <span v-for="p in jpPresets" :key="p.label" class="regex-preset-tag" @click="jpPath = p.path">{{ p.label }} <code>{{ p.path }}</code></span>
      </div>
    </div>
    <div v-if="jpError" class="tool-error">{{ jpError }}</div>
    <div class="tool-toolbar">
      <el-button type="primary" @click="queryJsonPath">查询</el-button>
      <el-button @click="copyText(jpOutput)" :disabled="!jpOutput">复制结果</el-button>
    </div>
  </template>

  <!-- JSON Diff -->
  <template v-if="activeTool === 'jsondiff'">
    <div class="tool-row json-editors">
      <div class="tool-col">
        <label>左侧 JSON</label>
        <div class="editor-box"><CodeEditor v-model="jdLeft" language="json" :isDark="isDark" /></div>
      </div>
      <div class="tool-col">
        <label>右侧 JSON</label>
        <div class="editor-box"><CodeEditor v-model="jdRight" language="json" :isDark="isDark" /></div>
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
</template>

<style scoped>
@import './tools-common.css';

.json-stats {
  display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 8px;
  padding: 8px 12px; background: var(--bg-hover); border-radius: 6px;
  font-size: 12px; color: var(--text-secondary);
}
.json-stats b { color: var(--primary-color); }

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
.jd-type-badge { font-size: 11px; padding: 2px 6px; border-radius: 3px; font-weight: 600; font-family: inherit; }
.jd-added .jd-type-badge { background: rgba(103, 194, 58, 0.2); color: #67c23a; }
.jd-removed .jd-type-badge { background: rgba(245, 108, 108, 0.2); color: #f56c6c; }
.jd-changed .jd-type-badge { background: rgba(230, 162, 60, 0.2); color: #e6a23c; }
.jd-old { color: #f56c6c; text-decoration: line-through; }
.jd-arrow { color: var(--text-secondary); }
.jd-new { color: #67c23a; }
</style>
