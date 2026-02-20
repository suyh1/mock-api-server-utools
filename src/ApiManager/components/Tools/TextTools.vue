<script setup lang="ts">
import { ref, computed } from 'vue';
import { escapeHtml, copyText } from './tools-utils';

defineProps<{
  activeTool: string;
  isDark: boolean;
}>();

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
  const totalMinutes = chineseChars / 300 + englishWords / 200;
  let readTime: string;
  if (totalMinutes < 1) readTime = `${Math.max(1, Math.ceil(totalMinutes * 60))} 秒`;
  else if (totalMinutes < 60) readTime = `${Math.ceil(totalMinutes)} 分钟`;
  else readTime = `${Math.floor(totalMinutes / 60)} 小时 ${Math.ceil(totalMinutes % 60)} 分钟`;
  return { chars, charsNoSpace, words, lines, paragraphs, bytes, chineseChars, englishWords, uniqueLines, readTime };
});

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
  lines.push('| ' + Array.from({ length: cols }, (_, i) => `列${i + 1}`).join(' | ') + ' |');
  lines.push('| ' + Array.from({ length: cols }, () => alignStr).join(' | ') + ' |');
  for (let r = 0; r < rows; r++) {
    lines.push('| ' + Array.from({ length: cols }, () => '   ').join(' | ') + ' |');
  }
  const table = lines.join('\n');
  mdInput.value = mdInput.value ? mdInput.value + '\n\n' + table : table;
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
  return text
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/[-_./]+/g, ' ')
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
</script>

<template>
  <div>
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
  </div>
</template>

<style scoped>
@import './tools-common.css';

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

/* ==================== 文本对比 ==================== */

.diff-options { display: flex; gap: 16px; margin-bottom: 12px; }
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
.diff-stats-bar { display: flex; gap: 16px; font-size: 13px; margin-bottom: 8px; }
.diff-stats-bar b { margin: 0 2px; }
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
.diff-line-num {
  display: inline-block; min-width: 30px; text-align: right;
  color: var(--text-secondary); font-size: 12px; user-select: none;
  padding-right: 8px; margin-right: 4px; border-right: 1px solid var(--border-color);
}

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
.stat-value-sm {
  font-size: 18px !important;
}
.stat-label-text {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 4px;
}

/* ==================== Markdown 预览 ==================== */

.md-layout { align-items: stretch; }
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
.md-preview :deep(li) { margin-bottom: 2px; }
.md-preview :deep(a) { color: var(--primary-color); text-decoration: none; }
.md-preview :deep(a:hover) { text-decoration: underline; }
.md-table-gen { margin-bottom: 12px; display: flex; flex-direction: column; gap: 6px; }
.md-table-gen > label { font-size: 12px; color: var(--text-secondary); font-weight: 500; }
.md-table-gen-row { display: flex; align-items: center; gap: 8px; }
.md-table-gen-row > span { font-size: 12px; color: var(--text-secondary); }

/* ==================== 文本变换 ==================== */

.tt-modes { display: flex; flex-direction: column; gap: 10px; }
.tt-mode-group { display: flex; flex-direction: column; gap: 6px; }
.tt-mode-group > label { font-size: 12px; color: var(--text-secondary); font-weight: 500; }
</style>
