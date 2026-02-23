<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { Refresh } from '@element-plus/icons-vue';
import { useRequestLogs } from '@/composables/useRequestLogs';
import type { MockService } from '@/types/mock';

const emit = defineEmits<{
  (e: 'navigate', tab: string): void;
}>();

const API_BASE = ref('http://localhost:3000');
const services = ref<MockService[]>([]);
const templateCount = ref(0);
const runningCount = ref(0);
const loading = ref(false);
const { logs } = useRequestLogs();

const totalRules = computed(() => services.value.reduce((sum, s) => s.groups.reduce((gs, g) => gs + g.children.length, gs), 0));
const serviceCount = computed(() => services.value.length);
const recentLogs = computed(() => logs.value.slice(0, 10));

const methodStats = computed(() => {
  const counts: Record<string, number> = { GET: 0, POST: 0, PUT: 0, DELETE: 0 };
  for (const s of services.value) {
    for (const g of s.groups) {
      for (const r of g.children) {
        if (counts[r.method] !== undefined) counts[r.method]++;
      }
    }
  }
  const total = Object.values(counts).reduce((s, v) => s + v, 0) || 1;
  return Object.entries(counts).map(([method, count]) => ({
    method,
    count,
    percent: Math.round((count / total) * 100),
  }));
});

const methodColors: Record<string, string> = {
  GET: '#67c23a',
  POST: '#e6a23c',
  PUT: '#409EFF',
  DELETE: '#f56c6c',
};

const serviceList = ref<{ serviceId: string; name: string; port: number; prefix: string }[]>([]);

async function loadData() {
  loading.value = true;
  try {
    const [servicesRes, templatesRes, statusRes] = await Promise.all([
      fetch(`${API_BASE.value}/_admin/services`),
      fetch(`${API_BASE.value}/_admin/templates`),
      fetch(`${API_BASE.value}/_admin/service/status`),
    ]);
    services.value = await servicesRes.json();
    const templates = await templatesRes.json();
    templateCount.value = Array.isArray(templates) ? templates.length : 0;
    const status = await statusRes.json();
    const list: { serviceId: string; name: string; port: number; prefix: string }[] = [];
    for (const [sid, info] of Object.entries(status)) {
      const s = info as any;
      if (s.running) {
        const svc = services.value.find(sv => String(sv.id) === sid);
        list.push({ serviceId: sid, name: svc?.name || `服务 ${sid}`, port: s.port, prefix: s.prefix || '' });
      }
    }
    serviceList.value = list;
    runningCount.value = list.length;
  } catch {}
  loading.value = false;
}

function formatTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleTimeString('zh-CN', { hour12: false });
}

function statusColor(status: number) {
  if (status >= 200 && status < 300) return '#67c23a';
  if (status >= 400 && status < 500) return '#e6a23c';
  if (status >= 500) return '#f56c6c';
  return '#909399';
}

onMounted(() => {
  if (window.services) {
    API_BASE.value = window.services.getServerUrl();
  }
  loadData();
});
</script>

