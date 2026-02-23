/**
 * ApiPanel.vue - 接口管理主面板组件（基于 MockService 架构）
 *
 * 数据层级：MockService → MockServiceGroup → MockRule
 * 数据源：/_admin/services
 */
<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, reactive, inject } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import GroupSidebar from './GroupSidebar.vue';
import RuleEditor from './RuleEditor.vue';
import type { MockService, MockServiceGroup, MockRule, TestResultFile, TestResultMeta, Project, HttpMethod } from '@/types/mock';
import { parseCurl } from '@/utils/curlParser';
import { settingsKey } from '@/composables/useSettings';
import { useRequestLogs } from '@/composables/useRequestLogs';
import { environmentsKey } from '@/composables/useEnvironments';

const appSettings = inject(settingsKey, null);
const { addLog } = useRequestLogs();
const envManager = inject(environmentsKey, null);

const localIp = ref('localhost');
const API_BASE = ref('http://localhost:3000');

/** 服务数据列表 */
const services = ref<MockService[]>([]);
/** 服务运行状态映射 */
const serviceStatusMap = ref<Record<string, { running: boolean; port: number; prefix: string }>>({});

// --- 项目选择 ---

const PROJECT_STORAGE_KEY = 'mock-api-current-project';
const projects = ref<Project[]>([]);
const currentProjectId = ref<number | null>((() => {
  try {
    const raw = localStorage.getItem(PROJECT_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
})());

const loadProjects = async () => {
  try {
    const res = await fetch(`${API_BASE.value}/_admin/projects`);
    if (!res.ok) throw new Error();
    projects.value = await res.json();
  } catch {}
};

const handleProjectChange = (val: number | null) => {
  currentProjectId.value = val;
  currentRuleId.value = null;
  editingRule.value = {};
  try {
    if (val === null) localStorage.removeItem(PROJECT_STORAGE_KEY);
    else localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(val));
  } catch {}
};

// --- 视图状态 ---

const currentRuleId = ref<number | null>(null);
const editingRule = ref<Partial<MockRule>>({});
const testResult = ref<string>('');
const testResultFile = ref<TestResultFile | null>(null);
const testResultMeta = ref<TestResultMeta | null>(null);

// --- 测试结果缓存 ---

const TEST_CACHE_KEY = 'mock-api-test-results';
const testCache = reactive<Record<number, { result: string; meta: TestResultMeta | null; file: Omit<TestResultFile, 'blobUrl'> | null }>>({});
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

// --- 辅助：查找 rule 所在的 service + group 上下文 ---

function findRuleContext(ruleId: number): { service: MockService; group: MockServiceGroup; rule: MockRule } | null {
  for (const service of services.value) {
    for (const group of service.groups) {
      const rule = group.children.find(r => r.id === ruleId);
      if (rule) return { service, group, rule };
    }
  }
  return null;
}

// --- 数据加载与保存 ---

const loadData = async () => {
  try {
    const res = await fetch(`${API_BASE.value}/_admin/services`);
    if (!res.ok) throw new Error();
    const data = await res.json();
    services.value = Array.isArray(data) ? data : [];
  } catch (e) {
    console.error(e);
    ElMessage.error('无法连接 Mock 服务器');
  }
};

const saveData = async () => {
  try {
    await fetch(`${API_BASE.value}/_admin/services`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(services.value),
    });
  } catch (e) {
    ElMessage.error('保存失败');
  }
};

const syncStatus = async () => {
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
};

// --- 分组操作 ---

const handleAddGroup = (service: MockService) => {
  ElMessageBox.prompt('请输入分组名称', '新建分组').then(({ value }: any) => {
    if (!value) return;
    const realService = services.value.find(s => s.id === service.id);
    if (!realService) return;
    realService.groups.push({ id: Date.now(), name: value, subPrefix: '', children: [] });
    saveData();
  }).catch(() => {});
};

