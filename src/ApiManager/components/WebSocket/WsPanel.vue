/**
 * WsPanel - WebSocket Mock 服务管理面板
 *
 * 提供 WebSocket Mock Server 的完整管理功能：
 * - 左侧：服务列表（创建/选择/删除）
 * - 右侧：4 个 Tab（服务配置、消息规则、连接管理、消息日志）
 */
<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted, inject, type Ref } from 'vue';
import { Plus, Delete, VideoPlay, VideoPause, Promotion, Connection, ChatDotRound, Setting, QuestionFilled } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import CodeEditor from '../CodeEditor.vue';
import type { WsServer, WsRule, WsLogEntry, WsClientInfo, WsMatchType, WsResponseMode } from '@/types/mock';

const isDark = inject<Ref<boolean>>('isDark', ref(false));
const API_BASE = ref('http://localhost:3000');

// ==================== 数据状态 ====================
const servers = ref<WsServer[]>([]);
const selectedServerId = ref<number | null>(null);
const activeTab = ref('config');
const serverStatus = ref<Record<string, { running: boolean; clientCount: number }>>({});
const clients = ref<WsClientInfo[]>([]);
const logs = ref<WsLogEntry[]>([]);
const lastLogTimestamp = ref(0);

// 轮询定时器
let pollTimer: ReturnType<typeof setInterval> | null = null;

const selectedServer = computed(() => servers.value.find(s => s.id === selectedServerId.value) || null);
const isRunning = computed(() => {
  if (!selectedServerId.value) return false;
  return !!serverStatus.value[String(selectedServerId.value)]?.running;
});

const localIp = computed(() => {
  return API_BASE.value.replace('http://', '').split(':')[0] || 'localhost';
});

// ==================== 生命周期 ====================
onMounted(() => {
  if (window.services) API_BASE.value = window.services.getServerUrl();
  loadServers();
  pollTimer = setInterval(pollData, 2000);
});

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer);
});

