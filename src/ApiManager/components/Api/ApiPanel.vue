/**
 * ApiPanel.vue - 接口管理主面板组件
 *
 * 整个接口管理功能的核心容器，负责组合以下子组件：
 * - GroupSidebar：分组侧边栏，展示分组与接口树形结构
 * - ServiceConfigPanel：服务配置面板，管理分组级别的服务设置
 * - RuleEditor：接口编辑器，编辑单个接口的请求/响应规则
 *
 * 主要功能：
 * 1. 分组和接口的 CRUD 操作（通过 REST API 与后端交互）
 * 2. 测试结果缓存机制（localStorage 持久化 + 内存 blobUrl 缓存）
 * 3. 接口调试：支持 Mock 请求和真实接口请求两种模式
 * 4. 请求构建：支持自定义 Headers、Query 参数、Body（JSON / FormData）
 * 5. 响应处理：区分文本响应和二进制文件响应
 * 6. 复制接口完整 URL 功能
 */
<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, reactive, inject } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import GroupSidebar from './GroupSidebar.vue';
import RuleEditor from './RuleEditor.vue';
import ServiceConfigPanel from './ServiceConfig.vue';
import type { MockGroup, MockRule, TestResultFile, TestResultMeta, Project, HttpMethod } from '@/types/mock';
import { parseCurl } from '@/utils/curlParser';
import { settingsKey } from '@/composables/useSettings';
import { useRequestLogs } from '@/composables/useRequestLogs';
import { environmentsKey } from '@/composables/useEnvironments';

const appSettings = inject(settingsKey, null);
const { addLog } = useRequestLogs();
const envManager = inject(environmentsKey, null);

/** 本机 IP 地址，用于拼接接口完整 URL */
const localIp = ref('localhost');
/** 管理后端 API 基础地址，组件挂载时从 window.services 获取 */
const API_BASE = ref('http://localhost:3000'); // 默认值
/** 分组数据列表，包含所有分组及其下属接口规则 */
const groups = ref<MockGroup[]>([]);

// --- 项目选择 ---

const PROJECT_STORAGE_KEY = 'mock-api-current-project';
/** 项目列表 */
const projects = ref<Project[]>([]);
/** 当前选中的项目 ID，null 表示"全部项目" */
const currentProjectId = ref<number | null>((() => {
  try {
    const raw = localStorage.getItem(PROJECT_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
})());

/** 加载项目列表 */
const loadProjects = async () => {
  try {
    const res = await fetch(`${API_BASE.value}/_admin/projects`);
    if (!res.ok) throw new Error();
    projects.value = await res.json();
  } catch {}
};

/** 切换项目时持久化并清空当前选中接口 */
const handleProjectChange = (val: number | null) => {
  currentProjectId.value = val;
  currentRuleId.value = null;
  configGroupId.value = null;
  editingRule.value = {};
  try {
    if (val === null) localStorage.removeItem(PROJECT_STORAGE_KEY);
    else localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(val));
  } catch {}
};

// --- 视图状态 ---

/** 当前选中的接口规则 ID，null 表示未选中任何接口 */
const currentRuleId = ref<number | null>(null);
/** 当前正在配置的分组 ID，非 null 时显示服务配置面板 */
const configGroupId = ref<number | null>(null);
/** 当前编辑中的接口数据（深拷贝，避免直接修改原始数据） */
const editingRule = ref<Partial<MockRule>>({});
/** 测试结果文本内容（文本类型响应） */
const testResult = ref<string>('');
/** 测试结果文件信息（二进制类型响应，如 PDF、图片等） */
const testResultFile = ref<TestResultFile | null>(null);
/** 测试结果元信息（状态码、耗时、响应头等） */
const testResultMeta = ref<TestResultMeta | null>(null);

// --- 测试结果缓存（按接口 ID 存储，持久化到 localStorage）---

/** localStorage 中缓存测试结果的键名 */
const TEST_CACHE_KEY = 'mock-api-test-results';
/**
 * 测试结果缓存对象（响应式），以接口 ID 为键
 * 存储文本结果、元信息和文件信息（不含 blobUrl）
 */
const testCache = reactive<Record<number, { result: string; meta: TestResultMeta | null; file: Omit<TestResultFile, 'blobUrl'> | null }>>({});
/** 内存中的 blobUrl 缓存（Blob URL 无法序列化，不可持久化到 localStorage） */
const blobCache = new Map<number, string>();

/**
 * 从 localStorage 加载测试结果缓存
 * 在组件挂载时调用，恢复上次的测试结果
 */
const loadTestCache = () => {
  try {
    const raw = localStorage.getItem(TEST_CACHE_KEY);
    if (raw) Object.assign(testCache, JSON.parse(raw));
  } catch {}
};

/**
 * 将测试结果持久化到 localStorage
 * 每次缓存更新后调用
 */
const saveTestCache = () => {
  try { localStorage.setItem(TEST_CACHE_KEY, JSON.stringify(testCache)); } catch {}
};

/**
 * 缓存当前选中接口的测试结果
 * 将文本结果、元信息、文件信息写入 testCache，blobUrl 写入 blobCache
 */
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

/**
 * 恢复指定接口的缓存测试结果
 * 切换接口时调用，从缓存中还原之前的测试结果
 * @param ruleId - 要恢复缓存的接口 ID
 */
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

// --- 数据加载与保存 ---

/**
 * 从后端加载所有分组和接口数据
 * 请求 /_admin/rules 接口获取完整的分组列表
 */
const loadData = async () => { try { const res = await fetch(`${API_BASE.value}/_admin/rules`); if (!res.ok) throw new Error(); const data = (await res.json()) as MockGroup[]; groups.value = Array.isArray(data) ? data : []; } catch (e) { console.error(e); ElMessage.error('无法连接 Mock 服务器'); } };
/**
 * 将当前分组和接口数据保存到后端
 * 通过 POST /_admin/rules 接口将完整数据提交到服务器
 */
const saveData = async () => { try { await fetch(`${API_BASE.value}/_admin/rules`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(groups.value) }); } catch (e) { ElMessage.error('保存失败'); } };