const handleRenameGroup = (service: MockService, group: MockServiceGroup) => {
  ElMessageBox({
    title: '编辑分组',
    message: `
      <div style="margin-bottom:12px">
        <label style="display:block;margin-bottom:4px;font-size:13px">分组名称</label>
        <input id="__group_name" value="${group.name}" style="width:100%;padding:6px 8px;border:1px solid #dcdfe6;border-radius:4px;box-sizing:border-box" />
      </div>
      <div style="margin-bottom:12px">
        <label style="display:block;margin-bottom:4px;font-size:13px">子前缀（可选）</label>
        <input id="__group_prefix" value="${group.subPrefix || ''}" placeholder="如 /users" style="width:100%;padding:6px 8px;border:1px solid #dcdfe6;border-radius:4px;box-sizing:border-box" />
      </div>
      <div>
        <label style="display:block;margin-bottom:4px;font-size:13px">分组描述（可选）</label>
        <input id="__group_desc" value="${group.description || ''}" placeholder="简要描述该分组" style="width:100%;padding:6px 8px;border:1px solid #dcdfe6;border-radius:4px;box-sizing:border-box" />
      </div>
    `,
    dangerouslyUseHTMLString: true,
    confirmButtonText: '保存',
    cancelButtonText: '取消',
    showCancelButton: true,
    beforeClose: (action, instance, done) => {
      if (action === 'confirm') {
        const nameEl = document.getElementById('__group_name') as HTMLInputElement;
        const prefixEl = document.getElementById('__group_prefix') as HTMLInputElement;
        const descEl = document.getElementById('__group_desc') as HTMLInputElement;
        const name = nameEl?.value?.trim();
        if (name) {
          group.name = name;
          group.subPrefix = prefixEl?.value?.trim() || '';
          group.description = descEl?.value?.trim() || undefined;
          saveData();
        }
      }
      done();
    }
  }).catch(() => {});
};

const handleDeleteGroup = (service: MockService, groupIdx: number) => {
  const realService = services.value.find(s => s.id === service.id);
  if (!realService) return;
  const group = realService.groups[groupIdx];
  const count = group?.children?.length || 0;
  const msg = count > 0
    ? `确定删除分组「${group.name}」及其下的 ${count} 个接口吗？`
    : `确定删除空分组「${group.name}」吗？`;
  ElMessageBox.confirm(msg, '警告', { type: 'warning' }).then(() => {
    if (group.children.some(r => r.id === currentRuleId.value)) { currentRuleId.value = null; editingRule.value = {}; }
    realService.groups.splice(groupIdx, 1);
    saveData();
  }).catch(() => {});
};

// --- 接口操作 ---

const handleAddRule = (service: MockService, group: MockServiceGroup) => {
  const now = Date.now();
  const newRule: MockRule = {
    id: now,
    name: '',
    active: true,
    method: appSettings?.defaultMethod || 'GET',
    url: '/api/new',
    delay: appSettings?.defaultDelay ?? 0,
    createdAt: now,
    updatedAt: now,
    headers: [],
    params: [],
    body: { type: 'none', raw: '', formData: [] },
    responseHeaders: [],
    responseMode: 'basic',
    responseType: 'application/json',
    responseBasic: '{\n  "code": 200,\n  "msg": "Hello World"\n}',
    responseAdvanced: '',
  };
  const realService = services.value.find(s => s.id === service.id);
  const realGroup = realService?.groups.find(g => g.id === group.id);
  if (realGroup) {
    realGroup.children.push(newRule);
    handleSelectRule(newRule);
    saveData();
  }
};

const handleSelectRule = (rule: MockRule) => {
  currentRuleId.value = rule.id;
  editingRule.value = JSON.parse(JSON.stringify(rule));
  restoreCachedResult(rule.id);
};

const handleToggleRule = () => { saveData(); };

