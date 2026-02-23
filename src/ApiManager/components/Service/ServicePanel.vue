<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { Plus, Delete, VideoPlay, SwitchButton, CircleCheck, Warning, Search } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { MockService, MockServiceGroup, Project } from '@/types/mock';

const API_BASE = ref('http://localhost:3000');
const localIp = ref('localhost');

const services = ref<MockService[]>([]);
const projects = ref<Project[]>([]);
const serviceStatusMap = ref<Record<string, { running: boolean; port: number; prefix: string }>>({});

/** 当前选中的服务 ID */
const selectedServiceId = ref<number | null>(null);
/** 项目筛选 */
const filterProjectId = ref<number | null>(null);
/** 右侧编辑区 Tab */
const editTab = ref('basic');

const selectedService = computed(() => {
  if (!selectedServiceId.value) return null;
  return services.value.find(s => s.id === selectedServiceId.value) || null;
});

const filteredServices = computed(() => {
  if (!filterProjectId.value) return services.value;
  return services.value.filter(s => s.projectId === filterProjectId.value);
});

const isSelectedRunning = computed(() => {
  if (!selectedServiceId.value) return false;
  const status = serviceStatusMap.value[String(selectedServiceId.value)];
  return status?.running || false;
});

// --- 数据加载 ---

async function loadServices() {
  try {
    const res = await fetch(`${API_BASE.value}/_admin/services`);
    if (!res.ok) throw new Error();
    services.value = await res.json();
  } catch {}
}

async function loadProjects() {
  try {
    const res = await fetch(`${API_BASE.value}/_admin/projects`);
    if (!res.ok) throw new Error();
    projects.value = await res.json();
  } catch {}
}

async function syncStatus() {
  try {
    const res = await fetch(`${API_BASE.value}/_admin/service/status`);
    const data = await res.json();
    const map: Record<string, { running: boolean; port: number; prefix: string }> = {};
    for (const [key, info] of Object.entries(data)) {
      const s = info as any;
      if (s.running) map[key] = { running: true, port: s.port, prefix: s.prefix || '' };
    }
    serviceStatusMap.value = map;
  } catch {}
}

// --- CRUD ---

function handleAddService() {
  const projectId = filterProjectId.value || (projects.value.length > 0 ? projects.value[0].id : 0);
  if (!projectId) {
    ElMessage.warning('请先创建项目');
    return;
  }
  const now = Date.now();
  const newService: MockService = {
    id: now,
    name: '新服务',
    description: '',
    projectId,
    port: 3888,
    prefix: '',
    running: false,
    groups: [{
      id: now + 1,
      name: '默认分组',
      subPrefix: '',
      children: [],
    }],
    createdAt: now,
    updatedAt: now,
  };
  services.value.push(newService);
  selectedServiceId.value = newService.id;
  handleSave();
}

async function handleDeleteService(id: number) {
  const svc = services.value.find(s => s.id === id);
  try {
    await ElMessageBox.confirm(`确定删除服务「${svc?.name}」吗？`, '提示', { type: 'warning' });
  } catch { return; }

  try {
    await fetch(`${API_BASE.value}/_admin/service/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    services.value = services.value.filter(s => s.id !== id);
    if (selectedServiceId.value === id) selectedServiceId.value = null;
    ElMessage.success('已删除');
  } catch {
    ElMessage.error('删除失败');
  }
}

async function handleSave() {
  const svc = selectedService.value;
  if (!svc) return;
  svc.updatedAt = Date.now();
  try {
    await fetch(`${API_BASE.value}/_admin/service/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(svc),
    });
    ElMessage.success('已保存');
  } catch {
    ElMessage.error('保存失败');
  }
}

// --- 分组管理 ---

function handleAddGroup() {
  const svc = selectedService.value;
  if (!svc) return;
  const now = Date.now();
  svc.groups.push({
    id: now,
    name: '新分组',
    subPrefix: '',
    children: [],
  });
}

