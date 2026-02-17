<script setup lang="ts">
import { ref, computed, onMounted, reactive } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import GroupSidebar from './GroupSidebar.vue';
import RuleEditor from './RuleEditor.vue';
import ServiceConfigPanel from './ServiceConfig.vue';
import type { MockGroup, MockRule, TestResultFile, TestResultMeta } from '@/types/mock';

const localIp = ref('localhost');
const API_BASE = ref('http://localhost:3000'); // 默认值
const groups = ref<MockGroup[]>([]);

// 视图状态
const currentRuleId = ref<number | null>(null);
const configGroupId = ref<number | null>(null);
const editingRule = ref<Partial<MockRule>>({});
const testResult = ref<string>('');
const testResultFile = ref<TestResultFile | null>(null);
const testResultMeta = ref<TestResultMeta | null>(null);

// --- 测试结果缓存（按接口 ID 存储，持久化到 localStorage）---
const TEST_CACHE_KEY = 'mock-api-test-results';
const testCache = reactive<Record<number, { result: string; meta: TestResultMeta | null; file: Omit<TestResultFile, 'blobUrl'> | null }>>({});
// 内存中保留 blobUrl（不可持久化）
const blobCache = new Map<number, string>();

const loadTestCache = () => {
  try {
    const raw = localStorage.getItem(TEST_CACHE_KEY);
    if (raw) Object.assign(testCache, JSON.parse(raw));
  } catch {}
};

const saveTestCache = () => {
  try { localStorage.setItem(TEST_CACHE_KEY, JSON.stringify(testCache)); } catch {}
};

const cacheCurrentResult = () => {
  const id = currentRuleId.value;
  if (!id) return;
  testCache[id] = {
    result: testResult.value,
    meta: testResultMeta.value,
    file: testResultFile.value ? { filename: testResultFile.value.filename, size: testResultFile.value.size, contentType: testResultFile.value.contentType } : null,
  };
  if (testResultFile.value?.blobUrl) blobCache.set(id, testResultFile.value.blobUrl);
  saveTestCache();
};

const restoreCachedResult = (ruleId: number) => {
  const cached = testCache[ruleId];
  if (cached) {
    testResult.value = cached.result;
    testResultMeta.value = cached.meta;
    if (cached.file) {
      const blobUrl = blobCache.get(ruleId) || '';
      testResultFile.value = { ...cached.file, blobUrl };
    } else {
      testResultFile.value = null;
    }
  } else {
    testResult.value = '';
    testResultFile.value = null;
    testResultMeta.value = null;
  }
};

// ... loadData, saveData 保持不变 ...
const loadData = async () => { try { const res = await fetch(`${API_BASE.value}/_admin/rules`); if (!res.ok) throw new Error(); const data = (await res.json()) as MockGroup[]; groups.value = Array.isArray(data) ? data : []; } catch (e) { console.error(e); ElMessage.error('无法连接 Mock 服务器'); } };
const saveData = async () => { try { await fetch(`${API_BASE.value}/_admin/rules`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(groups.value) }); } catch (e) { ElMessage.error('保存失败'); } };

// ... 分组操作逻辑保持不变 ...
const handleAddGroup = () => { ElMessageBox.prompt('请输入分组名称', '新建分组').then(({ value }: any) => { if (!value) return; groups.value.push({ id: Date.now(), name: value, children: [] }); saveData(); }).catch(() => {}); };
const handleRenameGroup = (group: MockGroup) => { ElMessageBox.prompt('请输入新名称', '重命名', { inputValue: group.name }).then(({ value }: any) => { if (value) { group.name = value; saveData(); } }).catch(() => {}); };
const handleDeleteGroup = (idx: number) => { ElMessageBox.confirm('确定删除该分组及其下所有接口吗？', '警告', { type: 'warning' }).then(() => { if (groups.value[idx].children.some(r => r.id === currentRuleId.value)) { currentRuleId.value = null; editingRule.value = {}; } groups.value.splice(idx, 1); saveData(); }).catch(() => {}); };
const handleGroupConfig = (group: MockGroup) => { configGroupId.value = group.id; currentRuleId.value = null; };

// --- 接口操作逻辑 ---

const handleAddRule = (group: MockGroup) => {
  const newRule: MockRule = {
    id: Date.now(),
    active: true,
    method: 'GET',
    url: '/api/new',
    delay: 0,

    // --- 新增：必须初始化这些字段 ---
    headers: [],        // 初始化为空数组
    params: [],         // 初始化为空数组
    body: {             // 初始化默认 body 结构
      type: 'none',
      raw: '',
      formData: []
    },

    // 初始化响应配置
    responseHeaders: [],
    responseMode: 'basic',            // 默认基础模式
    responseType: 'application/json', // 默认 JSON
    responseBasic: '{\n  "code": 200,\n  "msg": "Hello World"\n}', // 默认内容
    responseAdvanced: '',             // 高级模式脚本初始化为空字符串(Editor会处理模板)

  };
  group.children.push(newRule);
  handleSelectRule(newRule);
  saveData();
};