const handleSaveRule = () => {
  if (editingRule.value.url && !editingRule.value.url.startsWith('/')) {
    editingRule.value.url = '/' + editingRule.value.url;
  }
  editingRule.value.updatedAt = Date.now();
  const ctx = findRuleContext(currentRuleId.value!);
  if (ctx) {
    const idx = ctx.group.children.findIndex(r => r.id === currentRuleId.value);
    if (idx !== -1) {
      ctx.group.children[idx] = { ...ctx.group.children[idx], ...(editingRule.value as MockRule) };
      saveData();
      ElMessage.success('保存成功');
    }
  }
};

const handleDeleteRule = (service: MockService, group: MockServiceGroup, rule: MockRule) => {
  ElMessageBox.confirm('确定删除该接口吗？', '提示', {
    type: 'warning',
    confirmButtonText: '删除',
    cancelButtonText: '取消'
  }).then(() => {
    const realService = services.value.find(s => s.id === service.id);
    const realGroup = realService?.groups.find(g => g.id === group.id);
    if (!realGroup) return;
    const idx = realGroup.children.findIndex(r => r.id === rule.id);
    if (idx !== -1) {
      realGroup.children.splice(idx, 1);
      if (currentRuleId.value === rule.id) {
        currentRuleId.value = null;
        editingRule.value = {};
      }
      saveData();
      ElMessage.success('接口已删除');
    }
  }).catch(() => {});
};

const handleCopyCurrentUrl = () => {
  const ctx = findRuleContext(currentRuleId.value!);
  if (ctx && editingRule.value.url) {
    const svc = ctx.service;
    const grp = ctx.group;
    const port = svc.port || 3000;
    let servicePrefix = svc.prefix || '';
    if (servicePrefix && !servicePrefix.startsWith('/')) servicePrefix = '/' + servicePrefix;
    if (servicePrefix && servicePrefix.endsWith('/')) servicePrefix = servicePrefix.slice(0, -1);
    let groupPrefix = grp.subPrefix || '';
    if (groupPrefix && !groupPrefix.startsWith('/')) groupPrefix = '/' + groupPrefix;
    if (groupPrefix && groupPrefix.endsWith('/')) groupPrefix = groupPrefix.slice(0, -1);
    let urlPath = editingRule.value.url;
    if (!urlPath.startsWith('/')) urlPath = '/' + urlPath;
    const fullUrl = `http://${localIp.value}:${port}${servicePrefix}${groupPrefix}${urlPath}`;
    navigator.clipboard.writeText(fullUrl).then(() => {
      ElMessage.success(`已复制: ${fullUrl}`);
    }).catch(() => {
      ElMessage.error('复制失败');
    });
  }
};

// --- 接口复制/移动/排序 ---

const handleCopyRule = (rule: MockRule, targetServiceId: number, targetGroupId: number) => {
  const targetService = services.value.find(s => s.id === targetServiceId);
  const targetGroup = targetService?.groups.find(g => g.id === targetGroupId);
  if (!targetGroup) return;
  const now = Date.now();
  const copied: MockRule = { ...JSON.parse(JSON.stringify(rule)), id: now, createdAt: now, updatedAt: now };
  targetGroup.children.push(copied);
  saveData();
  ElMessage.success(`已复制到「${targetGroup.name}」`);
};

const handleMoveRule = (rule: MockRule, sourceService: MockService, sourceGroup: MockServiceGroup, targetServiceId: number, targetGroupId: number) => {
  const srcService = services.value.find(s => s.id === sourceService.id);
  const srcGroup = srcService?.groups.find(g => g.id === sourceGroup.id);
  const tgtService = services.value.find(s => s.id === targetServiceId);
  const tgtGroup = tgtService?.groups.find(g => g.id === targetGroupId);
  if (!srcGroup || !tgtGroup) return;
  const idx = srcGroup.children.findIndex(r => r.id === rule.id);
  if (idx === -1) return;
  const [moved] = srcGroup.children.splice(idx, 1);
  tgtGroup.children.push(moved);
  if (currentRuleId.value === rule.id) {
    currentRuleId.value = null;
    editingRule.value = {};
  }
  saveData();
  ElMessage.success(`已移动到「${tgtGroup.name}」`);
};