<template>
  <div class="dashboard-panel">
    <div class="panel-header">
      <div class="header-left">
        <span class="title">数据看板</span>
      </div>
      <div class="header-right">
        <el-button size="small" :icon="Refresh" @click="loadData" :loading="loading">刷新</el-button>
      </div>
    </div>

    <div class="dashboard-body">
      <!-- Row 1: 统计卡片 -->
      <div class="stats-grid">
        <div class="stat-card" @click="emit('navigate', 'api')">
          <div class="stat-value">{{ totalRules }}</div>
          <div class="stat-label">接口总数</div>
        </div>
        <div class="stat-card" @click="emit('navigate', 'service')">
          <div class="stat-value">{{ serviceCount }}</div>
          <div class="stat-label">服务数量</div>
        </div>
        <div class="stat-card" @click="emit('navigate', 'template')">
          <div class="stat-value">{{ templateCount }}</div>
          <div class="stat-label">数据模板</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" :class="{ 'stat-running': runningCount > 0 }">{{ runningCount }}</div>
          <div class="stat-label">运行中服务</div>
        </div>
      </div>

      <!-- Row 2: 请求方法分布 + 服务状态 -->
      <div class="row-2">
        <div class="section-card">
          <div class="section-title">请求方法分布</div>
          <div class="bar-chart">
            <div v-for="item in methodStats" :key="item.method" class="bar-row">
              <span class="bar-label" :style="{ color: methodColors[item.method] }">{{ item.method }}</span>
              <div class="bar-track">
                <div class="bar-fill" :style="{ width: item.percent + '%', background: methodColors[item.method] }"></div>
              </div>
              <span class="bar-count">{{ item.count }}</span>
            </div>
          </div>
        </div>
        <div class="section-card">
          <div class="section-title">服务状态</div>
          <div v-if="serviceList.length === 0" class="empty-hint">暂无运行中的服务</div>
          <div v-else class="service-list">
            <div v-for="s in serviceList" :key="s.serviceId" class="service-item">
              <span class="service-dot"></span>
              <span class="service-name">{{ s.name }}</span>
              <span class="service-port">:{{ s.port }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Row 3: 最近请求 + 快捷操作 -->
      <div class="row-2">
        <div class="section-card">
          <div class="section-title">最近请求</div>
          <div v-if="recentLogs.length === 0" class="empty-hint">暂无请求日志</div>
          <div v-else class="recent-logs">
            <div v-for="log in recentLogs" :key="log.id" class="log-item">
              <span class="log-time">{{ formatTime(log.timestamp) }}</span>
              <el-tag size="small" :type="log.method === 'GET' ? 'success' : log.method === 'POST' ? 'warning' : log.method === 'DELETE' ? 'danger' : 'info'" effect="plain">{{ log.method }}</el-tag>
              <span class="log-url" :title="log.url">{{ log.url }}</span>
              <span class="log-status" :style="{ color: statusColor(log.status) }">{{ log.status }}</span>
            </div>
          </div>
        </div>
        <div class="section-card">
          <div class="section-title">快捷操作</div>
          <div class="quick-actions">
            <div class="action-card" @click="emit('navigate', 'api')">
              <span class="action-icon">📡</span>
              <span class="action-label">接口管理</span>
            </div>
            <div class="action-card" @click="emit('navigate', 'template')">
              <span class="action-icon">📋</span>
              <span class="action-label">数据模板</span>
            </div>
            <div class="action-card" @click="emit('navigate', 'tools')">
              <span class="action-icon">🔧</span>
              <span class="action-label">开发工具</span>
            </div>
            <div class="action-card" @click="emit('navigate', 'log')">
              <span class="action-icon">📜</span>
              <span class="action-label">请求日志</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard-panel {
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

.dashboard-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* 统计卡片 */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.stat-card {
  background: var(--bg-hover);
  border-radius: 10px;
  padding: 20px 16px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid transparent;
}
.stat-card:hover { border-color: var(--primary-color); background: var(--primary-bg); }

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: var(--text-primary);
  font-family: 'Courier New', Courier, monospace;
}
.stat-value.stat-running { color: #67c23a; }

.stat-label {
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 4px;
}

/* 两栏行 */
.row-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.section-card {
  background: var(--bg-hover);
  border-radius: 10px;
  padding: 16px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 12px;
}

.empty-hint {
  font-size: 13px;
  color: var(--text-secondary);
  text-align: center;
  padding: 20px 0;
}

/* 条形图 */
.bar-chart { display: flex; flex-direction: column; gap: 8px; }
.bar-row { display: flex; align-items: center; gap: 8px; }
.bar-label { width: 50px; font-size: 13px; font-weight: 700; font-family: monospace; }
.bar-track { flex: 1; height: 24px; background: var(--bg-card); border-radius: 4px; overflow: hidden; }
.bar-fill { height: 100%; border-radius: 4px; transition: width 0.5s ease; min-width: 2px; }
.bar-count { width: 30px; text-align: right; font-size: 13px; color: var(--text-secondary); font-family: monospace; }

/* 服务列表 */
.service-list { display: flex; flex-direction: column; gap: 6px; }
.service-item { display: flex; align-items: center; gap: 8px; font-size: 13px; padding: 6px 8px; background: var(--bg-card); border-radius: 6px; }
.service-dot { width: 8px; height: 8px; border-radius: 50%; background: #67c23a; flex-shrink: 0; }
.service-name { flex: 1; color: var(--text-primary); }
.service-port { color: var(--text-secondary); font-family: monospace; }

/* 最近请求 */
.recent-logs { display: flex; flex-direction: column; gap: 4px; }
.log-item { display: flex; align-items: center; gap: 8px; font-size: 12px; padding: 4px 6px; border-radius: 4px; }
.log-item:hover { background: var(--bg-card); }
.log-time { color: var(--text-secondary); font-family: monospace; width: 65px; flex-shrink: 0; }
.log-url { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-primary); }
.log-status { width: 30px; text-align: right; font-weight: 600; font-family: monospace; }

/* 快捷操作 */
.quick-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.action-card {
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  padding: 16px 8px; background: var(--bg-card); border-radius: 8px;
  cursor: pointer; transition: all 0.2s; border: 1px solid transparent;
}
.action-card:hover { border-color: var(--primary-color); background: var(--primary-bg); }
.action-icon { font-size: 20px; }
.action-label { font-size: 12px; color: var(--text-primary); }
</style>
