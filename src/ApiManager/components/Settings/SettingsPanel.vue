<script setup lang="ts">
import { inject, ref, computed } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { settingsKey, DEFAULT_PRIMARY, DEFAULT_MORE, FIXED_PRIMARY, type SidebarModuleKey } from '@/composables/useSettings';
import type { HttpMethod, MockGroup, Project } from '@/types/mock';
import { parseOpenApiInput, parseOpenApiToMockGroups } from '@/utils/parseOpenApi';

const settings = inject(settingsKey)!;
const isDark = inject<import('vue').Ref<boolean>>('isDark')!;

const emit = defineEmits<{
  (e: 'theme-change', dark: boolean): void;
}>();

const activeSection = ref('general');
const sections = [
  { key: 'general', label: '通用', icon: '⚙️' },
  { key: 'editor', label: '编辑器', icon: '✏️' },
  { key: 'mock', label: 'Mock 服务', icon: '🔌' },
  { key: 'data', label: '数据管理', icon: '💾' },
  { key: 'about', label: '关于', icon: '💡' },
];

/* ==================== 通用 ==================== */

const DARK_STORAGE_KEY = 'mock-api-dark-mode';
const handleDarkChange = (val: string | number | boolean) => {
  const dark = Boolean(val);
  localStorage.setItem(DARK_STORAGE_KEY, JSON.stringify(dark));
  emit('theme-change', dark);
};

/* ==================== 侧边栏自定义 ==================== */

const moduleLabels: Record<SidebarModuleKey, string> = {
  dashboard: '📊 看板', project: '📁 项目', service: '🖥️ 服务', api: '🔗 接口', template: '📋 模板',
  scenario: '🎭 场景', tools: '🔧 工具', environment: '🌐 环境', doc: '📄 文档',
  log: '📜 日志', websocket: '⚡ WS', testrunner: '🧪 测试',
};

/** 固定模块不可排序 */
const fixedSet = new Set(FIXED_PRIMARY);
const fixedCount = FIXED_PRIMARY.length;
function isFixed(key: SidebarModuleKey) { return fixedSet.has(key); }

/** 拖拽状态 */
const dragItem = ref<{ key: SidebarModuleKey; from: 'primary' | 'more' } | null>(null);

function onDragStart(key: SidebarModuleKey, from: 'primary' | 'more') {
  if (isFixed(key)) return;
  dragItem.value = { key, from };
}

function onDragEnd() {
  dragItem.value = null;
}

function onDropToPrimary(e: DragEvent) {
  e.preventDefault();
  if (!dragItem.value) return;
  const { key, from } = dragItem.value;
  if (from === 'more') {
    settings.sidebarMore = settings.sidebarMore.filter(k => k !== key);
    settings.sidebarPrimary = [...settings.sidebarPrimary, key];
  }
  dragItem.value = null;
}

function onDropToMore(e: DragEvent) {
  e.preventDefault();
  if (!dragItem.value) return;
  const { key, from } = dragItem.value;
  if (isFixed(key)) { dragItem.value = null; return; }
  if (from === 'primary') {
    settings.sidebarPrimary = settings.sidebarPrimary.filter(k => k !== key);
    settings.sidebarMore = [...settings.sidebarMore, key];
  }
  dragItem.value = null;
}

function onDragOver(e: DragEvent) {
  e.preventDefault();
}

function moveItem(key: SidebarModuleKey, from: 'primary' | 'more', dir: -1 | 1) {
  if (isFixed(key)) return;
  const arr = from === 'primary' ? [...settings.sidebarPrimary] : [...settings.sidebarMore];
  const idx = arr.indexOf(key);
  if (idx < 0) return;
  const target = idx + dir;
  if (target < 0 || target >= arr.length) return;
  if (from === 'primary' && target < fixedCount) return;
  [arr[idx], arr[target]] = [arr[target], arr[idx]];
  if (from === 'primary') settings.sidebarPrimary = arr;
  else settings.sidebarMore = arr;
}

function resetSidebar() {
  settings.sidebarPrimary = [...DEFAULT_PRIMARY];
  settings.sidebarMore = [...DEFAULT_MORE];
  ElMessage.success('已恢复默认');
}

/* ==================== Mock 服务 ==================== */

const httpMethods: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE'];

