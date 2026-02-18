<script setup lang="ts">
import { inject, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { settingsKey } from '@/composables/useSettings';
import type { HttpMethod } from '@/types/mock';

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

const handleExport = async () => {
  try {
    const [rulesRes, templatesRes] = await Promise.all([
      fetch(`${API_BASE.value}/_admin/rules`),
      fetch(`${API_BASE.value}/_admin/templates`),
    ]);
    const rules = await rulesRes.json();
    const templates = await templatesRes.json();
    const data = { rules, templates, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mock-api-backup-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
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
      if (data.rules) {
        await fetch(`${API_BASE.value}/_admin/rules`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data.rules),
        });
      }
      if (data.templates) {
        await fetch(`${API_BASE.value}/_admin/templates`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data.templates),
        });
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
        <label>数据备份</label>
        <div class="btn-group">
          <el-button type="primary" @click="handleExport">导出全部数据</el-button>
          <el-button @click="handleImport">导入数据</el-button>
        </div>
      </div>
    </div>
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
