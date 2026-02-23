<script setup lang="ts">
import { ref, inject, computed, watch, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Delete, VideoPlay, SwitchButton, CircleCheck, Warning } from '@element-plus/icons-vue';
import { environmentsKey } from '@/composables/useEnvironments';
import { settingsKey } from '@/composables/useSettings';
import type { Environment, EnvVariable, EnvOverride, EnvServiceConfig, MockService, Project } from '@/types/mock';

const envStore = inject(environmentsKey)!;
const appSettings = inject(settingsKey, null);
const selectedEnvId = ref<number | null>(null);

const selectedEnv = computed(() => {
  if (selectedEnvId.value === null) return null;
  return envStore.environments.value.find(e => e.id === selectedEnvId.value) || null;
});

const envColors = ['#409EFF', '#67c23a', '#e6a23c', '#f56c6c', '#909399', '#b37feb', '#36cfc9'];

/** 右侧编辑区 Tab */
const editTab = ref('variables');

// --- 数据 ---
const localIp = ref('localhost');
const API_BASE = ref('http://localhost:3000');
const services = ref<MockService[]>([]);
const projects = ref<Project[]>([]);

/** 从后端加载服务列表 */
const loadServices = async () => {
  try {
    const res = await fetch(`${API_BASE.value}/_admin/services`);
    if (!res.ok) throw new Error();
    const data = await res.json();
    services.value = Array.isArray(data) ? data : [];
  } catch {}
};

/** 从后端加载项目列表 */
const loadProjects = async () => {
  try {
    const res = await fetch(`${API_BASE.value}/_admin/projects`);
    if (!res.ok) throw new Error();
    projects.value = await res.json();
  } catch {}
};


// --- 环境 CRUD ---

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

function handleToggleActive(id: number) {
  if (envStore.activeEnvId.value === id) {
    envStore.setActiveEnv(null);
  } else {
    envStore.setActiveEnv(id);
  }
}

// --- 服务配置编辑 ---

function ensureServiceConfig() {
  const env = selectedEnv.value;
  if (env && !env.serviceConfig) {
    env.serviceConfig = {};
  }
}

function handleSaveEnv() {
  const env = selectedEnv.value;
  if (!env) return;
  envStore.saveEnvironment(env);
  ElMessage.success('已保存');
}

// --- 变量管理 ---

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

// --- 覆盖配置管理 ---

const showAddOverrideDialog = ref(false);
const newOverrideScope = ref<'project' | 'service'>('service');
const newOverrideTargetId = ref<number | null>(null);

/** 可选的覆盖目标列表（排除已存在的覆盖） */
const availableOverrideTargets = computed(() => {
  const env = selectedEnv.value;
  if (!env) return [];

  const existingIds = new Set(
    (env.overrides || [])
      .filter(o => o.scope === newOverrideScope.value)
      .map(o => o.targetId)
  );

  if (newOverrideScope.value === 'project') {
    return projects.value
      .filter(p => !existingIds.has(p.id))
      .map(p => ({ id: p.id, name: `${p.icon || '📦'} ${p.name}` }));
  } else {
    return services.value
      .filter(s => !existingIds.has(s.id))
      .map(s => ({ id: s.id, name: s.name }));
  }
});

function handleAddOverride() {
  newOverrideScope.value = 'service';
  newOverrideTargetId.value = null;
  showAddOverrideDialog.value = true;
}

function confirmAddOverride() {
  const env = selectedEnv.value;
  if (!env || !newOverrideTargetId.value) return;

  if (!env.overrides) env.overrides = [];

  // 找到目标名称
  let targetName = '';
  if (newOverrideScope.value === 'project') {
    const p = projects.value.find(p => p.id === newOverrideTargetId.value);
    targetName = p?.name || '';
  } else {
    const s = services.value.find(s => s.id === newOverrideTargetId.value);
    targetName = s?.name || '';
  }

  const override: EnvOverride = {
    scope: newOverrideScope.value,
    targetId: newOverrideTargetId.value,
    targetName,
    serviceConfig: {},
    variables: [],
  };

  env.overrides.push(override);
  envStore.saveEnvironment(env);
  showAddOverrideDialog.value = false;
  ElMessage.success('已添加覆盖配置');
}

function handleDeleteOverride(idx: number) {
  const env = selectedEnv.value;
  if (!env?.overrides) return;
  env.overrides.splice(idx, 1);
  envStore.saveEnvironment(env);
}