const handleSelectRule = (rule: MockRule) => {
  currentRuleId.value = rule.id;
  configGroupId.value = null;
  editingRule.value = JSON.parse(JSON.stringify(rule));
  restoreCachedResult(rule.id);
};

const handleToggleRule = () => { saveData(); };

const handleSaveRule = () => {
  for (const group of groups.value) {
    const idx = group.children.findIndex(r => r.id === currentRuleId.value);
    if (idx !== -1) {
      group.children[idx] = { ...group.children[idx], ...(editingRule.value as MockRule) };
      saveData();
      ElMessage.success('保存成功');
      return;
    }
  }
};

// 【更新】删除接口 (现在由 Sidebar 传入 group 和 rule)
const handleDeleteRule = (group: MockGroup, rule: MockRule) => {
  ElMessageBox.confirm('确定删除该接口吗？', '提示', {
    type: 'warning',
    confirmButtonText: '删除',
    cancelButtonText: '取消'
  }).then(() => {
    const idx = group.children.findIndex(r => r.id === rule.id);
    if (idx !== -1) {
      group.children.splice(idx, 1);
      // 如果删除的是当前选中的接口，清空编辑器
      if (currentRuleId.value === rule.id) {
        currentRuleId.value = null;
        editingRule.value = {};
      }
      saveData();
      ElMessage.success('接口已删除');
    }
  }).catch(() => {});
};

// 【新增】复制当前编辑器中的接口 URL
const handleCopyCurrentUrl = () => {
  // 找到当前选中规则所属的分组
  const group = groups.value.find(g => g.children.some(r => r.id === currentRuleId.value));
  if (group && editingRule.value.url) {
    const port = group.config?.port || 3000;

    let prefix = group.config?.prefix || '';
    if (prefix && !prefix.startsWith('/')) prefix = '/' + prefix;
    if (prefix && prefix.endsWith('/')) prefix = prefix.slice(0, -1);

    let urlPath = editingRule.value.url;
    if (!urlPath.startsWith('/')) urlPath = '/' + urlPath;

    const fullUrl = `http://${localIp.value}:${port}${prefix}${urlPath}`;

    navigator.clipboard.writeText(fullUrl).then(() => {
      ElMessage.success(`已复制: ${fullUrl}`);
    }).catch(() => {
      ElMessage.error('复制失败');
    });
  }
};

const handleUpdateGroup = (updatedGroup: MockGroup) => {
  const idx = groups.value.findIndex(g => g.id === updatedGroup.id);
  if (idx !== -1) groups.value[idx] = updatedGroup;
};

// 当前规则所属分组的配置
const currentGroupConfig = computed(() => {
  const group = groups.value.find(g => g.children.some(r => r.id === currentRuleId.value));
  return group?.config;
});

// 构建真实接口完整 URL（接口级别覆盖分组配置）
const buildRealUrl = () => {
  const group = groups.value.find(g => g.children.some(r => r.id === currentRuleId.value));
  const gc = group?.config;
  const rc = editingRule.value.realConfig;

  const protocol = rc?.protocol || gc?.realProtocol || 'http';
  const host = rc?.host || gc?.realHost || '';
  const port = rc?.port || gc?.realPort || '';
  let prefix = rc?.prefix ?? gc?.realPrefix ?? '';
  let path = rc?.path ?? editingRule.value.url ?? '';

  if (!host) return '';
  let url = `${protocol}://${host}`;
  if (port) url += `:${port}`;
  if (prefix && !prefix.startsWith('/')) prefix = '/' + prefix;
  url += prefix;
  if (path && !path.startsWith('/')) path = '/' + path;
  url += path;
  return url;
};