/* ==================== 数据管理 ==================== */

const API_BASE = ref('http://localhost:3000');
if (window.services) {
  API_BASE.value = window.services.getServerUrl();
}

const projects = ref<Project[]>([]);
const groups = ref<MockGroup[]>([]);
const exportScope = ref<'all' | 'project' | 'group'>('all');
const exportProjectId = ref<number | null>(null);
const exportGroupId = ref<number | null>(null);
const showExportDialog = ref(false);
const importMode = ref<'overwrite' | 'append'>('overwrite');

const loadExportData = async () => {
  try {
    const [pRes, gRes] = await Promise.all([
      fetch(`${API_BASE.value}/_admin/projects`),
      fetch(`${API_BASE.value}/_admin/rules`),
    ]);
    projects.value = await pRes.json();
    groups.value = await gRes.json();
  } catch {}
};

const openExportDialog = () => {
  exportScope.value = 'all';
  exportProjectId.value = null;
  exportGroupId.value = null;
  loadExportData();
  showExportDialog.value = true;
};

const handleExport = async () => {
  try {
    const [rulesRes, templatesRes, projectsRes] = await Promise.all([
      fetch(`${API_BASE.value}/_admin/rules`),
      fetch(`${API_BASE.value}/_admin/templates`),
      fetch(`${API_BASE.value}/_admin/projects`),
    ]);
    let rules = await rulesRes.json();
    const templates = await templatesRes.json();
    const allProjects = await projectsRes.json();
    let exportProjects = allProjects;
    let filename = `mock-api-backup-${Date.now()}.json`;

    if (exportScope.value === 'project' && exportProjectId.value) {
      rules = rules.filter((g: MockGroup) => g.projectId === exportProjectId.value);
      exportProjects = allProjects.filter((p: Project) => p.id === exportProjectId.value);
      filename = `mock-api-${exportProjects[0]?.name || 'project'}-${Date.now()}.json`;
    } else if (exportScope.value === 'group' && exportGroupId.value) {
      rules = rules.filter((g: MockGroup) => g.id === exportGroupId.value);
      exportProjects = [];
      filename = `mock-api-${rules[0]?.name || 'group'}-${Date.now()}.json`;
    }

    const data = { rules, templates: exportScope.value === 'all' ? templates : [], projects: exportProjects, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
    showExportDialog.value = false;
    ElMessage.success('导出成功');
  } catch { ElMessage.error('导出失败'); }
};

const handleImport = () => {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.json';
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.rules && !data.templates && !data.projects) {
        ElMessage.error('无效的备份文件'); return;
      }
      if (importMode.value === 'overwrite') {
        if (data.rules) {
          await fetch(`${API_BASE.value}/_admin/rules`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data.rules) });
        }
        if (data.templates) {
          for (const t of data.templates) {
            await fetch(`${API_BASE.value}/_admin/template/save`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(t) });
          }
        }
      } else {
        if (data.rules) {
          const existingRes = await fetch(`${API_BASE.value}/_admin/rules`);
          const existing = await existingRes.json();
          const merged = [...existing, ...data.rules.map((g: MockGroup) => ({ ...g, id: Date.now() + Math.random() * 1000 }))];
          await fetch(`${API_BASE.value}/_admin/rules`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(merged) });
        }
        if (data.templates) {
          for (const t of data.templates) {
            await fetch(`${API_BASE.value}/_admin/template/save`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...t, id: undefined }) });
          }
        }
      }
      if (data.projects?.length) {
        for (const p of data.projects) {
          await fetch(`${API_BASE.value}/_admin/project/save`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(importMode.value === 'append' ? { ...p, id: undefined } : p) });
        }
      }
      ElMessage.success('导入成功，请刷新页面');
    } catch { ElMessage.error('导入失败，请检查文件格式'); }
  };
  input.click();
};

const handleClearCache = () => {
  ElMessageBox.confirm('确定清除所有调试缓存？', '提示', { type: 'warning' })
    .then(() => { localStorage.removeItem('mock-api-test-results'); ElMessage.success('缓存已清除'); })
    .catch(() => {});
};

/* ==================== OpenAPI ==================== */

const openApiProjectId = ref<number | null>(null);
const openApiParsedGroups = ref<MockGroup[]>([]);
const showOpenApiDialog = ref(false);
const openApiFileName = ref('');