const handleReorderRule = (group: MockServiceGroup, fromIdx: number, toIdx: number) => {
  // 在 services 中找到实际的 group 引用
  for (const svc of services.value) {
    const realGroup = svc.groups.find(g => g.id === group.id);
    if (realGroup) {
      const [item] = realGroup.children.splice(fromIdx, 1);
      realGroup.children.splice(toIdx, 0, item);
      saveData();
      return;
    }
  }
};

const handleCloneRule = (rule: MockRule, service: MockService, group: MockServiceGroup) => {
  const realService = services.value.find(s => s.id === service.id);
  const realGroup = realService?.groups.find(g => g.id === group.id);
  if (!realGroup) return;
  const now = Date.now();
  const cloned: MockRule = {
    ...JSON.parse(JSON.stringify(rule)),
    id: now,
    name: (rule.name || rule.url) + ' (副本)',
    createdAt: now,
    updatedAt: now,
  };
  const idx = realGroup.children.findIndex(r => r.id === rule.id);
  realGroup.children.splice(idx + 1, 0, cloned);
  handleSelectRule(cloned);
  saveData();
  ElMessage.success('接口已复制');
};

const handleCurlImport = (service: MockService, group: MockServiceGroup) => {
  const curlText = sidebarRef.value?.curlImportText;
  if (!curlText) return;
  const parsed = parseCurl(curlText);
  if (!parsed) {
    ElMessage.error('无法解析 cURL 命令');
    return;
  }

  const realService = services.value.find(s => s.id === service.id);
  const realGroup = realService?.groups.find(g => g.id === group.id);
  if (!realGroup) return;

  let urlPath = parsed.url;
  try {
    const urlObj = new URL(parsed.url);
    urlPath = urlObj.pathname + urlObj.search;
  } catch {}

  const validMethods = ['GET', 'POST', 'PUT', 'DELETE'] as const;
  const method = validMethods.includes(parsed.method as any) ? parsed.method as HttpMethod : 'GET';

  const now = Date.now();
  const newRule: MockRule = {
    id: now,
    name: `导入: ${method} ${urlPath}`,
    active: true,
    method,
    url: urlPath,
    delay: 0,
    createdAt: now,
    updatedAt: now,
    headers: parsed.headers.filter(h => h.key.toLowerCase() !== 'content-type').map(h => ({ key: h.key, value: h.value })),
    params: [],
    body: { type: parsed.body ? 'json' : 'none', raw: parsed.body || '', formData: [] },
    responseHeaders: [],
    responseMode: 'basic',
    responseType: 'application/json',
    responseBasic: '{\n  "code": 200,\n  "msg": "success"\n}',
    responseAdvanced: '',
  };

  realGroup.children.push(newRule);
  handleSelectRule(newRule);
  saveData();
  ElMessage.success('cURL 导入成功');
};

