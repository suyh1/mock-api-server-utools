<script setup lang="ts">
import { ref, computed, inject } from 'vue';
import FormatTools from './FormatTools.vue';
import EncodeTools from './EncodeTools.vue';
import DataTools from './DataTools.vue';
import TextTools from './TextTools.vue';
import NetworkTools from './NetworkTools.vue';
import ReferenceTools from './ReferenceTools.vue';

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
      { key: 'codegen', label: '代码生成', icon: '</>', desc: '从接口定义生成多语言 HTTP 请求代码' },
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

/* ==================== 工具分类映射 ==================== */

const formatToolKeys = new Set(['json', 'json2ts', 'jsonpath', 'jsondiff']);
const encodeToolKeys = new Set(['url', 'base64', 'htmlencode', 'encrypt', 'unicode']);
const dataToolKeys = new Set(['timestamp', 'uuid', 'mockdata', 'color', 'number', 'radix', 'hash', 'password', 'placeholder', 'qrcode']);
const textToolKeys = new Set(['texttransform', 'regex', 'diff', 'markdown', 'textstat']);
const networkToolKeys = new Set(['curl', 'httpcode', 'jwt', 'codegen']);
const referenceToolKeys = new Set(['ascii', 'cron', 'cssunit', 'apidoc']);
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
          <FormatTools v-if="formatToolKeys.has(activeTool)" :activeTool="activeTool" :isDark="isDark" />
          <EncodeTools v-else-if="encodeToolKeys.has(activeTool)" :activeTool="activeTool" :isDark="isDark" />
          <DataTools v-else-if="dataToolKeys.has(activeTool)" :activeTool="activeTool" :isDark="isDark" />
          <TextTools v-else-if="textToolKeys.has(activeTool)" :activeTool="activeTool" :isDark="isDark" />
          <NetworkTools v-else-if="networkToolKeys.has(activeTool)" :activeTool="activeTool" :isDark="isDark" />
          <ReferenceTools v-else-if="referenceToolKeys.has(activeTool)" :activeTool="activeTool" :isDark="isDark" />
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
</style>
