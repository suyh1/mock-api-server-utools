<script setup lang="ts">
import { ref, computed } from 'vue';
import { Delete, Search } from '@element-plus/icons-vue';
import { ElMessageBox } from 'element-plus';
import { useRequestLogs } from '@/composables/useRequestLogs';
import type { HttpMethod } from '@/types/mock';

const { logs, clearLogs, logCount } = useRequestLogs();

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
      <el-table :data="filteredLogs" stripe style="width: 100%" row-key="id" size="small">
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
      </el-table>
    </div>
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
</style>
