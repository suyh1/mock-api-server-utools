/**
 * @file ToolsPanel.vue - 开发工具集面板
 * @description 提供常用开发小工具的集合页面，包含 JSON 格式化、URL 编解码、
 *              Base64 编解码、时间戳转换、UUID 生成、正则测试、JSON → TS 转换等工具。
 *              左侧为工具菜单列表，右侧为对应工具的操作区域。
 */
<script setup lang="ts">
import { ref, computed, inject } from 'vue';
/** 引入代码编辑器组件，用于 JSON → TS 工具的代码编辑和高亮 */
import CodeEditor from '../CodeEditor.vue';

/** 注入深色模式状态，用于 CodeEditor 主题切换 */
const isDark = inject('isDark', ref(false));

/** 当前选中的工具标识，默认为 JSON 格式化 */
const activeTool = ref('json');

/**
 * 工具列表配置
 * @property {string} key - 工具唯一标识，用于条件渲染
 * @property {string} label - 工具显示名称
 * @property {string} icon - 工具图标文字
 */
const tools = [
  { key: 'json', label: 'JSON 格式化', icon: '{ }' },
  { key: 'url', label: 'URL 编解码', icon: '%' },
  { key: 'base64', label: 'Base64 编解码', icon: 'B64' },
  { key: 'timestamp', label: '时间戳转换', icon: '⏱' },
  { key: 'uuid', label: 'UUID 生成', icon: 'ID' },
  { key: 'regex', label: '正则测试', icon: '.*' },
  { key: 'json2ts', label: 'JSON → TS', icon: 'TS' },
];

/* ==================== JSON 格式化工具 ==================== */

/** JSON 输入文本 */
const jsonInput = ref('');
/** JSON 格式化/压缩后的输出文本 */
const jsonOutput = ref('');
/** JSON 解析错误信息 */
const jsonError = ref('');

/**
 * 格式化 JSON 字符串
 * @description 将输入的 JSON 字符串解析后以 2 空格缩进重新格式化输出
 */
function formatJson() {
  try {
    jsonOutput.value = JSON.stringify(JSON.parse(jsonInput.value), null, 2);
    jsonError.value = '';
  } catch (e: any) { jsonError.value = e.message; jsonOutput.value = ''; }
}

/**
 * 压缩 JSON 字符串
 * @description 将输入的 JSON 字符串解析后去除所有空白字符，输出单行紧凑格式
 */
function compressJson() {
  try {
    jsonOutput.value = JSON.stringify(JSON.parse(jsonInput.value));
    jsonError.value = '';
  } catch (e: any) { jsonError.value = e.message; jsonOutput.value = ''; }
}

/* ==================== URL 编解码工具 ==================== */

/** URL 编解码输入文本 */
const urlInput = ref('');
/** URL 编解码输出文本 */
const urlOutput = ref('');

/**
 * URL 编码
 * @description 使用 encodeURIComponent 对输入文本进行 URL 编码
 */
function urlEncode() { urlOutput.value = encodeURIComponent(urlInput.value); }

/**
 * URL 解码
 * @description 使用 decodeURIComponent 对输入文本进行 URL 解码，解码失败时提示错误
 */
function urlDecode() {
  try { urlOutput.value = decodeURIComponent(urlInput.value); }
  catch { urlOutput.value = '解码失败：输入不是有效的编码字符串'; }
}

/* ==================== Base64 编解码工具 ==================== */

/** Base64 编解码输入文本 */
const b64Input = ref('');
/** Base64 编解码输出文本 */
const b64Output = ref('');

/**
 * Base64 编码
 * @description 先将 UTF-8 文本转为 Latin1 编码，再通过 btoa 转为 Base64 字符串
 */
function b64Encode() {
  try { b64Output.value = btoa(unescape(encodeURIComponent(b64Input.value))); }
  catch { b64Output.value = '编码失败'; }
}

/**
 * Base64 解码
 * @description 先通过 atob 解码 Base64，再将 Latin1 编码还原为 UTF-8 文本
 */