function addOverrideVariable(override: EnvOverride) {
  if (!override.variables) override.variables = [];
  override.variables.push({ key: '', value: '', description: '', enabled: true });
  handleSaveEnv();
}

function deleteOverrideVariable(override: EnvOverride, idx: number) {
  override.variables?.splice(idx, 1);
  handleSaveEnv();
}

// --- 导入/导出 ---

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

// --- 初始化 ---

watch(selectedEnvId, () => {
  ensureServiceConfig();
});

onMounted(async () => {
  if (window.services) {
    localIp.value = window.services.getLocalIP();
    const serverUrl = window.services.getServerUrl();
    API_BASE.value = serverUrl;
  }
  await Promise.all([loadServices(), loadProjects()]);
});
</script>

<template>
  <div class="env-panel">
    <div class="panel-header">
      <div class="header-left">
        <span class="title">环境配置</span>
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

      <!-- 右侧编辑区 -->
      <div class="env-editor">
        <template v-if="selectedEnv">
          <div class="editor-header">
            <h3>{{ selectedEnv.name }}</h3>
            <el-button size="small" type="primary" @click="handleSaveEnv">保存</el-button>
          </div>

          <el-tabs v-model="editTab" class="env-tabs">
            <!-- Tab 1: 环境变量 -->
            <el-tab-pane label="环境变量" name="variables">
              <div class="variables-content">
                <div style="display: flex; justify-content: flex-end; margin-bottom: 12px;">
                  <el-button size="small" :icon="Plus" @click="handleAddVariable">添加变量</el-button>
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
              </div>
            </el-tab-pane>

            <!-- Tab 3: 覆盖配置 -->
            <el-tab-pane label="覆盖配置" name="overrides">
              <div class="overrides-content">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                  <span class="override-hint">项目/服务级别的覆盖（只填写需要覆盖的字段，留空则继承上层）</span>
                  <el-button size="small" type="primary" :icon="Plus" @click="handleAddOverride">添加覆盖</el-button>
                </div>

                <div v-if="!selectedEnv.overrides?.length" class="override-empty">
                  <el-empty description="暂无覆盖配置" :image-size="80" />
                </div>

                <el-collapse v-else>
                  <el-collapse-item v-for="(override, idx) in selectedEnv.overrides" :key="idx" :name="idx">
                    <template #title>
                      <div class="override-title">
                        <el-tag :type="override.scope === 'project' ? 'warning' : 'primary'" size="small" effect="plain">
                          {{ override.scope === 'project' ? '项目' : '服务' }}
                        </el-tag>
                        <span class="override-name">{{ override.targetName || `ID: ${override.targetId}` }}</span>
                        <el-button size="small" link type="danger" :icon="Delete" @click.stop="handleDeleteOverride(idx)" style="margin-left: auto;" />
                      </div>
                    </template>

                    <!-- 覆盖的服务配置 -->
                    <div class="override-section">
                      <h4 class="override-section-title">服务配置覆盖</h4>
                      <div class="form-row compact">
                        <label>端口</label>
                        <el-input-number
                          v-model="override.serviceConfig!.port"
                          :min="1" :max="65535"
                          controls-position="right"
                          size="small"
                          placeholder="继承上层"
                        />
                      </div>
                      <div class="form-row compact">
                        <label>接口前缀</label>
                        <el-input v-model="override.serviceConfig!.prefix" size="small" placeholder="继承上层" />
                      </div>
                      <div class="form-row compact">
                        <label>主机地址</label>
                        <el-input v-model="override.serviceConfig!.realHost" size="small" placeholder="继承上层" />
                      </div>
                      <div class="form-row compact">
                        <label>端口</label>
                        <el-input v-model="override.serviceConfig!.realPort" size="small" placeholder="继承上层" style="width: 120px" />
                      </div>
                      <div class="form-row compact">
                        <label>前缀</label>
                        <el-input v-model="override.serviceConfig!.realPrefix" size="small" placeholder="继承上层" />
                      </div>
                    </div>

                    <!-- 覆盖的变量 -->
                    <div class="override-section">
                      <div style="display: flex; justify-content: space-between; align-items: center;">
                        <h4 class="override-section-title">变量覆盖</h4>
                        <el-button size="small" link :icon="Plus" @click="addOverrideVariable(override)">添加变量</el-button>
                      </div>
                      <el-table v-if="override.variables?.length" :data="override.variables" stripe size="small" style="width: 100%">
                        <el-table-column label="启用" width="60">
                          <template #default="{ row }">
                            <el-switch v-model="row.enabled" size="small" />
                          </template>
                        </el-table-column>
                        <el-table-column label="变量名" min-width="120">
                          <template #default="{ row }">
                            <el-input v-model="row.key" size="small" placeholder="variableName" />
                          </template>
                        </el-table-column>
                        <el-table-column label="值" min-width="160">
                          <template #default="{ row }">
                            <el-input v-model="row.value" size="small" placeholder="覆盖值" />
                          </template>
                        </el-table-column>
                        <el-table-column label="" width="50">
                          <template #default="{ $index }">
                            <el-button size="small" link type="danger" :icon="Delete" @click="deleteOverrideVariable(override, $index)" />
                          </template>
                        </el-table-column>
                      </el-table>
                      <div v-else class="empty-tip">暂无覆盖变量（同名变量将覆盖全局值）</div>
                    </div>
                  </el-collapse-item>
                </el-collapse>
              </div>
            </el-tab-pane>
          </el-tabs>
        </template>
        <template v-else>
          <div class="env-placeholder">
            <el-empty description="从左侧选择一个环境" />
          </div>
        </template>
      </div>
    </div>

    <!-- 添加覆盖对话框 -->
    <el-dialog v-model="showAddOverrideDialog" title="添加覆盖配置" width="400px" destroy-on-close>
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <div>
          <label style="display: block; margin-bottom: 4px; font-size: 13px;">覆盖类型</label>
          <el-radio-group v-model="newOverrideScope">
            <el-radio-button label="service">服务</el-radio-button>
            <el-radio-button label="project">项目</el-radio-button>
          </el-radio-group>
        </div>
        <div>
          <label style="display: block; margin-bottom: 4px; font-size: 13px;">选择目标</label>
          <el-select v-model="newOverrideTargetId" :placeholder="newOverrideScope === 'project' ? '选择项目' : '选择服务'" style="width: 100%">
            <el-option v-for="t in availableOverrideTargets" :key="t.id" :label="t.name" :value="t.id" />
          </el-select>
        </div>
      </div>
      <template #footer>
        <el-button @click="showAddOverrideDialog = false">取消</el-button>
        <el-button type="primary" :disabled="!newOverrideTargetId" @click="confirmAddOverride">确定</el-button>
      </template>
    </el-dialog>
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