const openApiStats = computed(() => ({
  groupCount: openApiParsedGroups.value.length,
  ruleCount: openApiParsedGroups.value.reduce((s, g) => s + g.children.length, 0),
}));

function handleOpenApiImport() {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.json,.yaml,.yml';
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    openApiFileName.value = file.name;
    try {
      const text = await file.text();
      const doc = parseOpenApiInput(text);
      openApiParsedGroups.value = parseOpenApiToMockGroups(doc, openApiProjectId.value ?? undefined);
      showOpenApiDialog.value = true;
    } catch (e: any) { ElMessage.error('解析失败: ' + e.message); }
  };
  input.click();
}

async function confirmOpenApiImport() {
  try {
    const existingRes = await fetch(`${API_BASE.value}/_admin/rules`);
    const existing = await existingRes.json();
    await fetch(`${API_BASE.value}/_admin/rules`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([...existing, ...openApiParsedGroups.value]) });
    showOpenApiDialog.value = false;
    ElMessage.success(`成功导入 ${openApiStats.value.groupCount} 个分组，${openApiStats.value.ruleCount} 个接口`);
  } catch { ElMessage.error('导入失败'); }
}

/* ==================== 关于 ==================== */

const openGithub = () => {
  const url = 'https://github.com/suyh1/mock-api-server-utools';
  if ((window as any).utools?.shellOpenExternal) {
    (window as any).utools.shellOpenExternal(url);
  } else {
    window.open(url, '_blank');
  }
};
</script>