function b64Decode() {
  try { b64Output.value = decodeURIComponent(escape(atob(b64Input.value))); }
  catch { b64Output.value = '解码失败：输入不是有效的 Base64 字符串'; }
}

/* ==================== 时间戳转换工具 ==================== */

/** 时间戳/日期输入文本 */
const tsInput = ref('');
/** 转换结果输出文本 */
const tsOutput = ref('');
/** 当前实时时间戳（秒级），每秒自动更新 */
const nowTs = ref(Math.floor(Date.now() / 1000));
/** 定时器：每秒刷新当前时间戳显示 */
setInterval(() => { nowTs.value = Math.floor(Date.now() / 1000); }, 1000);

/**
 * 时间戳转日期
 * @description 自动识别秒级（10位）和毫秒级（13位）时间戳，转换为中文格式日期字符串
 */
function tsToDate() {
  const n = Number(tsInput.value);
  if (isNaN(n)) { tsOutput.value = '请输入有效数字'; return; }
  const ms = String(n).length > 10 ? n : n * 1000;
  tsOutput.value = new Date(ms).toLocaleString('zh-CN', { hour12: false });
}

/**
 * 日期转时间戳
 * @description 将日期字符串解析为 Date 对象，同时输出秒级和毫秒级时间戳
 */
function dateToTs() {
  const d = new Date(tsInput.value);
  if (isNaN(d.getTime())) { tsOutput.value = '请输入有效日期，如 2024-01-01 12:00:00'; return; }
  tsOutput.value = `秒级：${Math.floor(d.getTime() / 1000)}\n毫秒级：${d.getTime()}`;
}

/* ==================== UUID 生成工具 ==================== */

/** UUID 批量生成数量，默认 1 个 */
const uuidCount = ref(1);
/** UUID 生成结果，多个 UUID 以换行分隔 */
const uuidOutput = ref('');

/**
 * 批量生成 UUID v4
 * @description 使用 crypto.randomUUID() 生成指定数量的 UUID，每行一个
 */
function generateUUID() {
  const results: string[] = [];
  for (let i = 0; i < uuidCount.value; i++) {
    results.push(crypto.randomUUID());
  }
  uuidOutput.value = results.join('\n');
}

/* ==================== 正则测试工具 ==================== */

/** 正则表达式模式字符串 */
const regexPattern = ref('');
/** 正则表达式标志位，默认全局匹配 */
const regexFlags = ref('g');
/** 正则测试的目标文本 */
const regexTestStr = ref('');

/**
 * 正则匹配结果列表（计算属性）
 * @description 根据输入的正则模式和标志位，对测试文本执行匹配，
 *              返回所有匹配项的起止位置和匹配文本。
 *              支持全局匹配（g 标志）和单次匹配两种模式。
 * @returns {{ start: number, end: number, text: string }[]} 匹配结果数组
 */
const regexMatches = computed(() => {
  if (!regexPattern.value || !regexTestStr.value) return [];
  try {
    const re = new RegExp(regexPattern.value, regexFlags.value);
    const matches: { start: number; end: number; text: string }[] = [];
    let m: RegExpExecArray | null;
    if (regexFlags.value.includes('g')) {
      /** 全局匹配模式：循环执行 exec 直到无更多匹配 */
      while ((m = re.exec(regexTestStr.value)) !== null) {
        matches.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
        /** 防止零长度匹配导致的无限循环 */
        if (!m[0].length) re.lastIndex++;
      }
    } else {
      /** 单次匹配模式：只取第一个匹配结果 */
      m = re.exec(regexTestStr.value);
      if (m) matches.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
    }
    return matches;
  } catch { return []; }
});

/**
 * 正则匹配结果高亮 HTML（计算属性）
 * @description 将测试文本中的匹配部分用 <mark> 标签包裹，实现高亮显示。
 *              非匹配部分进行 HTML 转义以防止 XSS。
 * @returns {string} 包含高亮标记的 HTML 字符串
 */
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

