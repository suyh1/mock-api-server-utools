<script setup lang="ts">
import { ref, inject, computed } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Delete } from '@element-plus/icons-vue';
import { environmentsKey } from '@/composables/useEnvironments';
import type { Environment, EnvVariable } from '@/types/mock';

const envStore = inject(environmentsKey)!;
const selectedEnvId = ref<number | null>(null);

const selectedEnv = computed(() => {
  if (selectedEnvId.value === null) return null;
  return envStore.environments.value.find(e => e.id === selectedEnvId.value) || null;
});

const envColors = ['#409EFF', '#67c23a', '#e6a23c', '#f56c6c', '#909399', '#b37feb', '#36cfc9'];

function handleAddEnv() {
  ElMessageBox.prompt('请输入环境名称', '新建环境').then(({ value }: any) => {
    if (!value?.trim()) return;
    const now = Date.now();
    const env: Environment = {
      id: now,
      name: value.trim(),
      color: envColors[envStore.environments.value.length % envColors.length],
      variables: [],
      createdAt: now,
      updatedAt: now,
    };
    envStore.saveEnvironment(env);
    selectedEnvId.value = env.id;
  }).catch(() => {});
}

function handleDeleteEnv(id: number) {
  const env = envStore.environments.value.find(e => e.id === id);
  ElMessageBox.confirm(`确定删除环境「${env?.name}」吗？`, '提示', { type: 'warning' }).then(() => {
    envStore.deleteEnvironment(id);
    if (selectedEnvId.value === id) selectedEnvId.value = null;
    ElMessage.success('已删除');
  }).catch(() => {});
}

function handleSelectEnv(id: number) {
  selectedEnvId.value = id;
}

function handleAddVariable() {
  const env = selectedEnv.value;
  if (!env) return;
  env.variables.push({ key: '', value: '', description: '', enabled: true });
  envStore.saveEnvironment(env);
}

function handleDeleteVariable(idx: number) {
  const env = selectedEnv.value;
  if (!env) return;
  env.variables.splice(idx, 1);
  envStore.saveEnvironment(env);
}

function handleSaveEnv() {
  const env = selectedEnv.value;
  if (!env) return;
  envStore.saveEnvironment(env);
  ElMessage.success('已保存');
}

function handleToggleActive(id: number) {
  if (envStore.activeEnvId.value === id) {
    envStore.setActiveEnv(null);
  } else {
    envStore.setActiveEnv(id);
  }
}