/** 保存测试用例 */
const handleSaveTestCase = async (testcase: any) => {
  const ctx = findRuleContext(currentRuleId.value!);
  if (ctx) {
    testcase.serviceId = ctx.service.id;
    testcase.groupId = ctx.group.id;
  }
  try {
    await fetch(`${API_BASE.value}/_admin/testcase/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testcase),
    });
    ElMessage.success('测试用例已保存');
  } catch {
    ElMessage.error('保存测试用例失败');
  }
};

/** 批量操作处理 */
const handleBatchAction = (action: string, ruleIds: number[]) => {
  if (!ruleIds.length) return;
  const idSet = new Set(ruleIds);

  switch (action) {
    case 'enable':
      services.value.forEach(s => s.groups.forEach(g => g.children.forEach(r => {
        if (idSet.has(r.id)) r.active = true;
      })));
      saveData();
      ElMessage.success(`已启用 ${ruleIds.length} 个接口`);
      break;
    case 'disable':
      services.value.forEach(s => s.groups.forEach(g => g.children.forEach(r => {
        if (idSet.has(r.id)) r.active = false;
      })));
      saveData();
      ElMessage.success(`已禁用 ${ruleIds.length} 个接口`);
      break;
    case 'delete':
      ElMessageBox.confirm(`确定批量删除 ${ruleIds.length} 个接口吗？`, '批量删除', { type: 'warning' }).then(() => {
        services.value.forEach(s => s.groups.forEach(g => {
          g.children = g.children.filter(r => !idSet.has(r.id));
        }));
        if (currentRuleId.value && idSet.has(currentRuleId.value)) {
          currentRuleId.value = null;
          editingRule.value = {};
        }
        saveData();
        ElMessage.success(`已删除 ${ruleIds.length} 个接口`);
      }).catch(() => {});
      break;
  }
};

// --- 快捷键 ---

const sidebarRef = ref<InstanceType<typeof GroupSidebar> | null>(null);

const handleKeydown = (e: KeyboardEvent) => {
  const isMeta = e.ctrlKey || e.metaKey;
  if (isMeta && e.key === 's') {
    e.preventDefault();
    if (currentRuleId.value) handleSaveRule();
  }
  if (isMeta && e.key === 'f') {
    e.preventDefault();
    sidebarRef.value?.focusSearch();
  }
};

/** 当前规则所属服务的配置（传递给 RuleEditor） */
const currentServiceForRule = computed(() => {
  if (!currentRuleId.value) return null;
  const ctx = findRuleContext(currentRuleId.value);
  return ctx?.service || null;
});

/** 当前规则所属分组（传递给 RuleEditor） */
const currentGroupForRule = computed(() => {
  if (!currentRuleId.value) return null;
  const ctx = findRuleContext(currentRuleId.value);
  return ctx?.group || null;
});

/** 面包屑：服务名 > 分组名 */
const currentBreadcrumb = computed(() => {
  const ctx = currentRuleId.value ? findRuleContext(currentRuleId.value) : null;
  if (!ctx) return '';
  return `${ctx.service.name} > ${ctx.group.name}`;
});

const isTesting = ref(false);

/** 构建真实接口完整 URL（接口级别覆盖服务配置） */
const buildRealUrl = () => {
  const ctx = currentRuleId.value ? findRuleContext(currentRuleId.value) : null;
  const svc = ctx?.service;
  const rc = editingRule.value.realConfig;

  const protocol = rc?.protocol || svc?.realProtocol || 'http';
  const host = rc?.host || svc?.realHost || '';
  const port = rc?.port || svc?.realPort || '';
  let prefix = rc?.prefix ?? svc?.realPrefix ?? '';
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

/** 执行接口调试请求 */
const handleRunTest = async (mode: 'mock' | 'real' = 'mock') => {
  isTesting.value = true;
  testResult.value = '';
  testResultFile.value = null;
  testResultMeta.value = null;

  let targetUrl = '';
  const customHeaders: Record<string, string> = {};

  try {
    if (mode === 'real') {
      targetUrl = buildRealUrl();
      if (!targetUrl) {
        testResult.value = 'Error: 未配置真实接口地址，请在服务配置中设置';
        return;
      }
    } else {
      if (!editingRule.value.url) {
        testResult.value = 'Error: 未配置接口路径';
        return;
      }
      const ctx = currentRuleId.value ? findRuleContext(currentRuleId.value) : null;
      const svc = ctx?.service;
      const grp = ctx?.group;
      const isRunning = svc && serviceStatusMap.value[String(svc.id)]?.running;

      if (isRunning && svc) {
        let servicePrefix = svc.prefix || '';
        if (servicePrefix && !servicePrefix.startsWith('/')) servicePrefix = '/' + servicePrefix;
        if (servicePrefix && servicePrefix.endsWith('/')) servicePrefix = servicePrefix.slice(0, -1);
        let groupPrefix = grp?.subPrefix || '';
        if (groupPrefix && !groupPrefix.startsWith('/')) groupPrefix = '/' + groupPrefix;
        if (groupPrefix && groupPrefix.endsWith('/')) groupPrefix = groupPrefix.slice(0, -1);
        let urlPath = editingRule.value.url || '';
        if (urlPath && !urlPath.startsWith('/')) urlPath = '/' + urlPath;
        targetUrl = `http://${localIp.value}:${svc.port}${servicePrefix}${groupPrefix}${urlPath}`;
      } else {
        testResult.value = 'Error: 服务未启动，请先在「服务」模块中启动该服务';
        isTesting.value = false;
        return;
      }
    }

    const method = editingRule.value.method || 'GET';
    const fetchOptions: RequestInit = { method };
    const rv = (s: string) => envManager?.resolveVariables(s) ?? s;
    targetUrl = rv(targetUrl);

    editingRule.value.headers?.forEach(h => {
      if (h.key && h.value) customHeaders[rv(h.key)] = rv(h.value);
    });

    if (method !== 'GET' && editingRule.value.body) {
      const bodyDef = editingRule.value.body;
      if (bodyDef.type === 'json' && bodyDef.raw) {
        customHeaders['Content-Type'] = 'application/json';
        fetchOptions.body = rv(bodyDef.raw);
      } else if (bodyDef.type === 'form-data' && bodyDef.formData?.length) {
        const formData = new FormData();
        bodyDef.formData.forEach(item => { if (item.key) formData.append(item.key, item.value || ''); });
        fetchOptions.body = formData;
      }
    }

    if (Object.keys(customHeaders).length > 0) fetchOptions.headers = customHeaders;

    if (editingRule.value.params?.length) {
      const url = new URL(targetUrl);
      editingRule.value.params.forEach(p => { if (p.key) url.searchParams.set(p.key, p.value || ''); });
      targetUrl = url.toString();
    }

    const startTime = Date.now();
    const res = await fetch(targetUrl, fetchOptions);
    const elapsed = Date.now() - startTime;

    const resHeaders: Record<string, string> = {};
    res.headers.forEach((v, k) => { resHeaders[k] = v; });

    testResultMeta.value = { mode, method, url: targetUrl, status: res.status, statusText: res.statusText, time: elapsed, headers: resHeaders };

    const contentType = res.headers.get('content-type') || '';
    const binaryPatterns = ['application/pdf', 'application/zip', 'application/octet-stream', 'video/', 'audio/', 'image/', 'application/vnd.openxmlformats', 'application/msword'];
    const isBinary = binaryPatterns.some(p => contentType.includes(p));

    let responseBodyForLog: string | undefined;

    if (isBinary) {
      const blob = await res.blob();
      const disposition = res.headers.get('content-disposition') || '';
      const filenameMatch = disposition.match(/filename\*?=(?:UTF-8''|"?)([^";]+)/i);
      const urlFilename = targetUrl.split('/').pop()?.split('?')[0] || 'download';
      const filename = filenameMatch ? decodeURIComponent(filenameMatch[1]) : urlFilename;
      testResultFile.value = { filename, size: blob.size, contentType, blobUrl: URL.createObjectURL(blob) };
      responseBodyForLog = `[Binary: ${filename}, ${blob.size} bytes]`;
    } else {
      const text = await res.text();
      responseBodyForLog = text;
      try { testResult.value = JSON.stringify(JSON.parse(text), null, 2); } catch { testResult.value = text; }
    }

    const ctx = currentRuleId.value ? findRuleContext(currentRuleId.value) : null;
    addLog({
      timestamp: Date.now(), method: method as any, url: targetUrl, status: res.status, statusText: res.statusText,
      duration: elapsed, mode, ruleId: currentRuleId.value ?? undefined,
      ruleName: ctx?.rule?.name || ctx?.rule?.url,
      groupName: ctx?.group?.name,
      serviceName: ctx?.service?.name,
      requestHeaders: customHeaders,
      requestBody: fetchOptions.body ? String(fetchOptions.body) : undefined,
      responseHeaders: resHeaders, responseBody: responseBodyForLog,
    });

  } catch (e: any) {
    testResult.value = `Error: ${e.message}`;
    const ctx = currentRuleId.value ? findRuleContext(currentRuleId.value) : null;
    addLog({
      timestamp: Date.now(), method: editingRule.value.method || 'GET', url: targetUrl,
      status: 0, statusText: 'Error', duration: 0, mode,
      ruleId: currentRuleId.value ?? undefined,
      ruleName: ctx?.rule?.name || ctx?.rule?.url,
      groupName: ctx?.group?.name,
      serviceName: ctx?.service?.name,
      requestHeaders: customHeaders, error: e.message,
    });
  }
  isTesting.value = false;
  cacheCurrentResult();
};

