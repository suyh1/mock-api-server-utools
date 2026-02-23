<script setup lang="ts">
import { ref, computed } from 'vue';
import { Delete, Search } from '@element-plus/icons-vue';
import { ElMessageBox, ElMessage } from 'element-plus';
import { useRequestLogs } from '@/composables/useRequestLogs';
import type { HttpMethod, RequestLog } from '@/types/mock';

const { logs, clearLogs, logCount, addLog } = useRequestLogs();

const filterMethod = ref<HttpMethod | ''>('');
const filterStatus = ref<'' | '2xx' | '4xx' | '5xx'>('');
const searchUrl = ref('');

const methodOptions: { label: string; value: HttpMethod | '' }[] = [
  { label: '全部', value: '' },
  { label: 'GET', value: 'GET' },
  { label: 'POST', value: 'POST' },
  { label: 'PUT', value: 'PUT' },
  { label: 'DELETE', value: 'DELETE' },
];

const statusOptions = [
  { label: '全部', value: '' },
  { label: '2xx', value: '2xx' },
  { label: '4xx', value: '4xx' },
  { label: '5xx', value: '5xx' },
];

const filteredLogs = computed(() => {
  return logs.value.filter(log => {
    if (filterMethod.value && log.method !== filterMethod.value) return false;
    if (filterStatus.value) {
      const s = String(log.status)[0];
      if (filterStatus.value === '2xx' && s !== '2') return false;
      if (filterStatus.value === '4xx' && s !== '4') return false;
      if (filterStatus.value === '5xx' && s !== '5') return false;
    }
    if (searchUrl.value && !log.url.toLowerCase().includes(searchUrl.value.toLowerCase())) return false;
    return true;
  });
});

function formatTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleString('zh-CN', { hour12: false });
}

type TagType = 'info' | 'primary' | 'success' | 'warning' | 'danger';
function methodTagType(method: string): TagType {
  const map: Record<string, TagType> = { GET: 'success', POST: 'warning', PUT: 'info', DELETE: 'danger' };
  return map[method] || 'info';
}

function statusColor(status: number) {
  if (status >= 200 && status < 300) return '#67c23a';
  if (status >= 400 && status < 500) return '#e6a23c';
  if (status >= 500) return '#f56c6c';
  return '#909399';
}

function handleClear() {
  ElMessageBox.confirm('确定清空所有日志吗？', '提示', { type: 'warning' }).then(() => {
    clearLogs();
  }).catch(() => {});
}

function formatHeaders(headers?: Record<string, string>) {
  if (!headers || Object.keys(headers).length === 0) return '(无)';
  return Object.entries(headers).map(([k, v]) => `${k}: ${v}`).join('\n');
}

/* ==================== 请求重放 ==================== */

const replayingId = ref<number | null>(null);
const showCompareDialog = ref(false);
const compareOriginal = ref<{ status: number; duration: number; body: string }>({ status: 0, duration: 0, body: '' });
const compareNew = ref<{ status: number; duration: number; body: string }>({ status: 0, duration: 0, body: '' });

async function replayRequest(log: RequestLog) {
  replayingId.value = log.id;
  compareOriginal.value = {
    status: log.status,
    duration: log.duration,
    body: log.responseBody || '(无)',
  };

  try {
    const fetchOptions: RequestInit = { method: log.method };
    if (log.requestHeaders && Object.keys(log.requestHeaders).length > 0) {
      fetchOptions.headers = { ...log.requestHeaders };
    }
    if (log.requestBody && log.method !== 'GET') {
      fetchOptions.body = log.requestBody;
    }

    const startTime = Date.now();
    const res = await fetch(log.url, fetchOptions);
    const elapsed = Date.now() - startTime;
    const resHeaders: Record<string, string> = {};
    res.headers.forEach((v, k) => { resHeaders[k] = v; });
    const text = await res.text();
    let displayBody = text;
    try { displayBody = JSON.stringify(JSON.parse(text), null, 2); } catch {}

    compareNew.value = { status: res.status, duration: elapsed, body: displayBody };

    addLog({
      timestamp: Date.now(),
      method: log.method,
      url: log.url,
      status: res.status,
      statusText: res.statusText,
      duration: elapsed,
      mode: log.mode,
      ruleId: log.ruleId,
      ruleName: log.ruleName ? `[重放] ${log.ruleName}` : '[重放]',
      groupName: log.groupName,
      requestHeaders: log.requestHeaders,
      requestBody: log.requestBody,
      responseHeaders: resHeaders,
      responseBody: text,
    });

    showCompareDialog.value = true;
  } catch (e: any) {
    compareNew.value = { status: 0, duration: 0, body: `Error: ${e.message}` };
    showCompareDialog.value = true;
    ElMessage.error('重放失败: ' + e.message);
  }
  replayingId.value = null;
}
</script>