// ==================== API 调用 ====================
async function api(path: string, method = 'GET', body?: any) {
  const opts: RequestInit = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API_BASE.value}${path}`, opts);
  return res.json();
}

async function loadServers() {
  try {
    servers.value = await api('/_admin/ws/servers');
    if (servers.value.length > 0 && !selectedServerId.value) {
      selectedServerId.value = servers.value[0].id;
    }
    await loadStatus();
  } catch { ElMessage.error('加载 WS 服务失败'); }
}

async function loadStatus() {
  try { serverStatus.value = await api('/_admin/ws/server/status'); } catch {}
}

async function pollData() {
  await loadStatus();
  if (!selectedServerId.value) return;
  const sid = selectedServerId.value;
  // 增量获取日志
  try {
    const since = lastLogTimestamp.value || 0;
    const newLogs: WsLogEntry[] = await api(`/_admin/ws/server/${sid}/logs?since=${since}`);
    if (newLogs.length > 0) {
      logs.value.push(...newLogs);
      if (logs.value.length > 500) logs.value.splice(0, logs.value.length - 500);
      lastLogTimestamp.value = newLogs[newLogs.length - 1].timestamp;
    }
  } catch {}
  // 获取客户端列表
  try { clients.value = await api(`/_admin/ws/server/${sid}/clients`); } catch {}
}

// ==================== 服务 CRUD ====================
async function addServer() {
  const newServer: Partial<WsServer> = {
    name: '新建 WS 服务',
    port: 8080,
    path: '/ws',
    description: '',
    rules: [],
    onConnectMessage: '',
  };
  try {
    const res = await api('/_admin/ws/server/save', 'POST', newServer);
    servers.value = res.data;
    selectedServerId.value = servers.value[servers.value.length - 1].id;
  } catch { ElMessage.error('创建失败'); }
}

async function saveServer() {
  if (!selectedServer.value) return;
  try {
    const res = await api('/_admin/ws/server/save', 'POST', selectedServer.value);
    servers.value = res.data;
    ElMessage.success('保存成功');
  } catch { ElMessage.error('保存失败'); }
}

async function deleteServer(id: number) {
  try {
    await ElMessageBox.confirm('确定删除该 WS 服务？', '提示', { type: 'warning' });
    const res = await api('/_admin/ws/server/delete', 'POST', { id });
    servers.value = res.data;
    if (selectedServerId.value === id) {
      selectedServerId.value = servers.value.length > 0 ? servers.value[0].id : null;
    }
  } catch {}
}

async function toggleServer() {
  if (!selectedServer.value) return;
  const sid = selectedServer.value.id;
  try {
    if (isRunning.value) {
      await api('/_admin/ws/server/stop', 'POST', { id: sid });
      ElMessage.success('服务已停止');
    } else {
      // 先保存最新配置再启动
      await api('/_admin/ws/server/save', 'POST', selectedServer.value);
      await api('/_admin/ws/server/start', 'POST', { id: sid });
      ElMessage.success('服务已启动');
    }
    await loadStatus();
  } catch (e: any) {
    ElMessage.error(e?.message || '操作失败，端口可能被占用');
  }
}

function selectServer(id: number) {
  selectedServerId.value = id;
  logs.value = [];
  lastLogTimestamp.value = 0;
  clients.value = [];
  // 立即加载该服务的日志
  pollData();
}

// ==================== 规则管理 ====================
function addRule() {
  if (!selectedServer.value) return;
  const rule: WsRule = {
    id: Date.now(),
    name: '新规则',
    active: true,
    matchType: 'contains',
    matchPattern: '',
    delay: 0,
    responseMode: 'basic',
    responseBasic: '',
    responseAdvanced: `function main(message, Mock) {\n  return { echo: message };\n}`,
  };
  selectedServer.value.rules.push(rule);
}

function removeRule(index: number) {
  if (!selectedServer.value) return;
  selectedServer.value.rules.splice(index, 1);
}

// ==================== 消息发送 ====================
const sendTarget = ref('__all__');
const sendMessage = ref('');

async function sendManualMessage() {
  if (!selectedServerId.value || !sendMessage.value) return;
  try {
    await api(`/_admin/ws/server/${selectedServerId.value}/send`, 'POST', {
      clientId: sendTarget.value,
      message: sendMessage.value,
    });
    sendMessage.value = '';
  } catch { ElMessage.error('发送失败'); }
}

async function disconnectClient(clientId: string) {
  if (!selectedServerId.value) return;
  try {
    await api(`/_admin/ws/server/${selectedServerId.value}/disconnect`, 'POST', { clientId });
    ElMessage.success('已断开');
    clients.value = clients.value.filter(c => c.clientId !== clientId);
  } catch { ElMessage.error('断开失败'); }
}

// ==================== 工具函数 ====================
function formatTime(ts: number) {
  return new Date(ts).toLocaleString('zh-CN', { hour12: false });
}

function formatShortTime(ts: number) {
  return new Date(ts).toLocaleTimeString('zh-CN', { hour12: false });
}

function directionIcon(dir: string) {
  if (dir === 'in') return '⬇';
  if (dir === 'out') return '⬆';
  return 'ℹ';
}

function directionClass(dir: string) {
  if (dir === 'in') return 'log-in';
  if (dir === 'out') return 'log-out';
  return 'log-system';
}

const matchTypeOptions: { label: string; value: WsMatchType }[] = [
  { label: '精确匹配', value: 'exact' },
  { label: '包含', value: 'contains' },
  { label: '正则', value: 'regex' },
  { label: '任意', value: 'any' },
];

/** 欢迎消息的双向绑定代理（处理 undefined） */
const welcomeMessage = computed({
  get: () => selectedServer.value?.onConnectMessage || '',
  set: (val: string) => { if (selectedServer.value) selectedServer.value.onConnectMessage = val; }
});
</script>

<template>
  <div class="ws-panel" :class="{ dark: isDark }">
    <!-- 左侧：服务列表 -->
    <div class="ws-sidebar">
      <div class="sidebar-header">
        <span class="sidebar-title">WS 服务</span>
        <div style="display: flex; gap: 4px; align-items: center;">
          <el-button :icon="Plus" size="small" circle @click="addServer" />
        </div>
      </div>
      <div class="server-list">
        <div
          v-for="s in servers" :key="s.id"
          class="server-item"
          :class="{ active: s.id === selectedServerId }"
          @click="selectServer(s.id)"
        >
          <div class="server-item-info">
            <span class="server-dot" :class="{ running: serverStatus[String(s.id)]?.running }" />
            <span class="server-name">{{ s.name }}</span>
          </div>
          <span class="server-port">:{{ s.port }}{{ s.path }}</span>
        </div>
        <div v-if="servers.length === 0" class="empty-hint">暂无服务，点击 + 创建</div>
      </div>
    </div>

    <!-- 右侧：详情面板 -->
    <div class="ws-main" v-if="selectedServer">
      <el-tabs v-model="activeTab" class="ws-tabs">
        <!-- Tab 1: 服务配置 -->
        <el-tab-pane label="服务配置" name="config">
          <template #label><el-icon><Setting /></el-icon>&nbsp;配置</template>
          <div class="tab-content config-tab">
            <el-form label-width="100px" size="small" class="config-form">
              <el-form-item label="服务名称">
                <el-input v-model="selectedServer.name" placeholder="如：聊天 Mock" />
              </el-form-item>
              <el-form-item label="端口">
                <el-input-number v-model="selectedServer.port" :min="1024" :max="65535" />
              </el-form-item>
              <el-form-item label="路径">
                <el-input v-model="selectedServer.path" placeholder="/ws" />
              </el-form-item>
              <el-form-item label="本机 IP">
                <div class="ip-info">
                  <el-tag effect="plain">{{ localIp }}</el-tag>
                  <span class="ip-hint">局域网内其他设备可通过此 IP 连接</span>
                </div>
              </el-form-item>
              <el-form-item label="连接地址">
                <div class="address-info">
                  <el-tag :type="isRunning ? 'success' : 'info'" effect="plain">ws://{{ localIp }}:{{ selectedServer.port }}{{ selectedServer.path }}</el-tag>
                  <el-tag v-if="isRunning" type="success" size="small">运行中</el-tag>
                  <el-tag v-else type="info" size="small">未启动</el-tag>
                </div>
              </el-form-item>
              <el-form-item label="欢迎消息" class="editor-item">
                <div class="code-editor-sm">
                  <CodeEditor v-model="welcomeMessage" language="json" :isDark="isDark" />
                </div>
                <div class="form-tip">客户端连接时自动发送，支持 JSON 格式（可选）</div>
              </el-form-item>
              <el-form-item label="描述">
                <el-input v-model="selectedServer.description" type="textarea" :rows="2" placeholder="服务描述（可选）" />
              </el-form-item>
              <el-form-item>
                <div class="config-actions">
                  <el-button type="primary" @click="saveServer">保存配置</el-button>
                  <el-button :type="isRunning ? 'danger' : 'success'" @click="toggleServer">
                    <el-icon><VideoPause v-if="isRunning" /><VideoPlay v-else /></el-icon>
                    &nbsp;{{ isRunning ? '停止服务' : '启动服务' }}
                  </el-button>
                  <el-button type="danger" plain @click="deleteServer(selectedServer!.id)">删除服务</el-button>
                </div>
              </el-form-item>
            </el-form>
          </div>
        </el-tab-pane>

        <!-- Tab 2: 消息规则 -->
        <el-tab-pane label="消息规则" name="rules">
          <template #label><el-icon><Promotion /></el-icon>&nbsp;规则</template>
          <div class="tab-content rules-tab">
            <div class="rules-toolbar">
              <el-button :icon="Plus" size="small" @click="addRule">添加规则</el-button>
              <el-button size="small" type="primary" @click="saveServer">保存规则</el-button>
            </div>
            <div class="rules-list">
              <div v-if="selectedServer.rules.length === 0" class="empty-hint" style="padding: 40px 0;">
                暂无规则，点击"添加规则"创建
              </div>
              <el-collapse v-else accordion>
                <el-collapse-item v-for="(rule, idx) in selectedServer.rules" :key="rule.id" :name="rule.id">
                  <template #title>
                    <div class="rule-title">
                      <el-switch v-model="rule.active" size="small" @click.stop />
                      <span class="rule-name-text">{{ rule.name || '未命名规则' }}</span>
                      <el-tag size="small" type="info">{{ matchTypeOptions.find(o => o.value === rule.matchType)?.label }}</el-tag>
                    </div>
                  </template>
                  <div class="rule-form">
                    <el-form label-width="90px" size="small">
                      <el-form-item label="规则名称">
                        <el-input v-model="rule.name" placeholder="规则名称" />
                      </el-form-item>
                      <el-form-item label="匹配类型">
                        <el-select v-model="rule.matchType">
                          <el-option v-for="o in matchTypeOptions" :key="o.value" :label="o.label" :value="o.value" />
                        </el-select>
                      </el-form-item>
                      <el-form-item label="匹配模式" v-if="rule.matchType !== 'any'">
                        <el-input v-model="rule.matchPattern" :placeholder="rule.matchType === 'regex' ? '正则表达式' : '匹配文本'" />
                      </el-form-item>
                      <el-form-item label="延迟(ms)">
                        <el-input-number v-model="rule.delay" :min="0" :step="100" />
                      </el-form-item>
                      <el-form-item label="响应模式">
                        <el-radio-group v-model="rule.responseMode">
                          <el-radio value="basic">基础</el-radio>
                          <el-radio value="advanced">高级(脚本)</el-radio>
                        </el-radio-group>
                      </el-form-item>
                      <el-form-item label="响应内容" v-if="rule.responseMode === 'basic'" class="editor-item">
                        <div class="code-editor-container">
                          <CodeEditor v-model="rule.responseBasic" language="json" :isDark="isDark" />
                        </div>
                      </el-form-item>
                      <el-form-item label="响应脚本" v-if="rule.responseMode === 'advanced'" class="editor-item">
                        <div class="code-editor-container">
                          <CodeEditor v-model="rule.responseAdvanced" language="javascript" :isDark="isDark" />
                        </div>
                      </el-form-item>
                      <el-form-item>
                        <el-button type="danger" size="small" plain @click="removeRule(idx)">删除规则</el-button>
                      </el-form-item>
                    </el-form>
                  </div>
                </el-collapse-item>
              </el-collapse>
            </div>
          </div>
        </el-tab-pane>

        <!-- Tab 3: 连接管理 -->
        <el-tab-pane label="连接管理" name="clients">
          <template #label><el-icon><Connection /></el-icon>&nbsp;连接</template>
          <div class="tab-content clients-tab">
            <el-table :data="clients" stripe size="small" style="width: 100%">
              <el-table-column label="客户端 ID" prop="clientId" min-width="200" show-overflow-tooltip />
              <el-table-column label="IP 地址" prop="clientIp" width="150" />
              <el-table-column label="连接时间" width="180">
                <template #default="{ row }">{{ formatTime(row.connectedAt) }}</template>
              </el-table-column>
              <el-table-column label="操作" width="160">
                <template #default="{ row }">
                  <el-button size="small" type="danger" plain @click="disconnectClient(row.clientId)">断开</el-button>
                  <el-button size="small" plain @click="sendTarget = row.clientId; activeTab = 'logs'">发送</el-button>
                </template>
              </el-table-column>
            </el-table>
            <div v-if="clients.length === 0" class="empty-hint" style="padding: 40px 0;">
              {{ isRunning ? '暂无客户端连接' : '服务未启动' }}
            </div>
          </div>
        </el-tab-pane>

        <!-- Tab 4: 消息日志 -->
        <el-tab-pane label="消息日志" name="logs">
          <template #label><el-icon><ChatDotRound /></el-icon>&nbsp;日志</template>
          <div class="tab-content logs-tab">
            <div class="log-list" ref="logListRef">
              <div v-if="logs.length === 0" class="empty-hint" style="padding: 40px 0;">
                {{ isRunning ? '暂无消息' : '启动服务后查看消息日志' }}
              </div>
              <div v-for="log in logs" :key="log.id" class="log-entry" :class="directionClass(log.direction)">
                <span class="log-dir">{{ directionIcon(log.direction) }}</span>
                <span class="log-time">{{ formatShortTime(log.timestamp) }}</span>
                <span class="log-client" v-if="log.direction !== 'system'">{{ log.clientId?.split('_').slice(-1)[0] }}</span>
                <span class="log-msg">{{ log.message }}</span>
                <el-tag v-if="log.matchedRule" size="small" type="info" class="log-rule">{{ log.matchedRule }}</el-tag>
              </div>
            </div>
            <div class="send-bar">
              <el-select v-model="sendTarget" size="small" style="width: 180px" placeholder="发送目标">
                <el-option label="广播(所有客户端)" value="__all__" />
                <el-option v-for="c in clients" :key="c.clientId" :label="c.clientId.split('_').slice(-1)[0] + ' (' + c.clientIp + ')'" :value="c.clientId" />
              </el-select>
              <el-input v-model="sendMessage" size="small" placeholder="输入消息..." @keyup.enter="sendManualMessage" class="send-input" />
              <el-button size="small" type="primary" :icon="Promotion" @click="sendManualMessage" :disabled="!sendMessage || !isRunning">发送</el-button>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>

    <!-- 未选择服务时的占位 -->
    <div class="ws-main ws-empty" v-else>
      <el-empty description="选择或创建一个 WS 服务" />
    </div>
  </div>
</template>

<style scoped>
.ws-panel {
  height: 100%;
  display: flex;
  overflow: hidden;
}

/* ===== 左侧栏 ===== */
.ws-sidebar {
  width: 220px;
  min-width: 220px;
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.sidebar-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.server-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}

.server-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  cursor: pointer;
  transition: background-color 0.15s;
  border-left: 3px solid transparent;
}

.server-item:hover {
  background-color: var(--bg-hover);
}

.server-item.active {
  background-color: var(--primary-bg);
  border-left-color: var(--primary-color);
}

.server-item-info {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.server-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: #909399;
  flex-shrink: 0;
}

.server-dot.running {
  background-color: #67c23a;
  box-shadow: 0 0 6px rgba(103, 194, 58, 0.6);
}

.server-name {
  font-size: 13px;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.server-port {
  font-size: 11px;
  color: var(--text-secondary);
  flex-shrink: 0;
}

/* ===== 右侧主区域 ===== */
.ws-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

.ws-main.ws-empty {
  justify-content: center;
  align-items: center;
}

.ws-tabs {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.ws-tabs :deep(.el-tabs__header) {
  margin: 0;
  padding: 0 12px;
  flex-shrink: 0;
}

.ws-tabs :deep(.el-tabs__content) {
  flex: 1;
  overflow: hidden;
}

.ws-tabs :deep(.el-tab-pane) {
  height: 100%;
}

.tab-content {
  height: 100%;
  overflow-y: auto;
  padding: 16px;
}

/* ===== 配置 Tab ===== */
.config-form {
  max-width: 600px;
}

.config-actions {
  display: flex;
  gap: 8px;
}

.ip-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ip-hint {
  font-size: 12px;
  color: var(--text-secondary);
}

.address-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.code-editor-sm {
  width: 100%;
  height: 100px;
}

.form-tip {
  font-size: 11px;
  color: var(--text-secondary);
  margin-top: 4px;
  line-height: 1.4;
}

/* ===== 规则 Tab ===== */
.rules-toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.rules-list {
  overflow-y: auto;
}

.rule-title {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
}

.rule-name-text {
  font-size: 13px;
  color: var(--text-primary);
}

.rule-form {
  padding: 8px 0 0 0;
}

.editor-item :deep(.el-form-item__content) {
  display: block;
}

.code-editor-container {
  width: 100%;
  height: 200px;
}

/* ===== 日志 Tab ===== */
.logs-tab {
  display: flex;
  flex-direction: column;
  padding: 0;
}

.log-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 12px;
}

.log-entry {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 4px;
  margin-bottom: 2px;
  font-size: 12px;
  line-height: 1.6;
}

.log-entry.log-in {
  background-color: rgba(64, 158, 255, 0.06);
}

.log-entry.log-out {
  background-color: rgba(103, 194, 58, 0.06);
}

.log-entry.log-system {
  background-color: rgba(144, 147, 153, 0.06);
}

.log-dir {
  flex-shrink: 0;
  width: 18px;
  text-align: center;
}

.log-in .log-dir { color: #409eff; }
.log-out .log-dir { color: #67c23a; }
.log-system .log-dir { color: #909399; }

.log-time {
  flex-shrink: 0;
  color: var(--text-secondary);
  font-size: 11px;
  min-width: 65px;
}

.log-client {
  flex-shrink: 0;
  color: var(--text-secondary);
  font-size: 11px;
  background: var(--bg-hover);
  padding: 0 4px;
  border-radius: 2px;
}

.log-msg {
  flex: 1;
  word-break: break-all;
  color: var(--text-primary);
}

.log-rule {
  flex-shrink: 0;
  margin-left: auto;
}

.send-bar {
  display: flex;
  gap: 8px;
  padding: 10px 12px;
  border-top: 1px solid var(--border-color);
  flex-shrink: 0;
}

.send-input {
  flex: 1;
}

/* ===== 通用 ===== */
.empty-hint {
  text-align: center;
  color: var(--text-secondary);
  font-size: 13px;
  padding: 20px 0;
}
</style>