// --- 分组操作逻辑 ---

/** 新建分组：弹出输入框，输入名称后添加到分组列表，自动关联当前项目 */
const handleAddGroup = () => { ElMessageBox.prompt('请输入分组名称', '新建分组').then(({ value }: any) => { if (!value) return; groups.value.push({ id: Date.now(), name: value, projectId: currentProjectId.value ?? undefined, children: [] }); saveData(); }).catch(() => {}); };
/** 重命名分组：弹出输入框，修改分组名称和描述后保存 */
const handleRenameGroup = (group: MockGroup) => {
  ElMessageBox({
    title: '编辑分组',
    message: `
      <div style="margin-bottom:12px">
        <label style="display:block;margin-bottom:4px;font-size:13px">分组名称</label>
        <input id="__group_name" value="${group.name}" style="width:100%;padding:6px 8px;border:1px solid #dcdfe6;border-radius:4px;box-sizing:border-box" />
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
        const descEl = document.getElementById('__group_desc') as HTMLInputElement;
        const name = nameEl?.value?.trim();
        if (name) {
          group.name = name;
          group.description = descEl?.value?.trim() || undefined;
          saveData();
        }
      }
      done();
    }
  }).catch(() => {});
};
/** 删除分组：确认后删除分组及其下所有接口，若当前选中接口在该分组内则清空选中状态 */
const handleDeleteGroup = (idx: number) => {
  const group = groups.value[idx];
  const count = group?.children?.length || 0;
  const msg = count > 0
    ? `确定删除分组「${group.name}」及其下的 ${count} 个接口吗？`
    : `确定删除空分组「${group.name}」吗？`;
  ElMessageBox.confirm(msg, '警告', { type: 'warning' }).then(() => {
    if (group.children.some(r => r.id === currentRuleId.value)) { currentRuleId.value = null; editingRule.value = {}; }
    groups.value.splice(idx, 1);
    saveData();
  }).catch(() => {});
};
/** 进入分组配置：设置 configGroupId 以显示服务配置面板 */
const handleGroupConfig = (group: MockGroup) => { configGroupId.value = group.id; currentRuleId.value = null; };

// --- 接口操作逻辑 ---

/**
 * 新建接口规则
 * 创建一个带有默认配置的新接口，添加到指定分组并自动选中
 * @param group - 目标分组
 */
const handleAddRule = (group: MockGroup) => {
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
  group.children.push(newRule);
  handleSelectRule(newRule);
  saveData();
};

/**
 * 选中接口规则
 * 深拷贝规则数据到编辑区，并恢复该接口的缓存测试结果
 * @param rule - 被选中的接口规则
 */
const handleSelectRule = (rule: MockRule) => {
  currentRuleId.value = rule.id;
  configGroupId.value = null;
  editingRule.value = JSON.parse(JSON.stringify(rule));
  restoreCachedResult(rule.id);
};

/** 切换接口启用/禁用状态后保存数据 */
const handleToggleRule = () => { saveData(); };

/**
 * 保存当前编辑中的接口规则
 * 将编辑区的数据合并回原始分组数据中，并提交到后端
 */
const handleSaveRule = () => {
  if (editingRule.value.url && !editingRule.value.url.startsWith('/')) {
    editingRule.value.url = '/' + editingRule.value.url;
  }
  editingRule.value.updatedAt = Date.now();
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

/**
 * 删除接口规则
 * 确认后从分组中移除接口，若删除的是当前选中接口则清空编辑器
 * @param group - 接口所属分组
 * @param rule - 要删除的接口规则
 */
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

/**
 * 复制当前编辑器中接口的完整 URL 到剪贴板
 * URL 格式：http://{localIp}:{port}{prefix}{path}
 */
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

/**
 * 更新分组数据
 * 由 ServiceConfigPanel 子组件触发，将修改后的分组数据同步回列表
 * @param updatedGroup - 更新后的分组对象
 */
const handleUpdateGroup = (updatedGroup: MockGroup) => {
  const idx = groups.value.findIndex(g => g.id === updatedGroup.id);
  if (idx !== -1) groups.value[idx] = updatedGroup;
};

// --- 接口复制/移动/排序 ---

/** 复制接口到目标分组 */
const handleCopyRule = (rule: MockRule, targetGroupId: number) => {
  const targetGroup = groups.value.find(g => g.id === targetGroupId);
  if (!targetGroup) return;
  const now = Date.now();
  const copied: MockRule = { ...JSON.parse(JSON.stringify(rule)), id: now, createdAt: now, updatedAt: now };
  targetGroup.children.push(copied);
  saveData();
  ElMessage.success(`已复制到「${targetGroup.name}」`);
};

/** 移动接口到目标分组 */
const handleMoveRule = (rule: MockRule, sourceGroup: MockGroup, targetGroupId: number) => {
  const targetGroup = groups.value.find(g => g.id === targetGroupId);
  const srcGroup = groups.value.find(g => g.id === sourceGroup.id);
  if (!targetGroup || !srcGroup) return;
  const idx = srcGroup.children.findIndex(r => r.id === rule.id);
  if (idx === -1) return;
  const [moved] = srcGroup.children.splice(idx, 1);
  targetGroup.children.push(moved);
  if (currentRuleId.value === rule.id) {
    currentRuleId.value = null;
    editingRule.value = {};
  }
  saveData();
  ElMessage.success(`已移动到「${targetGroup.name}」`);
};

/** 拖拽排序接口 */
const handleReorderRule = (group: MockGroup, fromIdx: number, toIdx: number) => {
  const realGroup = groups.value.find(g => g.id === group.id);
  if (!realGroup) return;
  const [item] = realGroup.children.splice(fromIdx, 1);
  realGroup.children.splice(toIdx, 0, item);
  saveData();
};

/** 克隆接口（在同一分组内创建副本） */
const handleCloneRule = (rule: MockRule, group: MockGroup) => {
  const realGroup = groups.value.find(g => g.id === group.id);
  if (!realGroup) return;
  const now = Date.now();
  const cloned: MockRule = {
    ...JSON.parse(JSON.stringify(rule)),
    id: now,
    name: (rule.name || rule.url) + ' (副本)',
    createdAt: now,
    updatedAt: now,
  };
  // 插入到原规则后方
  const idx = realGroup.children.findIndex(r => r.id === rule.id);
  realGroup.children.splice(idx + 1, 0, cloned);
  handleSelectRule(cloned);
  saveData();
  ElMessage.success('接口已复制');
};

/** 从 cURL 导入接口 */
const handleCurlImport = (group: MockGroup) => {
  const curlText = sidebarRef.value?.curlImportText;
  if (!curlText) return;
  const parsed = parseCurl(curlText);
  if (!parsed) {
    ElMessage.error('无法解析 cURL 命令');
    return;
  }

  const realGroup = groups.value.find(g => g.id === group.id);
  if (!realGroup) return;

  // 从 URL 提取路径
  let urlPath = parsed.url;
  try {
    const urlObj = new URL(parsed.url);
    urlPath = urlObj.pathname + urlObj.search;
  } catch {
    // 如果不是完整 URL，保持原样
  }

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
    body: {
      type: parsed.body ? 'json' : 'none',
      raw: parsed.body || '',
      formData: [],
    },
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
  // 填充 groupId
  const group = groups.value.find(g => g.children.some(r => r.id === currentRuleId.value));
  if (group) testcase.groupId = group.id;

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
      groups.value.forEach(g => g.children.forEach(r => {
        if (idSet.has(r.id)) r.active = true;
      }));
      saveData();
      ElMessage.success(`已启用 ${ruleIds.length} 个接口`);
      break;
    case 'disable':
      groups.value.forEach(g => g.children.forEach(r => {
        if (idSet.has(r.id)) r.active = false;
      }));
      saveData();
      ElMessage.success(`已禁用 ${ruleIds.length} 个接口`);
      break;
    case 'delete':
      ElMessageBox.confirm(`确定批量删除 ${ruleIds.length} 个接口吗？`, '批量删除', { type: 'warning' }).then(() => {
        groups.value.forEach(g => {
          g.children = g.children.filter(r => !idSet.has(r.id));
        });
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

/**
 * 计算属性：当前选中接口所属分组的服务配置
 * 用于传递给 RuleEditor，让编辑器感知分组级别的配置（如端口、前缀等）
 */
// 当前规则所属分组的配置
const currentGroupConfig = computed(() => {
  const group = groups.value.find(g => g.children.some(r => r.id === currentRuleId.value));
  return group?.config;
});

/** 当前选中接口所属分组名称（面包屑用） */
const currentGroupName = computed(() => {
  const group = groups.value.find(g => g.children.some(r => r.id === currentRuleId.value));
  return group?.name || '';
});

/** 是否正在请求中 */
const isTesting = ref(false);

/**
 * 构建真实接口的完整 URL
 * 优先使用接口级别的 realConfig 配置，缺省时回退到分组级别的配置
 * URL 格式：{protocol}://{host}:{port}{prefix}{path}
 * @returns 拼接后的完整 URL，若未配置 host 则返回空字符串
 */
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

/**
 * 执行接口调试请求
 * 支持两种模式：
 * - mock：请求本地 Mock 服务，使用分组配置的端口和前缀
 * - real：请求真实后端接口，从 realConfig 构建 URL
 *
 * 请求流程：
 * 1. 根据模式构建目标 URL
 * 2. 组装请求选项（method、headers、body、query 参数）
 * 3. 发送 fetch 请求并计时
 * 4. 根据响应 Content-Type 区分文本/二进制处理
 * 5. 缓存测试结果
 *
 * @param mode - 请求模式，'mock' 或 'real'，默认 'mock'
 */
// ... runTest 支持 mock 和 real 两种模式 ...
const handleRunTest = async (mode: 'mock' | 'real' = 'mock') => {
  isTesting.value = true;
  testResult.value = '';
  testResultFile.value = null;
  testResultMeta.value = null;

  let targetUrl = '';
  const customHeaders: Record<string, string> = {};

  try {
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

    // 环境变量替换函数
    const rv = (s: string) => envManager?.resolveVariables(s) ?? s;

    // 对 URL 进行环境变量替换
    targetUrl = rv(targetUrl);

    // 添加自定义请求头
    editingRule.value.headers?.forEach(h => {
      if (h.key && h.value) customHeaders[rv(h.key)] = rv(h.value);
    });

    // 添加请求体
    if (method !== 'GET' && editingRule.value.body) {
      const bodyDef = editingRule.value.body;
      if (bodyDef.type === 'json' && bodyDef.raw) {
        customHeaders['Content-Type'] = 'application/json';
        fetchOptions.body = rv(bodyDef.raw);
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

    let responseBodyForLog: string | undefined;

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
      responseBodyForLog = `[Binary: ${filename}, ${blob.size} bytes]`;
    } else {
      const text = await res.text();
      responseBodyForLog = text;
      try {
        testResult.value = JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        testResult.value = text;
      }
    }

    // 记录成功日志
    const group = groups.value.find(g => g.children.some(r => r.id === currentRuleId.value));
    const rule = group?.children.find(r => r.id === currentRuleId.value);
    addLog({
      timestamp: Date.now(),
      method: method as any,
      url: targetUrl,
      status: res.status,
      statusText: res.statusText,
      duration: elapsed,
      mode,
      ruleId: currentRuleId.value ?? undefined,
      ruleName: rule?.name || rule?.url,
      groupName: group?.name,
      requestHeaders: customHeaders,
      requestBody: fetchOptions.body ? String(fetchOptions.body) : undefined,
      responseHeaders: resHeaders,
      responseBody: responseBodyForLog,
    });

  } catch (e: any) {
    testResult.value = `Error: ${e.message}`;
    // 记录失败日志
    const group = groups.value.find(g => g.children.some(r => r.id === currentRuleId.value));
    const rule = group?.children.find(r => r.id === currentRuleId.value);
    addLog({
      timestamp: Date.now(),
      method: editingRule.value.method || 'GET',
      url: targetUrl,
      status: 0,
      statusText: 'Error',
      duration: 0,
      mode,
      ruleId: currentRuleId.value ?? undefined,
      ruleName: rule?.name || rule?.url,
      groupName: group?.name,
      requestHeaders: customHeaders,
      error: e.message,
    });
  }
  isTesting.value = false;
  cacheCurrentResult();
};

// --- 侧边栏拖拽调整宽度 ---

/** 侧边栏宽度（像素），默认 220px */
const sidebarWidth = ref(220);
/** 侧边栏最小宽度 */
const SIDEBAR_MIN = 160;
/** 侧边栏最大宽度 */
const SIDEBAR_MAX = 400;
/** 是否正在拖拽 */
const isDragging = ref(false);

/**
 * 拖拽开始：记录初始位置，绑定 mousemove/mouseup 事件
 */
function onDragStart(e: MouseEvent) {
  e.preventDefault();
  isDragging.value = true;
  const startX = e.clientX;
  const startWidth = sidebarWidth.value;

  const onMouseMove = (ev: MouseEvent) => {
    const delta = ev.clientX - startX;
    const newWidth = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, startWidth + delta));
    sidebarWidth.value = newWidth;
  };

  const onMouseUp = () => {
    isDragging.value = false;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  };

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
}

/**
 * 组件挂载生命周期
 * 1. 从 window.services 获取本机 IP 和服务器地址
 * 2. 加载测试结果缓存
 * 3. 从后端加载分组和接口数据
 */
onMounted(() => {
  if (window.services) {
    localIp.value = window.services.getLocalIP();
    API_BASE.value = window.services.getServerUrl();
  }
  loadTestCache();
  loadData();
  loadProjects();
  document.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
});
</script>

<template>
  <!-- 主面板容器：全高布局 -->
  <div class="api-panel" :class="{ 'is-dragging': isDragging }">
    <!-- 左侧：分组侧边栏，宽度可拖拽调整 -->
    <div class="sidebar-wrapper" :style="{ width: sidebarWidth + 'px' }">
      <GroupSidebar
          ref="sidebarRef"
          :groups="groups"
          :currentRuleId="currentRuleId"
          :projects="projects"
          :currentProjectId="currentProjectId"
          @project-change="handleProjectChange"
          @group-add="handleAddGroup"
          @group-rename="handleRenameGroup"
          @group-delete="handleDeleteGroup"
          @group-config="handleGroupConfig"
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
      <!-- 拖拽分隔条 -->
      <div class="resize-handle" @mousedown="onDragStart"></div>
    </div>

    <!-- 右侧内容区域：根据状态显示不同面板 -->
    <div class="main-content">
      <!-- 服务配置面板：当选中分组配置时显示 -->
      <ServiceConfigPanel
          v-if="configGroupId"
          :group="groups.find(g => g.id === configGroupId)!"
          @update:group="handleUpdateGroup"
          @save="saveData"
      />

      <!-- 接口编辑器：当选中具体接口时显示 -->
      <RuleEditor
          v-else-if="currentRuleId"
          v-model="editingRule"
          :testResult="testResult"
          :testResultFile="testResultFile"
          :testResultMeta="testResultMeta"
          :hasSelection="true"
          :groupConfig="currentGroupConfig"
          :localIp="localIp"
          :groupName="currentGroupName"
          :isTesting="isTesting"
          @save="handleSaveRule"
          @copy="handleCopyCurrentUrl"
          @test="handleRunTest"
          @save-testcase="handleSaveTestCase"
      />

      <!-- 空状态提示：未选中任何接口或分组配置时显示 -->
      <div v-else class="empty-container">
        <el-empty :description="groups.length ? '从左侧选择一个接口开始编辑，或点击分组的 ⚙ 配置服务' : '点击左上角 + 创建第一个分组'" />
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

/* 拖拽时禁用文本选择和 iframe 指针事件 */
.api-panel.is-dragging {
  user-select: none;
  cursor: col-resize;
}

/* 侧边栏容器：包含 GroupSidebar + 拖拽条 */
.sidebar-wrapper {
  position: relative;
  flex-shrink: 0;
  display: flex;
  height: 100%;
}

/* 拖拽分隔条 */
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

/* 右侧主内容区 */
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