<template>
  <div class="log-panel">
    <div class="panel-header">
      <div class="header-left">
        <span class="title">请求日志</span>
        <el-tag size="small" type="info">{{ logCount }}</el-tag>
      </div>
      <div class="header-right">
        <el-select v-model="filterMethod" size="small" style="width: 90px" placeholder="方法">
          <el-option v-for="o in methodOptions" :key="o.value" :label="o.label" :value="o.value" />
        </el-select>
        <el-select v-model="filterStatus" size="small" style="width: 80px" placeholder="状态">
          <el-option v-for="o in statusOptions" :key="o.value" :label="o.label" :value="o.value" />
        </el-select>
        <el-input v-model="searchUrl" size="small" placeholder="搜索 URL" clearable :prefix-icon="Search" style="width: 180px" />
        <el-button size="small" type="danger" plain :icon="Delete" @click="handleClear" :disabled="logCount === 0">清空</el-button>
      </div>
    </div>

    <div class="table-wrapper">
      <el-table :data="filteredLogs" stripe style="width: 100%" row-key="id" size="small" v-if="logCount > 0">
        <el-table-column type="expand">
          <template #default="{ row }">
            <div class="expand-detail">
              <div class="detail-section">
                <h4>请求头</h4>
                <pre class="detail-pre">{{ formatHeaders(row.requestHeaders) }}</pre>
              </div>
              <div class="detail-section" v-if="row.requestBody">
                <h4>请求体</h4>
                <pre class="detail-pre">{{ row.requestBody }}</pre>
              </div>
              <div class="detail-section">
                <h4>响应头</h4>
                <pre class="detail-pre">{{ formatHeaders(row.responseHeaders) }}</pre>
              </div>
              <div class="detail-section" v-if="row.responseBody">
                <h4>响应体</h4>
                <pre class="detail-pre">{{ row.responseBody }}</pre>
              </div>
              <div class="detail-section" v-if="row.error">
                <h4>错误信息</h4>
                <pre class="detail-pre error-text">{{ row.error }}</pre>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="时间" width="160">
          <template #default="{ row }">{{ formatTime(row.timestamp) }}</template>
        </el-table-column>
        <el-table-column label="方法" width="80">
          <template #default="{ row }">
            <el-tag size="small" :type="methodTagType(row.method)">{{ row.method }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="URL" prop="url" min-width="200" show-overflow-tooltip />
        <el-table-column label="状态" width="70">
          <template #default="{ row }">
            <span :style="{ color: statusColor(row.status), fontWeight: 600 }">{{ row.status }}</span>
          </template>
        </el-table-column>
        <el-table-column label="耗时" width="80">
          <template #default="{ row }">{{ row.duration }}ms</template>
        </el-table-column>
        <el-table-column label="模式" width="70">
          <template #default="{ row }">
            <el-tag size="small" :type="row.mode === 'mock' ? 'primary' : 'info'" effect="plain">{{ row.mode === 'mock' ? 'Mock' : 'Real' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="80" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="replayRequest(row)" :loading="replayingId === row.id">重放</el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 空状态 -->
      <div v-else class="empty-state">
        <el-empty description="暂无请求日志" :image-size="80" />
      </div>
    </div>

    <!-- 重放对比对话框 -->
    <el-dialog v-model="showCompareDialog" title="重放对比" width="800px" destroy-on-close>
      <div class="compare-container">
        <div class="compare-side">
          <div class="compare-title">原始响应</div>
          <div class="compare-meta">
            <span>状态码: <b :style="{ color: statusColor(compareOriginal.status) }">{{ compareOriginal.status }}</b></span>
            <span>耗时: <b>{{ compareOriginal.duration }}ms</b></span>
          </div>
          <pre class="compare-body">{{ compareOriginal.body }}</pre>
        </div>
        <div class="compare-divider"></div>
        <div class="compare-side">
          <div class="compare-title">重放响应</div>
          <div class="compare-meta">
            <span>状态码: <b :style="{ color: statusColor(compareNew.status) }">{{ compareNew.status }}</b></span>
            <span>耗时: <b>{{ compareNew.duration }}ms</b></span>
          </div>
          <pre class="compare-body">{{ compareNew.body }}</pre>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<style scoped>
.log-panel {
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

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.table-wrapper {
  flex: 1;
  overflow: auto;
  padding: 0 8px;
}

.expand-detail {
  padding: 12px 20px;
}

.detail-section {
  margin-bottom: 12px;
}

.detail-section h4 {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 0 0 6px 0;
}

.detail-pre {
  background: var(--bg-frame, #f5f7fa);
  border-radius: 4px;
  padding: 8px 12px;
  font-size: 12px;
  line-height: 1.6;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 200px;
  overflow: auto;
}

.error-text {
  color: #f56c6c;
}

/* ==================== 重放对比 ==================== */

.compare-container {
  display: flex;
  gap: 0;
  min-height: 300px;
}

.compare-side {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.compare-divider {
  width: 1px;
  background: var(--border-color, #e5e6eb);
  margin: 0 12px;
  flex-shrink: 0;
}

.compare-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.compare-meta {
  display: flex;
  gap: 16px;
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.compare-body {
  flex: 1;
  background: var(--bg-frame, #f5f7fa);
  border-radius: 6px;
  padding: 12px;
  font-size: 12px;
  line-height: 1.6;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 400px;
  overflow: auto;
}

/* ==================== 空状态 ==================== */

.empty-state {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 60px 20px;
}
</style>