/**
 * HTML 特殊字符转义
 * @param {string} s - 需要转义的原始字符串
 * @returns {string} 转义后的安全字符串（& < > 被替换为对应实体）
 */
function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * 复制文本到剪贴板
 * @param {string} text - 要复制的文本内容
 */
function copyText(text: string) {
  navigator.clipboard.writeText(text);
}

/* ==================== JSON → TypeScript Interface 转换工具 ==================== */

/** JSON → TS 的 JSON 输入文本 */
const j2tsInput = ref('');
/** JSON → TS 的 TypeScript Interface 输出文本 */
const j2tsOutput = ref('');
/** JSON → TS 的错误信息（JSON 解析失败时显示） */
const j2tsError = ref('');
/** 根 Interface 名称，默认为 'Root' */
const j2tsRootName = ref('Root');

/**
 * 执行 JSON → TypeScript Interface 转换
 * @description 解析输入的 JSON 字符串，递归生成对应的 TypeScript Interface 定义
 */
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

/**
 * CodeEditor 内容变更回调
 * @description 当 JSON 编辑器内容变化时触发，更新输入值并尝试自动格式化
 * @param {string} val - 编辑器当前内容
 */
function onJ2tsJsonChange(val: string) {
  j2tsInput.value = val;
  tryFormatJ2tsInput();
}

/**
 * 尝试自动格式化 JSON 输入
 * @description 解析 JSON 字符串并以 2 空格缩进重新格式化，解析失败时设置错误提示
 */
function tryFormatJ2tsInput() {
  try {
    const parsed = JSON.parse(j2tsInput.value);
    j2tsInput.value = JSON.stringify(parsed, null, 2);
    j2tsError.value = '';
  } catch (e: any) {
    j2tsError.value = j2tsInput.value.trim() ? e.message : '';
  }
}

/**
 * 递归生成 TypeScript Interface 定义
 * @description 遍历对象的所有属性，为每个嵌套对象生成独立的 Interface。
 *              数组类型取第一个元素作为类型推断依据。
 * @param {any} obj - 要转换的 JavaScript 对象
 * @param {string} name - 生成的 Interface 名称
 * @param {string[]} out - Interface 定义字符串的收集数组
 */
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

/**
 * 推断 JavaScript 值对应的 TypeScript 类型
 * @description 根据值的类型返回对应的 TS 类型字符串：
 *              - null/undefined → 'unknown'
 *              - 数组 → 递归推断元素类型并加 '[]'
 *              - 对象 → 生成子 Interface 并返回 Interface 名称
 *              - 基本类型 → 直接返回 typeof 结果
 * @param {any} val - 要推断类型的值
 * @param {string} hint - 类型名称提示（用于生成子 Interface 名称）
 * @param {string[]} out - Interface 定义字符串的收集数组
 * @returns {string} TypeScript 类型字符串
 */
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

/**
 * 首字母大写
 * @param {string} s - 输入字符串
 * @returns {string} 首字母大写后的字符串，用于生成 Interface 名称
 */
function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
</script>

