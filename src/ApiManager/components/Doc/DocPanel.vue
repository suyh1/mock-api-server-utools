<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue';
import { ElMessage } from 'element-plus';
import type { MockService, MockRule, Project } from '@/types/mock';
import { generateMarkdownDoc, generateHtmlDoc } from '@/utils/generateApiDoc';

const API_BASE = ref('http://localhost:3000');
const services = ref<MockService[]>([]);
const projects = ref<Project[]>([]);
const loading = ref(false);
const filterProjectId = ref<number | null>(null);
const filterServiceId = ref<number | null>(null);
const showDisabled = ref(false);

const filteredServices = computed(() => {
  let result = services.value;
  if (filterProjectId.value) {
    result = result.filter(s => s.projectId === filterProjectId.value);
  }
  if (filterServiceId.value) {
    result = result.filter(s => s.id === filterServiceId.value);
  }
  return result;
});

const displayServices = computed(() => {
  return filteredServices.value.map(s => ({
    ...s,
    groups: s.groups.map(g => ({
      ...g,
      children: showDisabled.value ? g.children : g.children.filter(r => r.active),
    })).filter(g => g.children.length > 0),
  })).filter(s => s.groups.length > 0);
});

const totalApis = computed(() => displayServices.value.reduce((sum, s) => s.groups.reduce((gs, g) => gs + g.children.length, gs), 0));

type TagType = 'success' | 'warning' | 'info' | 'danger';
function methodColor(method: string): TagType {
  const map: Record<string, TagType> = { GET: 'success', POST: 'warning', PUT: 'info', DELETE: 'danger' };
  return map[method] || 'info';
}