<template>
  <div class="settings-panel">
    <!-- 左侧导航 -->
    <aside class="settings-nav">
      <div
        v-for="s in sections" :key="s.key"
        class="nav-item"
        :class="{ active: activeSection === s.key }"
        @click="activeSection = s.key"
      >
        <span class="nav-icon">{{ s.icon }}</span>
        <span class="nav-text">{{ s.label }}</span>
      </div>
    </aside>

    <!-- 右侧内容 -->
    <div class="settings-content">

      <!-- 通用 -->
      <div v-if="activeSection === 'general'" class="section">
        <div class="section-title">外观</div>
        <div class="setting-row">
          <div class="setting-info">
            <span class="setting-label">深色模式</span>
            <span class="setting-desc">切换深色 / 浅色主题</span>
          </div>
          <el-switch v-model="isDark" @change="handleDarkChange" />
        </div>

        <div class="section-title" style="margin-top: 24px;">侧边栏布局</div>
        <p class="section-hint">拖拽模块在两个区域之间移动，或使用箭头调整顺序</p>

        <div class="sidebar-editor">
          <div class="sidebar-zone" @drop="onDropToPrimary" @dragover="onDragOver">
            <div class="zone-header">
              <span class="zone-label">主区域</span>
              <span class="zone-count">{{ settings.sidebarPrimary.length }}</span>
            </div>
            <div class="zone-items">
              <div
                v-for="(key, i) in settings.sidebarPrimary" :key="key"
                class="module-chip"
                :class="{ 'chip-fixed': isFixed(key) }"
                :draggable="!isFixed(key)"
                @dragstart="onDragStart(key, 'primary')"
                @dragend="onDragEnd"
              >
                <span v-if="isFixed(key)" class="chip-lock">🔒</span>
                <span class="chip-label">{{ moduleLabels[key] }}</span>
                <span v-if="!isFixed(key)" class="chip-actions">
                  <button class="chip-btn" :disabled="i === fixedCount" @click="moveItem(key, 'primary', -1)">‹</button>
                  <button class="chip-btn" :disabled="i === settings.sidebarPrimary.length - 1" @click="moveItem(key, 'primary', 1)">›</button>
                </span>
              </div>
              <div v-if="settings.sidebarPrimary.length === 0" class="zone-empty">拖入模块到此处</div>
            </div>
          </div>

          <div class="sidebar-zone zone-more" @drop="onDropToMore" @dragover="onDragOver">
            <div class="zone-header">
              <span class="zone-label">更多面板</span>
              <span class="zone-count">{{ settings.sidebarMore.length }}</span>
            </div>
            <div class="zone-items">
              <div
                v-for="(key, i) in settings.sidebarMore" :key="key"
                class="module-chip chip-secondary"
                draggable="true"
                @dragstart="onDragStart(key, 'more')"
                @dragend="onDragEnd"
              >
                <span class="chip-label">{{ moduleLabels[key] }}</span>
                <span class="chip-actions">
                  <button class="chip-btn" :disabled="i === 0" @click="moveItem(key, 'more', -1)">‹</button>
                  <button class="chip-btn" :disabled="i === settings.sidebarMore.length - 1" @click="moveItem(key, 'more', 1)">›</button>
                </span>
              </div>
              <div v-if="settings.sidebarMore.length === 0" class="zone-empty">拖入模块到此处</div>
            </div>
          </div>
        </div>
        <el-button size="small" text @click="resetSidebar" style="margin-top: 8px; color: var(--text-secondary);">恢复默认布局</el-button>
      </div>

      <!-- 编辑器 -->
      <div v-if="activeSection === 'editor'" class="section">
        <div class="section-title">代码编辑器</div>
        <div class="setting-row">
          <div class="setting-info">
            <span class="setting-label">字体大小</span>
            <span class="setting-desc">编辑器中的代码字体大小</span>
          </div>
          <div class="setting-control">
            <el-input-number v-model="settings.editorFontSize" :min="12" :max="20" :step="1" controls-position="right" size="small" />
            <span class="unit">px</span>
          </div>
        </div>
        <div class="setting-row">
          <div class="setting-info">
            <span class="setting-label">Tab 宽度</span>
            <span class="setting-desc">缩进使用的空格数</span>
          </div>
          <el-radio-group v-model="settings.editorTabSize" size="small">
            <el-radio-button :value="2">2 空格</el-radio-button>
            <el-radio-button :value="4">4 空格</el-radio-button>
          </el-radio-group>
        </div>
      </div>

      <!-- Mock 服务 -->
      <div v-if="activeSection === 'mock'" class="section">
        <div class="section-title">服务默认配置</div>
        <div class="setting-row">
          <div class="setting-info">
            <span class="setting-label">默认端口</span>
            <span class="setting-desc">新建 Mock 服务时的默认端口号</span>
          </div>
          <el-input-number v-model="settings.defaultPort" :min="1" :max="65535" controls-position="right" size="small" />
        </div>
        <div class="setting-row">
          <div class="setting-info">
            <span class="setting-label">默认前缀</span>
            <span class="setting-desc">接口 URL 前缀，如 /api</span>
          </div>
          <el-input v-model="settings.defaultPrefix" placeholder="/api" style="width: 160px" size="small" />
        </div>

        <div class="section-title" style="margin-top: 24px;">新接口默认值</div>
        <div class="setting-row">
          <div class="setting-info">
            <span class="setting-label">请求方法</span>
            <span class="setting-desc">新建接口时的默认 HTTP 方法</span>
          </div>
          <el-select v-model="settings.defaultMethod" style="width: 100px" size="small">
            <el-option v-for="m in httpMethods" :key="m" :label="m" :value="m" />
          </el-select>
        </div>
        <div class="setting-row">
          <div class="setting-info">
            <span class="setting-label">响应延迟</span>
            <span class="setting-desc">模拟网络延迟（毫秒）</span>
          </div>
          <div class="setting-control">
            <el-input-number v-model="settings.defaultDelay" :min="0" :max="30000" :step="100" controls-position="right" size="small" />
            <span class="unit">ms</span>
          </div>
        </div>
      </div>

      <!-- 数据管理 -->
      <div v-if="activeSection === 'data'" class="section">
        <div class="section-title">备份与恢复</div>
        <div class="action-grid">
          <div class="action-card" @click="openExportDialog">
            <span class="action-icon">📤</span>
            <span class="action-label">导出数据</span>
            <span class="action-desc">备份接口、模板、项目数据</span>
          </div>
          <div class="action-card" @click="handleImport">
            <span class="action-icon">📥</span>
            <span class="action-label">导入数据</span>
            <span class="action-desc">{{ importMode === 'overwrite' ? '覆盖模式' : '追加模式' }}</span>
          </div>
          <div class="action-card" @click="handleClearCache">
            <span class="action-icon">🗑️</span>
            <span class="action-label">清除缓存</span>
            <span class="action-desc">清除调试缓存数据</span>
          </div>
        </div>
        <div class="setting-row" style="margin-top: 12px;">
          <div class="setting-info">
            <span class="setting-label">导入模式</span>
            <span class="setting-desc">选择导入时的数据处理方式</span>
          </div>
          <el-radio-group v-model="importMode" size="small">
            <el-radio-button value="overwrite">覆盖</el-radio-button>
            <el-radio-button value="append">追加</el-radio-button>
          </el-radio-group>
        </div>

        <div class="section-title" style="margin-top: 24px;">OpenAPI / Swagger 导入</div>
        <div class="setting-row">
          <div class="setting-info">
            <span class="setting-label">目标项目</span>
            <span class="setting-desc">可选，将导入的接口关联到项目</span>
          </div>
          <el-select v-model="openApiProjectId" placeholder="选择项目" clearable style="width: 160px" size="small" @focus="loadExportData">
            <el-option v-for="p in projects" :key="p.id" :label="`${p.icon || '📦'} ${p.name}`" :value="p.id" />
          </el-select>
        </div>
        <div class="setting-row">
          <div class="setting-info">
            <span class="setting-label">导入文件</span>
            <span class="setting-desc">支持 OpenAPI 3.x / Swagger 2.0</span>
          </div>
          <el-button size="small" type="primary" @click="handleOpenApiImport">选择文件</el-button>
        </div>
      </div>

      <!-- 关于 -->
      <div v-if="activeSection === 'about'" class="section about-section">
        <div class="about-hero">
          <div class="about-logo">M</div>
          <h2 class="about-name">Mock API Server</h2>
          <span class="about-ver">v1.6.2</span>
        </div>
        <p class="about-desc">一款集 Mock 服务与接口管理于一体的 uTools 插件。支持多项目多分组管理、基础/高级双模式响应、Mock.js 数据模板与智能生成、真实接口代理调试、WebSocket Mock、场景切换、请求日志、数据模板复用，以及 30+ 内置开发工具。</p>
        <div class="about-links">
          <div class="about-item"><span class="about-key">作者</span><span>subeipo</span></div>
          <div class="about-item"><span class="about-key">邮箱</span><span>suyhem@163.com</span></div>
          <div class="about-item">
            <span class="about-key">源码</span>
            <a href="javascript:void(0)" @click="openGithub" class="about-link">
              <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
              GitHub
            </a>
          </div>
        </div>
      </div>
    </div>

    <!-- 对话框 -->
    <el-dialog v-model="showExportDialog" title="导出数据" width="440px" destroy-on-close>
      <el-form label-width="80px">
        <el-form-item label="导出范围">
          <el-radio-group v-model="exportScope">
            <el-radio value="all">全部数据</el-radio>
            <el-radio value="project">按项目</el-radio>
            <el-radio value="group">按分组</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="exportScope === 'project'" label="选择项目">
          <el-select v-model="exportProjectId" placeholder="请选择项目" style="width: 100%">
            <el-option v-for="p in projects" :key="p.id" :label="`${p.icon || '📦'} ${p.name}`" :value="p.id" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="exportScope === 'group'" label="选择分组">
          <el-select v-model="exportGroupId" placeholder="请选择分组" style="width: 100%">
            <el-option v-for="g in groups" :key="g.id" :label="g.name" :value="g.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showExportDialog = false">取消</el-button>
        <el-button type="primary" @click="handleExport" :disabled="(exportScope === 'project' && !exportProjectId) || (exportScope === 'group' && !exportGroupId)">导出</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showOpenApiDialog" title="确认导入" width="440px" destroy-on-close>
      <div style="font-size: 14px; line-height: 2;">
        <p>文件: <b>{{ openApiFileName }}</b></p>
        <p>将导入 <b>{{ openApiStats.groupCount }}</b> 个分组，<b>{{ openApiStats.ruleCount }}</b> 个接口</p>
        <p style="color: var(--text-secondary); font-size: 13px;">数据将追加到现有接口列表</p>
      </div>
      <template #footer>
        <el-button @click="showOpenApiDialog = false">取消</el-button>
        <el-button type="primary" @click="confirmOpenApiImport">确认导入</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.settings-panel {
  height: 100%;
  display: flex;
  overflow: hidden;
}