function handleDeleteGroup(idx: number) {
  const svc = selectedService.value;
  if (!svc) return;
  if (svc.groups.length <= 1) {
    ElMessage.warning('至少保留一个分组');
    return;
  }
  svc.groups.splice(idx, 1);
}

// --- 端口检测 ---

async function handleCheckPort() {
  const svc = selectedService.value;
  if (!svc) return;
  try {
    const res = await fetch(`${API_BASE.value}/_admin/service/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ port: svc.port }),
    });
    const data = await res.json();
    if (data.available) ElMessage.success(`端口 ${svc.port} 可用`);
    else ElMessage.error(`端口 ${svc.port} 已被占用`);
  } catch {
    ElMessage.error('检测失败');
  }
}

// --- 启动/停止 ---

async function handleStart() {
  const svc = selectedService.value;
  if (!svc) return;
  await handleSave();
  try {
    const res = await fetch(`${API_BASE.value}/_admin/service/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceId: svc.id,
        port: svc.port,
        prefix: svc.prefix,
      }),
    });
    const data = await res.json();
    if (data.success) {
      await syncStatus();
      const url = `http://${localIp.value}:${svc.port}${svc.prefix ? (svc.prefix.startsWith('/') ? svc.prefix : '/' + svc.prefix) : ''}`;
      ElMessage.success(`服务已启动: ${url}`);
    } else {
      ElMessage.error('启动失败: ' + (data.error || '未知错误'));
    }
  } catch (e: any) {
    ElMessage.error('启动异常: ' + e.message);
  }
}