// ... runTest 支持 mock 和 real 两种模式 ...
const handleRunTest = async (mode: 'mock' | 'real' = 'mock') => {
  testResult.value = '';
  testResultFile.value = null;
  testResultMeta.value = null;

  try {
    let targetUrl: string;

    if (mode === 'real') {
      // 请求真实接口：从 realConfig + 分组配置构建 URL
      targetUrl = buildRealUrl();
      if (!targetUrl) {
        testResult.value = 'Error: 未配置真实接口地址，请在服务配置中设置';
        return;
      }
    } else {
      // 请求 Mock 服务：优先使用分组配置的端口
      if (!editingRule.value.url) {
        testResult.value = 'Error: 未配置接口路径';
        return;
      }
      const group = groups.value.find(g => g.children.some(r => r.id === currentRuleId.value));
      if (group?.config?.running && group.config.port) {
        let prefix = group.config.prefix || '';
        if (prefix && !prefix.startsWith('/')) prefix = '/' + prefix;
        if (prefix && prefix.endsWith('/')) prefix = prefix.slice(0, -1);
        let urlPath = editingRule.value.url || '';
        if (urlPath && !urlPath.startsWith('/')) urlPath = '/' + urlPath;
        targetUrl = `http://${localIp.value}:${group.config.port}${prefix}${urlPath}`;
      } else {
        targetUrl = API_BASE.value + (editingRule.value.url || '');
      }
    }

    // 构建请求选项
    const method = editingRule.value.method || 'GET';
    const fetchOptions: RequestInit = { method };

    // 添加自定义请求头
    const customHeaders: Record<string, string> = {};
    editingRule.value.headers?.forEach(h => {
      if (h.key && h.value) customHeaders[h.key] = h.value;
    });

    // 添加请求体
    if (method !== 'GET' && editingRule.value.body) {
      const bodyDef = editingRule.value.body;
      if (bodyDef.type === 'json' && bodyDef.raw) {
        customHeaders['Content-Type'] = 'application/json';
        fetchOptions.body = bodyDef.raw;
      } else if (bodyDef.type === 'form-data' && bodyDef.formData?.length) {
        const formData = new FormData();
        bodyDef.formData.forEach(item => {
          if (item.key) formData.append(item.key, item.value || '');
        });
        fetchOptions.body = formData;
      }
    }

    if (Object.keys(customHeaders).length > 0) {
      fetchOptions.headers = customHeaders;
    }

    // 添加 query 参数
    if (editingRule.value.params?.length) {
      const url = new URL(targetUrl);
      editingRule.value.params.forEach(p => {
        if (p.key) url.searchParams.set(p.key, p.value || '');
      });
      targetUrl = url.toString();
    }

    // 发送请求
    const startTime = Date.now();
    const res = await fetch(targetUrl, fetchOptions);
    const elapsed = Date.now() - startTime;

    // 构建结果展示
    const resHeaders: Record<string, string> = {};
    res.headers.forEach((v, k) => { resHeaders[k] = v; });

    testResultMeta.value = {
      mode,
      method,
      url: targetUrl,
      status: res.status,
      statusText: res.statusText,
      time: elapsed,
      headers: resHeaders,
    };

    const contentType = res.headers.get('content-type') || '';
    const binaryPatterns = ['application/pdf', 'application/zip', 'application/octet-stream',
      'video/', 'audio/', 'image/', 'application/vnd.openxmlformats', 'application/msword'];
    const isBinary = binaryPatterns.some(p => contentType.includes(p));

    if (isBinary) {
      const blob = await res.blob();
      const disposition = res.headers.get('content-disposition') || '';
      const filenameMatch = disposition.match(/filename\*?=(?:UTF-8''|"?)([^";]+)/i);
      const urlFilename = targetUrl.split('/').pop()?.split('?')[0] || 'download';
      const filename = filenameMatch ? decodeURIComponent(filenameMatch[1]) : urlFilename;

      testResultFile.value = {
        filename,
        size: blob.size,
        contentType,
        blobUrl: URL.createObjectURL(blob),
      };
    } else {
      const text = await res.text();
      try {
        testResult.value = JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        testResult.value = text;
      }
    }

  } catch (e: any) {
    testResult.value = `Error: ${e.message}`;
  }
  cacheCurrentResult();
};

onMounted(() => {
  // 1. 初始化 IP 和 API 地址
  if (window.services) {
    localIp.value = window.services.getLocalIP();
    API_BASE.value = window.services.getServerUrl();
  }
  loadTestCache();
  loadData();
});
</script>

<template>
  <el-container class="full-height">
    <GroupSidebar
        :groups="groups"
        :currentRuleId="currentRuleId"
        @group-add="handleAddGroup"
        @group-rename="handleRenameGroup"
        @group-delete="handleDeleteGroup"
        @group-config="handleGroupConfig"
        @rule-add="handleAddRule"
        @rule-select="handleSelectRule"
        @rule-toggle="handleToggleRule"
        @rule-delete="handleDeleteRule"
    />

    <ServiceConfigPanel
        v-if="configGroupId"
        :group="groups.find(g => g.id === configGroupId)!"
        @update:group="handleUpdateGroup"
        @save="saveData"
    />

    <RuleEditor
        v-else-if="currentRuleId"
        v-model="editingRule"
        :testResult="testResult"
        :testResultFile="testResultFile"
        :testResultMeta="testResultMeta"
        :hasSelection="true"
        :groupConfig="currentGroupConfig"
        :localIp="localIp"
        @save="handleSaveRule"
        @copy="handleCopyCurrentUrl"
        @test="handleRunTest"
    />

    <el-main v-else class="empty-container">
      <el-empty description="请选择接口或配置服务" />
    </el-main>

  </el-container>
</template>

<style scoped>
.full-height { height: 100%; overflow: hidden; }
.empty-container { display: flex; justify-content: center; align-items: center; height: 100%; background: var(--bg-card); }
</style>