<template>
  <!-- 工具集面板：左侧工具菜单 + 右侧工具操作区 -->
  <div class="tools-panel">
    <!-- 左侧工具导航栏 -->
    <aside class="tools-sidebar">
      <!-- 遍历工具列表，点击切换当前激活的工具 -->
      <div
        v-for="t in tools" :key="t.key"
        class="tool-item" :class="{ active: activeTool === t.key }"
        @click="activeTool = t.key"
      >
        <span class="tool-icon">{{ t.icon }}</span>
        <span class="tool-label">{{ t.label }}</span>
      </div>
    </aside>

    <!-- 右侧工具内容区域 -->
    <div class="tools-content">
      <!-- JSON 格式化工具 -->
      <div v-if="activeTool === 'json'" class="tool-area">
        <h3>JSON 格式化</h3>
        <!-- 输入输出双栏布局 -->
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
        <!-- JSON 解析错误提示 -->
        <div v-if="jsonError" class="tool-error">{{ jsonError }}</div>
        <!-- 操作按钮：格式化 / 压缩 / 复制 -->
        <div class="tool-actions">
          <el-button type="primary" @click="formatJson">格式化</el-button>
          <el-button @click="compressJson">压缩</el-button>
          <el-button @click="copyText(jsonOutput)" :disabled="!jsonOutput">复制结果</el-button>
        </div>
      </div>

      <!-- URL 编解码工具 -->
      <div v-if="activeTool === 'url'" class="tool-area">
        <h3>URL 编解码</h3>
        <!-- 输入输出双栏布局 -->
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
        <!-- 操作按钮：编码 / 解码 / 复制 -->
        <div class="tool-actions">
          <el-button type="primary" @click="urlEncode">编码 (Encode)</el-button>
          <el-button type="primary" @click="urlDecode">解码 (Decode)</el-button>
          <el-button @click="copyText(urlOutput)" :disabled="!urlOutput">复制结果</el-button>
        </div>
      </div>

      <!-- Base64 编解码工具 -->
      <div v-if="activeTool === 'base64'" class="tool-area">
        <h3>Base64 编解码</h3>
        <!-- 输入输出双栏布局 -->
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
        <!-- 操作按钮：编码 / 解码 / 复制 -->
        <div class="tool-actions">
          <el-button type="primary" @click="b64Encode">编码 (Encode)</el-button>
          <el-button type="primary" @click="b64Decode">解码 (Decode)</el-button>
          <el-button @click="copyText(b64Output)" :disabled="!b64Output">复制结果</el-button>
        </div>
      </div>

      <!-- 时间戳转换工具 -->
      <div v-if="activeTool === 'timestamp'" class="tool-area">
        <h3>时间戳转换</h3>
        <!-- 实时显示当前秒级时间戳 -->
        <div class="tool-hint">当前时间戳（秒）：<code>{{ nowTs }}</code></div>
        <!-- 输入输出双栏布局 -->
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
        <!-- 操作按钮：时间戳→日期 / 日期→时间戳 / 复制 -->
        <div class="tool-actions">
          <el-button type="primary" @click="tsToDate">时间戳 → 日期</el-button>
          <el-button type="primary" @click="dateToTs">日期 → 时间戳</el-button>
          <el-button @click="copyText(tsOutput)" :disabled="!tsOutput">复制结果</el-button>
        </div>
      </div>

      <!-- UUID 生成工具 -->
      <!-- UUID 生成工具 -->
      <div v-if="activeTool === 'uuid'" class="tool-area">
        <h3>UUID 生成</h3>
        <!-- 左侧数量选择 + 右侧结果展示 -->
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
        <!-- 操作按钮：生成 / 复制 -->
        <div class="tool-actions">
          <el-button type="primary" @click="generateUUID">生成</el-button>
          <el-button @click="copyText(uuidOutput)" :disabled="!uuidOutput">复制结果</el-button>
        </div>
      </div>

      <!-- 正则测试工具 -->
      <div v-if="activeTool === 'regex'" class="tool-area">
        <h3>正则测试</h3>
        <!-- 正则表达式输入 + Flags 输入 -->
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
        <!-- 测试文本输入区 -->
        <div class="tool-col" style="margin-top: 12px;">
          <label>测试文本</label>
          <el-input v-model="regexTestStr" type="textarea" :rows="4" placeholder="输入要测试的文本..." />
        </div>
        <!-- 匹配结果高亮展示区 -->
        <div v-if="regexTestStr" class="regex-result">
          <label>匹配结果（{{ regexMatches.length }} 个匹配）</label>
          <div class="regex-preview" v-html="regexHighlighted"></div>
        </div>
      </div>

      <!-- JSON → TypeScript Interface 转换工具 -->
      <div v-if="activeTool === 'json2ts'" class="tool-area">
        <h3>JSON → TypeScript Interface</h3>
        <!-- 根 Interface 名称输入 -->
        <div class="tool-col" style="margin-bottom: 12px;">
          <label>根 Interface 名称</label>
          <el-input v-model="j2tsRootName" placeholder="Root" style="width: 200px;" />
        </div>
        <!-- JSON 输入编辑器 + TS 输出编辑器双栏布局 -->
        <div class="tool-row j2ts-editors">
          <div class="tool-col">
            <label>JSON 输入</label>
            <!-- JSON 代码编辑器：支持语法高亮和自动格式化 -->
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
            <!-- TypeScript 代码编辑器：只读模式，显示生成的 Interface -->
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
        <!-- JSON 解析错误提示 -->
        <div v-if="j2tsError" class="tool-error">{{ j2tsError }}</div>
        <!-- 操作按钮：转换 / 复制 -->
        <div class="tool-actions">
          <el-button type="primary" @click="jsonToTs">转换</el-button>
          <el-button @click="copyText(j2tsOutput)" :disabled="!j2tsOutput">复制结果</el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ==================== 工具面板整体布局 ==================== */