.env-tabs {
  height: calc(100% - 48px);
}

:deep(.env-tabs .el-tabs__content) {
  overflow-y: auto;
  height: calc(100% - 40px);
}

/* 服务配置内容 */
.service-config-content {
  max-width: 640px;
}

.form-row {
  display: flex;
  align-items: center;
  margin-bottom: 14px;
}
.form-row label {
  width: 90px;
  color: var(--text-primary);
  font-size: 13px;
  flex-shrink: 0;
}
.form-control {
  flex: 1;
}
.form-row.compact {
  margin-bottom: 10px;
}
.form-row.compact label {
  width: 70px;
  font-size: 12px;
}

.port-group {
  display: flex;
  gap: 10px;
}
.port-input {
  flex: 1;
}

.status-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: 4px;
  background-color: #FDE2E2;
  color: #F56C6C;
  font-size: 13px;
  font-weight: 500;
}
.status-tag.running {
  background-color: #E1F3D8;
  color: #67C23A;
}

.warning-box {
  background-color: #F4F4F5;
  border-radius: 6px;
  padding: 12px 16px;
  display: flex;
  gap: 10px;
  color: #E6A23C;
  font-size: 12px;
  line-height: 1.5;
  align-items: flex-start;
  margin-bottom: 14px;
}
.warn-icon { flex-shrink: 0; margin-top: 2px; }

.footer-actions {
  margin-top: 16px;
  display: flex;
  gap: 12px;
}

/* 变量内容 */
.variables-content {
  max-width: 800px;
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

/* 覆盖配置内容 */
.overrides-content {
  max-width: 800px;
}

.override-hint {
  font-size: 12px;
  color: var(--text-secondary);
}

.override-empty {
  padding: 20px 0;
}

.override-title {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding-right: 8px;
}

.override-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

.override-section {
  padding: 12px 0;
  border-bottom: 1px solid var(--border-color);
}
.override-section:last-child {
  border-bottom: none;
}

.override-section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 8px;
}

.empty-tip {
  text-align: center;
  font-size: 12px;
  color: var(--text-secondary);
  padding: 12px 0;
}

.env-placeholder {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
}
</style>
