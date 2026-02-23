<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import CodeEditor from '../CodeEditor.vue';
import { copyText } from './tools-utils';
import type { MockGroup, Project } from '@/types/mock';
import { generateMarkdownDoc } from '@/utils/generateApiDoc';

defineProps<{
  activeTool: string;
  isDark: boolean;
}>();

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
  docResult.value = generateMarkdownDoc(docGroups.value, {
    scope: docScope.value,
    projectId: docProjectId.value,
    groupId: docGroupId.value,
    projects: docProjects.value,
    showDisabled: true,
  });
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
  <div>
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
</template>

<style scoped>
@import './tools-common.css';

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
</style>