/* 左侧导航 */
.settings-nav {
  width: 130px;
  flex-shrink: 0;
  border-right: 1px solid var(--border-color);
  padding: 12px 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.settings-nav .nav-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-secondary);
  transition: all 0.15s;
}

.settings-nav .nav-item:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.settings-nav .nav-item.active {
  background: var(--primary-bg);
  color: var(--primary-color);
  font-weight: 600;
}

.nav-icon { font-size: 15px; }
.nav-text { white-space: nowrap; }

/* 右侧内容 */
.settings-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px 28px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 14px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-color);
}

.section-hint {
  font-size: 12px;
  color: var(--text-secondary);
  margin: -8px 0 12px 0;
}

/* 设置行 */
.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid var(--border-color);
  gap: 16px;
}

.setting-row:last-child {
  border-bottom: none;
}

.setting-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.setting-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

.setting-desc {
  font-size: 12px;
  color: var(--text-secondary);
}

.setting-control {
  display: flex;
  align-items: center;
  gap: 6px;
}

.unit {
  font-size: 12px;
  color: var(--text-secondary);
}

/* 侧边栏编辑器 */
.sidebar-editor {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.sidebar-zone {
  border: 2px dashed var(--border-color);
  border-radius: 10px;
  padding: 8px;
  min-height: 100px;
  transition: border-color 0.2s, background 0.2s;
}

.sidebar-zone:hover {
  border-color: var(--primary-color);
  background: var(--primary-bg);
}

.zone-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px 8px;
}

