<script setup lang="ts">
import { inject, ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { settingsKey } from '@/composables/useSettings';
import type { HttpMethod, MockGroup, Project } from '@/types/mock';

const settings = inject(settingsKey)!;
const isDark = inject<import('vue').Ref<boolean>>('isDark')!;

const emit = defineEmits<{
  (e: 'theme-change', dark: boolean): void;
}>();

const DARK_STORAGE_KEY = 'mock-api-dark-mode';

const handleDarkChange = (val: string | number | boolean) => {
  const dark = Boolean(val);
  localStorage.setItem(DARK_STORAGE_KEY, JSON.stringify(dark));
  emit('theme-change', dark);
};

const handleClearCache = () => {
  ElMessageBox.confirm('确定清除所有调试缓存？', '提示', { type: 'warning' })
    .then(() => {
      localStorage.removeItem('mock-api-test-results');
      ElMessage.success('缓存已清除');
    })
    .catch(() => {});
};

const API_BASE = ref('http://localhost:3000');
if (window.services) {
  API_BASE.value = window.services.getServerUrl();
}

// --- 导入导出增强 ---

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
      const pName = exportProjects[0]?.name || 'project';
      filename = `mock-api-${pName}-${Date.now()}.json`;
    } else if (exportScope.value === 'group' && exportGroupId.value) {
      rules = rules.filter((g: MockGroup) => g.id === exportGroupId.value);
      exportProjects = [];
      const gName = rules[0]?.name || 'group';
      filename = `mock-api-${gName}-${Date.now()}.json`;
    }

    const data = { rules, templates: exportScope.value === 'all' ? templates : [], projects: exportProjects, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    showExportDialog.value = false;
    ElMessage.success('导出成功');
  } catch {
    ElMessage.error('导出失败');
  }
};

const handleImport = () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data.rules && !data.templates && !data.projects) {
        ElMessage.error('无效的备份文件');
        return;
      }

      if (importMode.value === 'overwrite') {
        // 覆盖模式：直接替换
        if (data.rules) {
          await fetch(`${API_BASE.value}/_admin/rules`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data.rules),
          });
        }
        if (data.templates) {
          // 逐个保存模板
          for (const t of data.templates) {
            await fetch(`${API_BASE.value}/_admin/template/save`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(t),
            });
          }
        }
      } else {
        // 追加模式：合并数据
        if (data.rules) {
          const existingRes = await fetch(`${API_BASE.value}/_admin/rules`);
          const existing = await existingRes.json();
          const merged = [...existing, ...data.rules.map((g: MockGroup) => ({ ...g, id: Date.now() + Math.random() * 1000 }))];
          await fetch(`${API_BASE.value}/_admin/rules`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(merged),
          });
        }
        if (data.templates) {
          for (const t of data.templates) {
            await fetch(`${API_BASE.value}/_admin/template/save`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...t, id: undefined }),
            });
          }
        }
      }

      // 导入项目数据
      if (data.projects?.length) {
        for (const p of data.projects) {
          await fetch(`${API_BASE.value}/_admin/project/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(importMode.value === 'append' ? { ...p, id: undefined } : p),
          });
        }
      }

      ElMessage.success('导入成功，请刷新页面');
    } catch {
      ElMessage.error('导入失败，请检查文件格式');
    }
  };
  input.click();
};

const httpMethods: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE'];
</script>

<template>
  <el-main class="config-container">
    <!-- 外观设置 -->
    <div class="config-header">
      <span class="title">外观设置</span>
    </div>
    <div class="config-card">
      <div class="form-row">
        <label>深色模式</label>
        <el-switch v-model="isDark" @change="handleDarkChange" />
      </div>
    </div>

    <!-- 编辑器设置 -->
    <div class="config-header">
      <span class="title">编辑器设置</span>
    </div>
    <div class="config-card">
      <div class="form-row">
        <label>字体大小</label>
        <el-input-number
          v-model="settings.editorFontSize"
          :min="12"
          :max="20"
          :step="1"
          controls-position="right"
        />
        <span class="unit">px</span>
      </div>
      <div class="form-row">
        <label>Tab 宽度</label>
        <el-radio-group v-model="settings.editorTabSize">
          <el-radio-button :value="2">2 空格</el-radio-button>
          <el-radio-button :value="4">4 空格</el-radio-button>
        </el-radio-group>
      </div>
    </div>

    <!-- Mock 服务默认配置 -->
    <div class="config-header">
      <span class="title">Mock 服务默认配置</span>
    </div>
    <div class="config-card">
      <div class="form-row">
        <label>默认端口</label>
        <el-input-number
          v-model="settings.defaultPort"
          :min="1"
          :max="65535"
          controls-position="right"
        />
      </div>
      <div class="form-row">
        <label>默认前缀</label>
        <el-input
          v-model="settings.defaultPrefix"
          placeholder="/api"
          style="width: 200px"
        />
      </div>
    </div>

    <!-- 新接口默认配置 -->
    <div class="config-header">
      <span class="title">新接口默认配置</span>
    </div>
    <div class="config-card">
      <div class="form-row">
        <label>请求方法</label>
        <el-select v-model="settings.defaultMethod" style="width: 120px">
          <el-option
            v-for="m in httpMethods"
            :key="m"
            :label="m"
            :value="m"
          />
        </el-select>
      </div>
      <div class="form-row">
        <label>响应延迟</label>
        <el-input-number
          v-model="settings.defaultDelay"
          :min="0"
          :max="30000"
          :step="100"
          controls-position="right"
        />
        <span class="unit">ms</span>
      </div>
    </div>

    <!-- 数据管理 -->
    <div class="config-header">
      <span class="title">数据管理</span>
    </div>
    <div class="config-card">
      <div class="form-row">
        <label>调试缓存</label>
        <el-button @click="handleClearCache">清除缓存</el-button>
      </div>
      <div class="form-row">
        <label>导出数据</label>
        <el-button type="primary" @click="openExportDialog">导出数据</el-button>
      </div>
      <div class="form-row">
        <label>导入模式</label>
        <el-radio-group v-model="importMode">
          <el-radio-button value="overwrite">覆盖</el-radio-button>
          <el-radio-button value="append">追加</el-radio-button>
        </el-radio-group>
      </div>
      <div class="form-row">
        <label>导入数据</label>
        <el-button @click="handleImport">选择文件导入</el-button>
        <span class="unit">{{ importMode === 'overwrite' ? '将替换现有数据' : '将追加到现有数据' }}</span>
      </div>
    </div>

    <!-- 导出对话框 -->
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
        <el-button
          type="primary"
          @click="handleExport"
          :disabled="(exportScope === 'project' && !exportProjectId) || (exportScope === 'group' && !exportGroupId)"
        >导出</el-button>
      </template>
    </el-dialog>
  </el-main>
</template>

<style scoped>
.config-container {
  padding: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}
.config-header {
  padding: 12px 20px;
  border-bottom: 1px solid var(--border-color);
  font-size: 15px;
  font-weight: 600;
  color: #409EFF;
}
.config-header:not(:first-child) {
  margin-top: 4px;
}
.config-card {
  padding: 20px 24px;
  max-width: 600px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.form-row {
  display: flex;
  align-items: center;
}
.form-row label {
  width: 100px;
  color: var(--text-primary);
  font-size: 14px;
  flex-shrink: 0;
}
.unit {
  margin-left: 8px;
  color: var(--text-secondary);
  font-size: 13px;
}
.btn-group {
  display: flex;
  gap: 10px;
}
</style>