async function handleStop() {
  const svc = selectedService.value;
  if (!svc) return;
  try {
    await fetch(`${API_BASE.value}/_admin/service/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serviceId: svc.id }),
    });
    await syncStatus();
    ElMessage.success('服务已关闭');
  } catch {
    ElMessage.error('停止失败');
  }
}

function getProjectName(projectId: number): string {
  const p = projects.value.find(p => p.id === projectId);
  return p ? `${p.icon || '📦'} ${p.name}` : '未关联项目';
}

// --- 初始化 ---

onMounted(async () => {
  if (window.services) {
    localIp.value = window.services.getLocalIP();
    API_BASE.value = window.services.getServerUrl();
  }
  await Promise.all([loadServices(), loadProjects(), syncStatus()]);
});
</script>

<template>
  <div class="service-panel">
    <div class="panel-header">
      <div class="header-left">
        <span class="title">服务管理</span>
        <el-tag size="small" type="info">{{ services.length }}</el-tag>
      </div>
      <div class="header-right">
        <el-select v-model="filterProjectId" placeholder="所有项目" clearable size="small" style="width: 140px">
          <el-option v-for="p in projects" :key="p.id" :label="`${p.icon || '📦'} ${p.name}`" :value="p.id" />
        </el-select>
        <el-button size="small" type="primary" :icon="Plus" @click="handleAddService">新建服务</el-button>
      </div>
    </div>

    <div class="panel-body">
      <!-- 左侧服务列表 -->
      <aside class="service-list">
        <div
          v-for="svc in filteredServices" :key="svc.id"
          class="service-card"
          :class="{ active: selectedServiceId === svc.id }"
          @click="selectedServiceId = svc.id"
        >
          <div class="service-card-top">
            <span class="service-status-dot" :class="{ running: serviceStatusMap[String(svc.id)]?.running }"></span>
            <span class="service-name">{{ svc.name }}</span>
            <el-tag size="small" effect="plain" type="info">:{{ svc.port }}</el-tag>
          </div>
          <div class="service-card-bottom">
            <span class="service-project">{{ getProjectName(svc.projectId) }}</span>
            <el-button size="small" link type="danger" @click.stop="handleDeleteService(svc.id)">删除</el-button>
          </div>
        </div>
        <div v-if="filteredServices.length === 0" class="service-empty">
          暂无服务，点击「新建服务」开始
        </div>
      </aside>

      <!-- 右侧编辑区 -->
      <div class="service-editor">
        <template v-if="selectedService">
          <div class="editor-header">
            <h3>{{ selectedService.name }}</h3>
            <div class="editor-header-actions">
              <div class="status-tag" :class="{ running: isSelectedRunning }">
                <el-icon v-if="isSelectedRunning"><CircleCheck /></el-icon>
                <el-icon v-else><SwitchButton /></el-icon>
                <span>{{ isSelectedRunning ? '运行中' : '已关闭' }}</span>
              </div>
            </div>
          </div>

          <el-tabs v-model="editTab" class="service-tabs">
            <!-- Tab 1: 基础配置 -->
            <el-tab-pane label="基础配置" name="basic">
              <div class="form-content">
                <div class="form-row">
                  <label>服务名称</label>
                  <div class="form-control">
                    <el-input v-model="selectedService.name" placeholder="服务名称" />
                  </div>
                </div>
                <div class="form-row">
                  <label>描述</label>
                  <div class="form-control">
                    <el-input v-model="selectedService.description" placeholder="可选描述" />
                  </div>
                </div>
                <div class="form-row">
                  <label>所属项目</label>
                  <div class="form-control">
                    <el-select v-model="selectedService.projectId" style="width: 100%">
                      <el-option v-for="p in projects" :key="p.id" :label="`${p.icon || '📦'} ${p.name}`" :value="p.id" />
                    </el-select>
                  </div>
                </div>
                <div class="form-row">
                  <label>服务端口</label>
                  <div class="form-control">
                    <div class="port-group">
                      <el-input-number v-model="selectedService.port" :min="1" :max="65535" controls-position="right" class="port-input" />
                      <el-button @click="handleCheckPort">检测端口</el-button>
                    </div>
                  </div>
                </div>
                <div class="form-row">
                  <label>服务前缀</label>
                  <div class="form-control">
                    <el-input v-model="selectedService.prefix" placeholder="/api" />
                  </div>
                </div>
              </div>
            </el-tab-pane>

            <!-- Tab 2: 真实接口 -->
            <el-tab-pane label="真实接口" name="real">
              <div class="form-content">
                <div class="form-row">
                  <label>协议</label>
                  <div class="form-control">
                    <el-radio-group v-model="selectedService.realProtocol">
                      <el-radio-button label="http">HTTP</el-radio-button>
                      <el-radio-button label="https">HTTPS</el-radio-button>
                    </el-radio-group>
                  </div>
                </div>
                <div class="form-row">
                  <label>主机地址</label>
                  <div class="form-control">
                    <el-input v-model="selectedService.realHost" placeholder="如 192.168.1.100 或 api.example.com" />
                  </div>
                </div>
                <div class="form-row">
                  <label>端口</label>
                  <div class="form-control">
                    <el-input v-model="selectedService.realPort" placeholder="如 8080（留空使用默认端口）" style="width: 200px" />
                  </div>
                </div>
                <div class="form-row">
                  <label>接口前缀</label>
                  <div class="form-control">
                    <el-input v-model="selectedService.realPrefix" placeholder="如 /api/v1" />
                  </div>
                </div>
              </div>
            </el-tab-pane>

            <!-- Tab 3: 代理录制 -->
            <el-tab-pane label="代理录制" name="proxy">
              <div class="form-content">
                <div class="form-row">
                  <label>启用代理</label>
                  <div class="form-control">
                    <el-switch v-model="selectedService.proxyEnabled" />
                  </div>
                </div>
                <div class="form-row">
                  <label>目标地址</label>
                  <div class="form-control">
                    <el-input v-model="selectedService.proxyTarget" placeholder="如 http://api.example.com:8080" :disabled="!selectedService.proxyEnabled" />
                  </div>
                </div>
                <div class="warning-box">
                  <el-icon class="warn-icon"><Warning /></el-icon>
                  <div class="warn-content">
                    启用代理后，当 Mock 服务没有匹配到规则时，请求将转发到目标服务器并自动录制为 Mock 规则。
                  </div>
                </div>
              </div>
            </el-tab-pane>

            <!-- Tab 4: 分组管理 -->
            <el-tab-pane label="分组管理" name="groups">
              <div class="groups-content">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                  <span class="groups-hint">管理该服务下的接口分组（controller 级别），每个分组可设置子前缀</span>
                  <el-button size="small" type="primary" :icon="Plus" @click="handleAddGroup">添加分组</el-button>
                </div>
                <div v-for="(group, idx) in selectedService.groups" :key="group.id" class="group-row">
                  <div class="group-row-main">
                    <el-input v-model="group.name" placeholder="分组名称" size="small" style="flex: 1" />
                    <el-input v-model="group.subPrefix" placeholder="子前缀（如 /users）" size="small" style="width: 160px" />
                    <el-tag size="small" type="info">{{ group.children.length }} 接口</el-tag>
                    <el-button :icon="Delete" circle plain type="danger" size="small" @click="handleDeleteGroup(idx)" />
                  </div>
                  <div v-if="group.description !== undefined" class="group-row-desc">
                    <el-input v-model="group.description" placeholder="分组描述（选填）" size="small" />
                  </div>
                </div>
                <div v-if="selectedService.groups.length === 0" class="groups-empty">
                  暂无分组
                </div>
              </div>
            </el-tab-pane>
          </el-tabs>

          <!-- 底部操作栏 -->
          <div class="footer-actions">
            <el-button type="primary" @click="handleSave">保存配置</el-button>
            <el-button
              v-if="!isSelectedRunning"
              type="success"
              :icon="VideoPlay"
              @click="handleStart"
            >启动服务</el-button>
            <el-button
              v-else
              type="danger"
              :icon="SwitchButton"
              plain
              @click="handleStop"
            >关闭服务</el-button>
          </div>
        </template>
        <template v-else>
          <div class="service-placeholder">
            <el-empty description="从左侧选择一个服务" />
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.service-panel {
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

.panel-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

/* 左侧服务列表 */
.service-list {
  width: 230px;
  flex-shrink: 0;
  border-right: 1px solid var(--border-color);
  padding: 12px;
  overflow-y: auto;
}

.service-card {
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  margin-bottom: 6px;
  transition: all 0.2s;
  border: 1px solid transparent;
}
.service-card:hover { background: var(--bg-hover); }
.service-card.active { background: var(--primary-bg); border-color: var(--primary-color); }

.service-card-top {
  display: flex;
  align-items: center;
  gap: 8px;
}

.service-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #909399;
  flex-shrink: 0;
}
.service-status-dot.running { background: #67c23a; }

.service-name {
  flex: 1;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.service-card-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 4px;
}
.service-project {
  font-size: 11px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.service-empty {
  text-align: center;
  padding: 30px 0;
  font-size: 13px;
  color: var(--text-secondary);
}

/* 右侧编辑器 */
.service-editor {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
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
.editor-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.service-tabs {
  flex: 1;
}
:deep(.service-tabs .el-tabs__content) {
  overflow-y: auto;
}

/* 表单 */
.form-content {
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
  margin-top: 14px;
}
.warn-icon { flex-shrink: 0; margin-top: 2px; }

/* 分组管理 */
.groups-content {
  max-width: 800px;
}
.groups-hint {
  font-size: 12px;
  color: var(--text-secondary);
}
.group-row {
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  margin-bottom: 8px;
}
.group-row-main {
  display: flex;
  align-items: center;
  gap: 8px;
}
.group-row-desc {
  margin-top: 6px;
}
.groups-empty {
  text-align: center;
  padding: 20px 0;
  font-size: 13px;
  color: var(--text-secondary);
}

.footer-actions {
  margin-top: 16px;
  display: flex;
  gap: 12px;
  flex-shrink: 0;
  padding-top: 12px;
  border-top: 1px solid var(--border-color);
}

.service-placeholder {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
}
</style>