/** 工具面板容器：左右分栏布局 */
.tools-panel {
  display: flex;
  height: 100%;
  overflow: hidden;
}

/** 左侧工具导航栏 */
.tools-sidebar {
  width: 140px;
  flex-shrink: 0;
  border-right: 1px solid var(--border-color);
  padding: 12px 8px;
  overflow-y: auto;
}

/* ==================== 工具菜单项样式 ==================== */

/** 单个工具菜单项 */
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
/** 工具菜单项悬停状态 */
.tool-item:hover { background: var(--bg-hover); color: var(--text-primary); }
/** 工具菜单项激活状态 */
.tool-item.active { background: var(--primary-bg); color: var(--primary-color); font-weight: 600; }

/** 工具图标：等宽字体显示 */
.tool-icon {
  font-size: 12px;
  font-weight: 700;
  width: 28px;
  text-align: center;
  flex-shrink: 0;
  font-family: monospace;
}
/** 工具名称标签：不换行 */
.tool-label { white-space: nowrap; }

/* ==================== 右侧工具内容区 ==================== */

/** 工具内容区容器 */
.tools-content {
  flex: 1;
  padding: 20px 24px;
  overflow-y: auto;
}

/** 工具区域标题 */
.tool-area h3 {
  margin: 0 0 16px;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

/* ==================== 工具通用布局组件 ==================== */

/** 工具行：水平排列的输入输出区域 */
.tool-row {
  display: flex;
  gap: 16px;
  margin-bottom: 12px;
}

/** 工具列：垂直排列的标签和输入框 */
.tool-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/** 工具列标签文字 */
.tool-col label {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 500;
}

/** 操作按钮区域 */
.tool-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

/** 错误提示文字 */
.tool-error {
  color: #f56c6c;
  font-size: 12px;
  margin-top: 8px;
}

/** 提示信息文字（如时间戳工具的当前时间戳） */
.tool-hint {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 12px;
}
/** 提示信息中的代码高亮 */
.tool-hint code {
  color: var(--primary-color);
  font-weight: 600;
  font-size: 14px;
}

/* ==================== 正则测试工具专用样式 ==================== */

/** 正则匹配结果区域 */
.regex-result {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
/** 正则匹配结果标签 */
.regex-result label {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 500;
}
/** 正则匹配结果预览区：等宽字体，保留空白 */
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
/** 正则匹配高亮标记样式 */
.regex-preview :deep(.regex-match) {
  background: rgba(64, 158, 255, 0.3);
  color: var(--primary-color);
  padding: 1px 2px;
  border-radius: 2px;
}

/* ==================== JSON → TS 工具专用样式 ==================== */

/** JSON → TS 编辑器区域固定高度 */
.j2ts-editors {
  height: 350px;
}
/** 代码编辑器容器：自适应剩余高度 */
.editor-box {
  flex: 1;
  min-height: 0;
  border-radius: 6px;
  overflow: hidden;
}
</style>