function scrollTo(ruleId: number) {
  nextTick(() => {
    const el = document.getElementById(`doc-rule-${ruleId}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

function formatJson(str: string): string {
  try { return JSON.stringify(JSON.parse(str), null, 2); }
  catch { return str; }
}

async function loadData() {
  loading.value = true;
  try {
    const [pRes, sRes] = await Promise.all([
      fetch(`${API_BASE.value}/_admin/projects`),
      fetch(`${API_BASE.value}/_admin/services`),
    ]);
    projects.value = await pRes.json();
    services.value = await sRes.json();
  } catch {}
  loading.value = false;
}

function exportMarkdown() {
  const md = generateMarkdownDoc(services.value, {
    scope: filterProjectId.value ? 'project' : filterServiceId.value ? 'service' : 'all',
    projectId: filterProjectId.value,
    serviceId: filterServiceId.value,
    projects: projects.value,
    showDisabled: showDisabled.value,
  });
  const blob = new Blob([md], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `api-doc-${Date.now()}.md`;
  a.click();
  URL.revokeObjectURL(url);
  ElMessage.success('已导出 Markdown');
}

function exportHtml() {
  const md = generateMarkdownDoc(services.value, {
    scope: filterProjectId.value ? 'project' : filterServiceId.value ? 'service' : 'all',
    projectId: filterProjectId.value,
    serviceId: filterServiceId.value,
    projects: projects.value,
    showDisabled: showDisabled.value,
  });
  const html = generateHtmlDoc(md);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `api-doc-${Date.now()}.html`;
  a.click();
  URL.revokeObjectURL(url);
  ElMessage.success('已导出 HTML');
}

onMounted(() => {
  if (window.services) {
    API_BASE.value = window.services.getServerUrl();
  }
  loadData();
});
</script>

<template>
  <div class="doc-panel">
    <div class="panel-header">
      <div class="header-left">
        <span class="title">接口文档</span>
        <el-tag size="small" type="info">{{ totalApis }} 个接口</el-tag>
      </div>
      <div class="header-right">
        <el-select v-model="filterProjectId" size="small" clearable placeholder="筛选项目" style="width: 120px" @change="filterServiceId = null">
          <el-option v-for="p in projects" :key="p.id" :label="p.name" :value="p.id" />
        </el-select>
        <el-select v-model="filterServiceId" size="small" clearable placeholder="筛选服务" style="width: 120px">
          <el-option v-for="s in (filterProjectId ? services.filter(s => s.projectId === filterProjectId) : services)" :key="s.id" :label="s.name" :value="s.id" />
        </el-select>
        <el-checkbox v-model="showDisabled" size="small">显示禁用</el-checkbox>
        <el-button size="small" @click="exportMarkdown">导出 MD</el-button>
        <el-button size="small" @click="exportHtml">导出 HTML</el-button>
      </div>
    </div>

    <div class="doc-body">
      <!-- 左侧目录 -->
      <aside class="doc-toc">
        <div v-for="service in displayServices" :key="service.id" class="toc-service">
          <div class="toc-service-title">{{ service.name }}</div>
          <div v-for="group in service.groups" :key="group.id" class="toc-group">
            <div class="toc-group-title">{{ group.name }}</div>
            <div
              v-for="rule in group.children" :key="rule.id"
              class="toc-item"
              @click="scrollTo(rule.id)"
            >
              <el-tag size="small" :type="methodColor(rule.method)" effect="plain" class="toc-method">{{ rule.method }}</el-tag>
              <span class="toc-name">{{ rule.name || rule.url }}</span>
            </div>
          </div>
        </div>
        <div v-if="displayServices.length === 0" class="toc-empty">暂无接口数据</div>
      </aside>

      <!-- 右侧文档内容 -->
      <div class="doc-content">
        <div v-for="service in displayServices" :key="service.id" class="doc-service">
          <h2 class="doc-service-title">{{ service.name }}</h2>
          <p v-if="service.description" class="doc-service-desc">{{ service.description }}</p>

          <div v-for="group in service.groups" :key="group.id" class="doc-group">
            <h3 class="doc-group-title">{{ group.name }}</h3>
            <p v-if="group.description" class="doc-group-desc">{{ group.description }}</p>

            <div v-for="rule in group.children" :key="rule.id" :id="`doc-rule-${rule.id}`" class="doc-rule-card">
              <div class="rule-header">
                <el-tag :type="methodColor(rule.method)" effect="dark" size="small">{{ rule.method }}</el-tag>
                <code class="rule-url">{{ rule.url }}</code>
                <span v-if="rule.name" class="rule-name">{{ rule.name }}</span>
                <el-tag v-if="!rule.active" size="small" type="info" effect="plain">禁用</el-tag>
              </div>

              <!-- 请求头 -->
              <div v-if="rule.headers?.filter(h => h.key).length" class="rule-section">
                <h4>请求头</h4>
                <table class="doc-table">
                  <thead><tr><th>Key</th><th>Value</th><th>必填</th><th>说明</th></tr></thead>
                  <tbody>
                    <tr v-for="h in rule.headers.filter(h => h.key)" :key="h.key">
                      <td><code>{{ h.key }}</code></td>
                      <td>{{ h.value || '-' }}</td>
                      <td>{{ h.required ? '是' : '否' }}</td>
                      <td>{{ h.description || '-' }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <!-- Query 参数 -->
              <div v-if="rule.params?.filter(p => p.key).length" class="rule-section">
                <h4>Query 参数</h4>
                <table class="doc-table">
                  <thead><tr><th>参数名</th><th>示例值</th><th>必填</th><th>说明</th></tr></thead>
                  <tbody>
                    <tr v-for="p in rule.params.filter(p => p.key)" :key="p.key">
                      <td><code>{{ p.key }}</code></td>
                      <td>{{ p.value || '-' }}</td>
                      <td>{{ p.required ? '是' : '否' }}</td>
                      <td>{{ p.description || '-' }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <!-- 请求体 -->
              <div v-if="rule.body && rule.body.type !== 'none'" class="rule-section">
                <h4>请求体 <el-tag size="small" effect="plain">{{ rule.body.type }}</el-tag></h4>
                <pre v-if="rule.body.type === 'json' && rule.body.raw" class="doc-pre">{{ formatJson(rule.body.raw) }}</pre>
                <table v-else-if="rule.body.formData?.filter(f => f.key).length" class="doc-table">
                  <thead><tr><th>Key</th><th>Value</th><th>说明</th></tr></thead>
                  <tbody>
                    <tr v-for="f in rule.body.formData.filter(f => f.key)" :key="f.key">
                      <td><code>{{ f.key }}</code></td>
                      <td>{{ f.value || '-' }}</td>
                      <td>{{ f.description || '-' }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <!-- 响应 -->
              <div class="rule-section">
                <h4>响应</h4>
                <template v-if="rule.responseMode === 'basic'">
                  <div class="response-meta">Content-Type: <code>{{ rule.responseType || 'application/json' }}</code></div>
                  <pre v-if="rule.responseBasic" class="doc-pre">{{ rule.responseType?.includes('json') ? formatJson(rule.responseBasic) : rule.responseBasic }}</pre>
                </template>
                <div v-else class="response-meta" style="color: var(--text-secondary);">高级模式（脚本生成响应）</div>
              </div>
            </div>
          </div>
        </div>

        <div v-if="displayServices.length === 0" class="doc-empty">
          <el-empty description="暂无接口数据" :image-size="80" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.doc-panel {
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

.doc-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

/* 左侧目录 */
.doc-toc {
  width: 220px;
  flex-shrink: 0;
  border-right: 1px solid var(--border-color);
  padding: 12px;
  overflow-y: auto;
}

.toc-service { margin-bottom: 12px; }

.toc-service-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--primary-color);
  padding: 6px 8px 2px;
  margin-top: 4px;
}

.toc-group { margin-bottom: 8px; }

.toc-group-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-secondary);
  padding: 4px 8px 4px 16px;
  margin-bottom: 2px;
}

.toc-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px 5px 24px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  transition: background 0.15s;
}
.toc-item:hover { background: var(--bg-hover); }

.toc-method { flex-shrink: 0; transform: scale(0.85); }
.toc-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-primary); }
.toc-empty { font-size: 13px; color: var(--text-secondary); text-align: center; padding: 20px 0; }

/* 右侧内容 */
.doc-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px;
}

.doc-service-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--primary-color);
  margin: 0 0 4px 0;
  padding-bottom: 8px;
  border-bottom: 2px solid var(--primary-color);
}

.doc-service-desc {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 4px 0 16px 0;
}

.doc-group-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 16px 0 4px 0;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--border-color);
}

.doc-group-desc {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 4px 0 12px 0;
}

.doc-rule-card {
  background: var(--bg-hover);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
}

.rule-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.rule-url {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  background: var(--bg-card);
  padding: 2px 8px;
  border-radius: 4px;
}

.rule-name {
  font-size: 13px;
  color: var(--text-secondary);
}

.rule-section {
  margin-top: 12px;
}

.rule-section h4 {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 6px 0;
  display: flex;
  align-items: center;
  gap: 6px;
}

.doc-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.doc-table th,
.doc-table td {
  border: 1px solid var(--border-color);
  padding: 6px 10px;
  text-align: left;
}

.doc-table th {
  background: var(--bg-card);
  font-weight: 600;
  color: var(--text-secondary);
}

.doc-pre {
  background: var(--bg-card);
  border-radius: 6px;
  padding: 12px;
  font-size: 12px;
  line-height: 1.6;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 300px;
  overflow: auto;
  font-family: 'Courier New', Courier, monospace;
}

.response-meta {
  font-size: 12px;
  color: var(--text-primary);
  margin-bottom: 6px;
}

.doc-empty {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 60px 20px;
}
</style>