// --- 侧边栏拖拽调整宽度 ---

const sidebarWidth = ref(240);
const SIDEBAR_MIN = 160;
const SIDEBAR_MAX = 400;
const isDragging = ref(false);

function onDragStart(e: MouseEvent) {
  e.preventDefault();
  isDragging.value = true;
  const startX = e.clientX;
  const startWidth = sidebarWidth.value;
  const onMouseMove = (ev: MouseEvent) => {
    const delta = ev.clientX - startX;
    sidebarWidth.value = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, startWidth + delta));
  };
  const onMouseUp = () => {
    isDragging.value = false;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  };
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
}

onMounted(() => {
  if (window.services) {
    localIp.value = window.services.getLocalIP();
    API_BASE.value = window.services.getServerUrl();
  }
  loadTestCache();
  loadData();
  loadProjects();
  syncStatus();
  document.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
});
</script>

<template>
  <div class="api-panel" :class="{ 'is-dragging': isDragging }">
    <div class="sidebar-wrapper" :style="{ width: sidebarWidth + 'px' }">
      <GroupSidebar
          ref="sidebarRef"
          :services="services"
          :currentRuleId="currentRuleId"
          :projects="projects"
          :currentProjectId="currentProjectId"
          :serviceStatusMap="serviceStatusMap"
          @project-change="handleProjectChange"
          @group-add="handleAddGroup"
          @group-rename="handleRenameGroup"
          @group-delete="handleDeleteGroup"
          @rule-add="handleAddRule"
          @rule-select="handleSelectRule"
          @rule-toggle="handleToggleRule"
          @rule-delete="handleDeleteRule"
          @rule-copy="handleCopyRule"
          @rule-move="handleMoveRule"
          @rule-reorder="handleReorderRule"
          @rule-clone="handleCloneRule"
          @curl-import="handleCurlImport"
          @batch-action="handleBatchAction"
      />
      <div class="resize-handle" @mousedown="onDragStart"></div>
    </div>

    <div class="main-content">
      <RuleEditor
          v-if="currentRuleId"
          v-model="editingRule"
          :testResult="testResult"
          :testResultFile="testResultFile"
          :testResultMeta="testResultMeta"
          :hasSelection="true"
          :service="currentServiceForRule"
          :group="currentGroupForRule"
          :localIp="localIp"
          :groupName="currentBreadcrumb"
          :isTesting="isTesting"
          @save="handleSaveRule"
          @copy="handleCopyCurrentUrl"
          @test="handleRunTest"
          @save-testcase="handleSaveTestCase"
      />
      <div v-else class="empty-container">
        <el-empty :description="services.length ? '从左侧选择一个接口开始编辑' : '请先在「服务」模块中创建服务和分组'" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.api-panel {
  display: flex;
  height: 100%;
  overflow: hidden;
}

.api-panel.is-dragging {
  user-select: none;
  cursor: col-resize;
}

.sidebar-wrapper {
  position: relative;
  flex-shrink: 0;
  display: flex;
  height: 100%;
}

.resize-handle {
  position: absolute;
  right: -3px;
  top: 0;
  width: 6px;
  height: 100%;
  cursor: col-resize;
  z-index: 10;
  transition: background-color 0.2s;
}
.resize-handle:hover,
.api-panel.is-dragging .resize-handle {
  background-color: var(--primary-color);
  opacity: 0.4;
}

.main-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.empty-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  background: var(--bg-card);
}
</style>