.zone-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
}

.zone-count {
  font-size: 11px;
  color: var(--text-secondary);
  background: var(--bg-hover);
  padding: 1px 6px;
  border-radius: 8px;
}

.zone-items {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.module-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 8px;
  background: var(--primary-bg);
  border: 1px solid var(--primary-color);
  border-radius: 6px;
  font-size: 12px;
  color: var(--primary-color);
  cursor: grab;
  transition: all 0.15s;
  user-select: none;
}

.module-chip:active { cursor: grabbing; }

.module-chip.chip-fixed {
  background: var(--bg-hover);
  border-color: var(--border-color);
  color: var(--text-secondary);
  cursor: default;
  opacity: 0.75;
}

.chip-lock {
  font-size: 10px;
  margin-right: 2px;
}

.module-chip.chip-secondary {
  background: var(--bg-hover);
  border-color: var(--border-color);
  color: var(--text-primary);
}

.chip-label { white-space: nowrap; }

.chip-actions {
  display: flex;
  gap: 0;
  margin-left: 2px;
}

.chip-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0 3px;
  font-size: 14px;
  font-weight: 700;
  color: inherit;
  opacity: 0.5;
  transition: opacity 0.15s;
  line-height: 1;
}

.chip-btn:hover:not(:disabled) { opacity: 1; }
.chip-btn:disabled { opacity: 0.2; cursor: default; }

.zone-empty {
  width: 100%;
  text-align: center;
  padding: 20px 0;
  font-size: 12px;
  color: var(--text-secondary);
}

/* 数据管理操作卡片 */
.action-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.action-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 16px 12px;
  background: var(--bg-hover);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid transparent;
}

.action-card:hover {
  border-color: var(--primary-color);
  background: var(--primary-bg);
}

.action-icon { font-size: 22px; }
.action-label { font-size: 13px; font-weight: 600; color: var(--text-primary); }
.action-desc { font-size: 11px; color: var(--text-secondary); }

/* 关于页面 */
.about-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 40px;
}

.about-hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  margin-bottom: 20px;
}

.about-logo {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  background: linear-gradient(135deg, #409EFF, #66b1ff);
  color: #fff;
  font-size: 28px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 4px;
}

.about-name {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.about-ver {
  font-size: 12px;
  color: var(--text-secondary);
  background: var(--bg-hover);
  padding: 2px 10px;
  border-radius: 10px;
}

.about-desc {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.8;
  text-align: center;
  max-width: 420px;
  margin-bottom: 24px;
}

.about-links {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  max-width: 280px;
}

.about-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--bg-hover);
  border-radius: 8px;
  font-size: 13px;
}

.about-key {
  color: var(--text-secondary);
  font-weight: 500;
}

.about-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--primary-color);
  text-decoration: none;
  transition: opacity 0.2s;
}

.about-link:hover { opacity: 0.8; }
</style>