function handleExport() {
  const data = JSON.stringify(envStore.environments.value, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `environments-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  ElMessage.success('已导出');
}

function handleImport() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text) as Environment[];
      if (!Array.isArray(data)) { ElMessage.error('无效的环境数据'); return; }
      for (const env of data) {
        envStore.saveEnvironment({ ...env, id: Date.now() + Math.random() * 1000 });
      }
      ElMessage.success(`已导入 ${data.length} 个环境`);
    } catch {
      ElMessage.error('导入失败');
    }
  };
  input.click();
}
</script>

<template>
  <div class="env-panel">
    <div class="panel-header">
      <div class="header-left">
        <span class="title">环境变量</span>
        <el-tag size="small" type="info">{{ envStore.environments.value.length }}</el-tag>
      </div>
      <div class="header-right">
        <el-button size="small" @click="handleExport" :disabled="envStore.environments.value.length === 0">导出</el-button>
        <el-button size="small" @click="handleImport">导入</el-button>
        <el-button size="small" type="primary" :icon="Plus" @click="handleAddEnv">新建环境</el-button>
      </div>
    </div>

    <div class="env-body">
      <!-- 左侧环境列表 -->
      <aside class="env-list">
        <div
          v-for="env in envStore.environments.value" :key="env.id"
          class="env-card"
          :class="{ active: selectedEnvId === env.id, 'is-active-env': envStore.activeEnvId.value === env.id }"
          @click="handleSelectEnv(env.id)"
        >
          <div class="env-card-header">
            <span class="env-color-dot" :style="{ background: env.color || '#409EFF' }"></span>
            <span class="env-name">{{ env.name }}</span>
            <el-tag size="small" effect="plain">{{ env.variables.length }} 变量</el-tag>
          </div>
          <div class="env-card-actions">
            <el-button size="small" link :type="envStore.activeEnvId.value === env.id ? 'success' : 'info'" @click.stop="handleToggleActive(env.id)">
              {{ envStore.activeEnvId.value === env.id ? '已激活' : '激活' }}
            </el-button>
            <el-button size="small" link type="danger" @click.stop="handleDeleteEnv(env.id)">删除</el-button>
          </div>
        </div>
        <div v-if="envStore.environments.value.length === 0" class="env-empty">
          点击"新建环境"开始
        </div>
      </aside>

      <!-- 右侧变量编辑 -->
      <div class="env-editor">
        <template v-if="selectedEnv">
          <div class="editor-header">
            <h3>{{ selectedEnv.name }} — 变量列表</h3>
            <div style="display: flex; gap: 8px;">
              <el-button size="small" :icon="Plus" @click="handleAddVariable">添加变量</el-button>
              <el-button size="small" type="primary" @click="handleSaveEnv">保存</el-button>
            </div>
          </div>
          <el-table :data="selectedEnv.variables" stripe size="small" style="width: 100%">
            <el-table-column label="启用" width="60">
              <template #default="{ row }">
                <el-switch v-model="row.enabled" size="small" />
              </template>
            </el-table-column>
            <el-table-column label="变量名" min-width="140">
              <template #default="{ row }">
                <el-input v-model="row.key" size="small" placeholder="variableName" />
              </template>
            </el-table-column>
            <el-table-column label="值" min-width="180">
              <template #default="{ row }">
                <el-input v-model="row.value" size="small" placeholder="value" />
              </template>
            </el-table-column>
            <el-table-column label="描述" min-width="140">
              <template #default="{ row }">
                <el-input v-model="row.description" size="small" placeholder="可选描述" />
              </template>
            </el-table-column>
            <el-table-column label="" width="50">
              <template #default="{ $index }">
                <el-button size="small" link type="danger" :icon="Delete" @click="handleDeleteVariable($index)" />
              </template>
            </el-table-column>
          </el-table>
          <div class="env-usage-hint">
            使用方法：在接口 URL、请求头、请求体中输入 <code v-pre>{{variableName}}</code> 即可引用变量
          </div>
        </template>
        <template v-else>
          <div class="env-placeholder">
            <el-empty description="从左侧选择一个环境" />
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.env-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}
.header-left { display: flex; align-items: center; gap: 8px; }
.header-right { display: flex; align-items: center; gap: 8px; }
.title { font-size: 15px; font-weight: 600; color: var(--text-primary); }

.env-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

/* 左侧环境列表 */
.env-list {
  width: 220px;
  flex-shrink: 0;
  border-right: 1px solid var(--border-color);
  padding: 12px;
  overflow-y: auto;
}

.env-card {
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  margin-bottom: 6px;
  transition: all 0.2s;
  border: 1px solid transparent;
}
.env-card:hover { background: var(--bg-hover); }
.env-card.active { background: var(--primary-bg); border-color: var(--primary-color); }
.env-card.is-active-env { box-shadow: inset 3px 0 0 #67c23a; }

.env-card-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.env-color-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.env-name {
  flex: 1;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.env-card-actions {
  display: flex;
  gap: 4px;
  margin-top: 6px;
  justify-content: flex-end;
}

.env-empty {
  text-align: center;
  padding: 30px 0;
  font-size: 13px;
  color: var(--text-secondary);
}

/* 右侧编辑器 */
.env-editor {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
}

.editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.editor-header h3 {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.env-usage-hint {
  margin-top: 12px;
  padding: 10px 14px;
  background: var(--bg-hover);
  border-radius: 6px;
  font-size: 12px;
  color: var(--text-secondary);
}

.env-usage-hint code {
  background: var(--bg-card);
  padding: 1px 6px;
  border-radius: 3px;
  color: var(--primary-color);
  font-weight: 600;
}

.env-placeholder {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
}
</style>
