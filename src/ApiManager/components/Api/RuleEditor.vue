/**
 * RuleEditor.vue - 接口规则编辑器组件
 *
 * 接口管理中最核心、最复杂的编辑组件，承载了接口定义、响应数据配置、接口调试三大功能。
 *
 * 功能分三个主 Tab：
 *   Tab 1 - 接口定义：Mock 地址 / 真实接口地址 / 请求头 / 请求参数 / 请求体 / 响应头
 *   Tab 2 - 响应数据：基础模式（文本/文件）/ 高级模式（JS 脚本）/ 模板管理
 *   Tab 3 - 接口调试：发送请求、查看响应元信息、下载文件、展示响应数据
 *
 * 通过 v-model 双向绑定 MockRule 数据，与父组件 ApiPanel 协作完成接口的编辑与保存。
 */
<script setup lang="ts">
import { computed, inject, ref, watch, onMounted } from 'vue';
import { Check, VideoPlay, CopyDocument, Plus, Delete, Document, ArrowDown, ArrowRight, FolderOpened, Close, Download, DocumentCopy, MagicStick, Warning, CircleCheckFilled, CircleCloseFilled } from '@element-plus/icons-vue';
import type { MockRule, KeyValueItem, MockTemplate, MockService, MockServiceGroup, TestResultFile, TestResultMeta, MockExpectation, ExpectationCondition, ConditionSource, ConditionOperator, ResponseAssertion, AssertionTarget, AssertionResult } from '@/types/mock';
import CodeEditor from '@/ApiManager/components/CodeEditor.vue'; // 引入 CodeMirror 封装组件
import { ElMessage, ElMessageBox } from 'element-plus';
import { generateDataTemplate, buildAdvancedTemplate, detectInputType, extractTsInterfaceNames } from '@/utils/generateDataTemplate';

/**
 * 组件 Props 定义
 * @property {Partial<MockRule>} modelValue - 当前编辑的接口规则数据（v-model 双向绑定）
 * @property {string} testResult - 接口调试的文本响应结果
 * @property {TestResultFile | null} testResultFile - 接口调试的文件响应结果（二进制类型时使用）
 * @property {TestResultMeta | null} testResultMeta - 接口调试的请求元信息（状态码、耗时、响应头等）
 * @property {boolean} hasSelection - 是否已选中某个接口（未选中时显示空状态）
 * @property {MockService} service - 所属服务配置（端口、前缀、真实接口地址等）
 * @property {MockServiceGroup} group - 所属分组（子前缀等）
 * @property {string} localIp - 本机 IP 地址，用于拼接 Mock 地址
 */
const props = defineProps<{
  modelValue: Partial<MockRule>;
  testResult: string;
  testResultFile?: TestResultFile | null;
  testResultMeta?: TestResultMeta | null;
  hasSelection: boolean;
  service?: MockService | null;
  group?: MockServiceGroup | null;
  localIp?: string;
  groupName?: string;       // 所属分组名称（面包屑用）
  isTesting?: boolean;      // 是否正在请求中
}>();

/**
 * 组件事件定义
 * @event update:modelValue - 规则数据变更时触发（v-model 机制）
 * @event save - 用户点击保存按钮时触发
 * @event copy - 用户点击复制 Mock 地址按钮时触发
 * @event test - 用户点击发送请求按钮时触发，参数为 'mock' 或 'real'
 */
const emit = defineEmits<{
  (e: 'update:modelValue', val: Partial<MockRule>): void;
  (e: 'save'): void;
  (e: 'copy'): void;
  (e: 'test', mode: 'mock' | 'real'): void;
  (e: 'save-testcase', testcase: any): void;
}>();

// 【关键】注入全局的深色模式状态 (由 index.vue 提供)
const isDark = inject('isDark', ref(false));

/** 保存按钮反馈状态 */
const saveSuccess = ref(false);
const handleSave = () => {
  if (!rule.value.url?.trim()) {
    ElMessage.warning('请输入接口路径');
    return;
  }
  emit('save');
  saveSuccess.value = true;
  setTimeout(() => { saveSuccess.value = false; }, 2000);
};

/** 顶级 Tab 当前激活项：'interface' | 'response' | 'logs' */
// 顶级 Tab：接口 | 响应数据 | 请求日志
const mainTab = ref('interface');
/** 接口定义面板内的子 Tab：'req-header' | 'req-query' | 'req-body' | 'res-header' */
// 接口定义子 Tab
const interfaceTab = ref('req-header');
/** 调试面板中请求元信息区域是否展开 */
// 请求详情是否展开
const showMeta = ref(false);
/** 是否展开真实地址的详细配置（协议/主机/端口/前缀） */
const showRealDetail = ref(false);

/**
 * 接口规则数据的双向绑定代理
 * 通过 computed 的 get/set 实现 v-model 语义，读取时返回 props，写入时触发 update 事件
 */
const rule = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
});

// --- 新增：类型安全的计算属性代理 ---
// 以下三个 computed 为 CodeEditor 组件提供类型安全的 v-model 绑定，
// 避免 undefined 导致编辑器报错

/**
 * 基础模式响应数据的代码代理
 * 将 rule.responseBasic（可能为 undefined）安全地转为 string
 */
// 1. 基础模式代码代理
const responseBasicCode = computed({
  get: () => rule.value.responseBasic ?? '', // 如果是 undefined，返回空字符串
  set: (val: string) => {
    rule.value.responseBasic = val;
  }
});

/**
 * 高级模式响应数据的代码代理
 * 将 rule.responseAdvanced（可能为 undefined）安全地转为 string
 */
// 2. 高级模式代码代理
const responseAdvancedCode = computed({
  get: () => rule.value.responseAdvanced ?? '',
  set: (val: string) => {
    rule.value.responseAdvanced = val;
  }
});

/**
 * 请求体 JSON 编辑器的代码代理
 * 安全访问 rule.body?.raw，防止 body 为 undefined 时报错
 */
// 3. JSON Body 代码代理 (防止 body 为 undefined 时报错)
const jsonBodyCode = computed({
  get: () => rule.value.body?.raw ?? '',
  set: (val: string) => {
    if (rule.value.body) {
      rule.value.body.raw = val;
    }
  }
});


/**
 * 高级模式的默认脚本模板
 * 当接口首次切换到高级模式时，自动填入此模板作为起始代码
 */
// 数据初始化
const advancedTemplate = `/**
 * 高级模式：支持自定义 JS 脚本返回数据
 * @param {Object} req - 请求对象 (req.query, req.body, req.headers)
 * @param {Object} Mock - Mock.js 库
 * @returns {Object | Promise} 返回 JSON 数据
 */
function main(req, Mock) {
  const { params, body } = req;

  return Mock.mock({
    code: 200,
    message: 'success',
    'data|5-10': [{
      'id|+1': 1,
      'name': '@cname',
      'age|18-60': 1
    }]
  });
}`;

/**
 * 监听 modelValue 变化，确保规则数据的各字段都已初始化
 * 当父组件切换选中接口时，自动补全缺失的字段默认值，避免模板中访问 undefined
 */
watch(() => props.modelValue, (val) => {
  if (!val) return;
  // 确保字段存在
  if (!val.headers) rule.value.headers = [];
  if (!val.params) rule.value.params = [];
  if (!val.responseHeaders) rule.value.responseHeaders = [];
  if (!val.body) rule.value.body = { type: 'none', raw: '', formData: [] };

  // 响应配置初始化
  if (!val.responseMode) rule.value.responseMode = 'basic';
  if (!val.responseType) rule.value.responseType = 'application/json';
  if (!val.realConfig) rule.value.realConfig = {};

  // 直接初始化 responseBasic (如果为空)
  if (val.responseBasic === undefined) {
    rule.value.responseBasic = '{}';
  }
  if (!val.responseAdvanced) rule.value.responseAdvanced = advancedTemplate;
}, { immediate: true, deep: true });

/**
 * 向键值对列表末尾添加一行空记录
 * @param {KeyValueItem[]} list - 目标键值对数组（headers / params / formData 等）
 */
// 通用行操作
const addRow = (list: KeyValueItem[]) => list.push({ key: '', value: '', required: false });
/**
 * 从键值对列表中移除指定索引的行
 * @param {KeyValueItem[]} list - 目标键值对数组
 * @param {number} idx - 要移除的行索引
 */
const removeRow = (list: KeyValueItem[], idx: number) => list.splice(idx, 1);

/**
 * Mock 服务的完整地址前缀
 * 根据分组配置的端口和前缀，拼接出形如 http://192.168.1.x:3888/prefix 的地址
 * 用于在 Mock 地址行的 prepend 插槽中展示
 */
// --- Mock 地址计算 ---
const mockUrlPrefix = computed(() => {
  const svc = props.service;
  const ip = props.localIp || 'localhost';
  const port = svc?.port || 3888;
  let servicePrefix = svc?.prefix || '';
  if (servicePrefix && !servicePrefix.startsWith('/')) servicePrefix = '/' + servicePrefix;
  if (servicePrefix && servicePrefix.endsWith('/')) servicePrefix = servicePrefix.slice(0, -1);
  let groupPrefix = props.group?.subPrefix || '';
  if (groupPrefix && !groupPrefix.startsWith('/')) groupPrefix = '/' + groupPrefix;
  if (groupPrefix && groupPrefix.endsWith('/')) groupPrefix = groupPrefix.slice(0, -1);
  return `http://${ip}:${port}${servicePrefix}${groupPrefix}`;
});

/**
 * Mock 服务的完整地址（前缀 + 路径）
 * 用于在地址行下方的预览文本中展示
 */
const mockUrlFull = computed(() => {
  let path = rule.value.url || '';
  if (path && !path.startsWith('/')) path = '/' + path;
  return mockUrlPrefix.value + path;
});

// --- 真实地址计算（接口级别覆盖服务配置）---
// 以下五个 computed 属性分别对应真实接口地址的各个组成部分。
// 每个字段优先读取接口级别的 realConfig，若未设置则回退到服务级别的 service 配置。
// 写入时只修改接口级别的 realConfig，不影响服务配置。

/** 真实接口协议（http / https），接口级覆盖服务配置 */
const realProtocol = computed({
  get: () => rule.value.realConfig?.protocol || props.service?.realProtocol || 'http',
  set: (v: string) => { if (rule.value.realConfig) rule.value.realConfig.protocol = v; }
});
/** 真实接口主机地址，接口级覆盖服务配置 */
const realHost = computed({
  get: () => rule.value.realConfig?.host || props.service?.realHost || '',
  set: (v: string) => { if (rule.value.realConfig) rule.value.realConfig.host = v; }
});
/** 真实接口端口号，接口级覆盖服务配置 */
const realPort = computed({
  get: () => rule.value.realConfig?.port || props.service?.realPort || '',
  set: (v: string) => { if (rule.value.realConfig) rule.value.realConfig.port = v; }
});
/** 真实接口路径前缀，接口级覆盖服务配置 */
const realPrefix = computed({
  get: () => rule.value.realConfig?.prefix ?? props.service?.realPrefix ?? '',
  set: (v: string) => { if (rule.value.realConfig) rule.value.realConfig.prefix = v; }
});
/** 真实接口路径，默认回退到 Mock 的 URL 路径 */
const realPath = computed({
  get: () => rule.value.realConfig?.path ?? rule.value.url ?? '',
  set: (v: string) => { if (rule.value.realConfig) rule.value.realConfig.path = v; }
});

/**
 * 真实接口的完整 URL
 * 将协议、主机、端口、前缀、路径拼接为完整的 URL 字符串
 * 当主机为空时返回空字符串（表示未配置真实接口）
 */
const realUrlFull = computed(() => {
  if (!realHost.value) return '';
  let url = `${realProtocol.value}://${realHost.value}`;
  if (realPort.value) url += `:${realPort.value}`;
  let prefix = realPrefix.value;
  if (prefix && !prefix.startsWith('/')) prefix = '/' + prefix;
  if (prefix && prefix.endsWith('/')) prefix = prefix.slice(0, -1);
  url += prefix;
  let path = realPath.value;
  if (path && !path.startsWith('/')) path = '/' + path;
  url += path;
  return url;
});

/**
 * 响应类型（Content-Type）选项列表
 * 按 '文本'、'文件'、'其他' 三组分类，用于响应数据面板的类型选择下拉框
 */
// 响应类型选项
const contentTypes = [
  { label: 'application/json', value: 'application/json', group: '文本' },
  { label: 'text/plain', value: 'text/plain', group: '文本' },
  { label: 'text/html', value: 'text/html', group: '文本' },
  { label: 'application/xml', value: 'application/xml', group: '文本' },
  { label: 'application/javascript', value: 'application/javascript', group: '文本' },
  { label: 'text/css', value: 'text/css', group: '文本' },
  { label: 'text/csv', value: 'text/csv', group: '文本' },
  { label: 'multipart/form-data', value: 'multipart/form-data', group: '其他' },
  { label: 'application/pdf', value: 'application/pdf', group: '文件' },
  { label: 'application/msword (Word)', value: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', group: '文件' },
  { label: 'application/zip', value: 'application/zip', group: '文件' },
  { label: 'application/octet-stream', value: 'application/octet-stream', group: '文件' },
  { label: 'video/mp4', value: 'video/mp4', group: '文件' },
];

/**
 * 二进制（文件）类型的 Content-Type 集合
 * 用于判断当前响应类型是否为文件类型，决定显示文件选择器还是代码编辑器
 */
// 二进制（文件）类型集合
const binaryTypes = new Set([
  'application/pdf', 'application/zip', 'application/octet-stream', 'video/mp4',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]);

/** 判断当前响应类型是否为文件（二进制）类型 */
// 判断当前是否为文件类型
const isBinaryType = computed(() => binaryTypes.has(rule.value.responseType || ''));

/**
 * 根据响应类型返回 CodeEditor 的语言模式
 * JSON 类型返回 'json'，其余返回 'javascript'
 */
// 根据响应类型返回编辑器语言
const editorLanguage = computed(() => {
  const type = rule.value.responseType || 'application/json';
  if (type.includes('json')) return 'json';
  return 'javascript';
});

/**
 * 从文件完整路径中提取文件名
 * 兼容 Unix（/）和 Windows（\）路径分隔符
 */
// 文件名（从路径中提取）
const selectedFileName = computed(() => {
  const filePath = rule.value.responseFile;
  if (!filePath) return '';
  return filePath.split('/').pop() || filePath.split('\\').pop() || filePath;
});

/**
 * 文件选择对话框的过滤器配置
 * 根据不同的 Content-Type 限制可选文件的扩展名
 */
// 文件选择对话框的过滤器
const fileFilters: Record<string, { name: string; extensions: string[] }[]> = {
  'application/pdf': [{ name: 'PDF 文件', extensions: ['pdf'] }],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [{ name: 'Word 文档', extensions: ['doc', 'docx'] }],
  'application/zip': [{ name: '压缩文件', extensions: ['zip', 'rar', '7z'] }],
  'video/mp4': [{ name: '视频文件', extensions: ['mp4', 'avi', 'mov', 'mkv'] }],
  'application/octet-stream': [{ name: '所有文件', extensions: ['*'] }],
};

/**
 * 打开 uTools 原生文件选择对话框，让用户选择本地文件作为响应数据
 * 根据当前响应类型自动设置文件过滤器
 */
// 选择本地文件
const handleSelectFile = () => {
  const type = rule.value.responseType || '';
  const filters = fileFilters[type] || [{ name: '所有文件', extensions: ['*'] }];
  const files = (window as any).utools.showOpenDialog({
    title: '选择响应文件',
    properties: ['openFile'],
    filters
  });
  if (!files || files.length === 0) return;
  rule.value.responseFile = files[0];
};

/** 清除已选择的响应文件路径 */
// 清除已选文件
const handleClearFile = () => {
  rule.value.responseFile = '';
};

/**
 * 下载接口调试返回的文件
 * 通过创建临时 <a> 标签触发浏览器下载，使用 Blob URL
 */
// 下载测试结果中的文件
const handleDownloadFile = () => {
  const file = props.testResultFile;
  if (!file) return;
  const a = document.createElement('a');
  a.href = file.blobUrl;
  a.download = file.filename;
  a.click();
};

/** 将真实接口的完整 URL 复制到剪贴板 */
// 复制真实地址完整 URL
const handleCopyRealUrl = () => {
  const url = realUrlFull.value;
  if (!url) { ElMessage.warning('真实地址为空'); return; }
  navigator.clipboard.writeText(url);
  ElMessage.success('已复制真实地址');
};

/** 格式化时间戳为可读字符串 */
const formatTime = (ts?: number) => {
  if (!ts) return '';
  return new Date(ts).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
};

/**
 * 从剪贴板读取 URL 并自动解析填入真实地址各字段
 * 使用 URL 构造函数解析协议、主机、端口、路径，prefix 清空让用户自行调整
 */
// 粘贴 URL 并解析填入真实地址各字段
const handlePasteRealUrl = async () => {
  try {
    const text = (await navigator.clipboard.readText()).trim();
    if (!text) { ElMessage.warning('剪贴板为空'); return; }
    const parsed = new URL(text);
    if (rule.value.realConfig) {
      rule.value.realConfig.protocol = parsed.protocol.replace(':', '');
      rule.value.realConfig.host = parsed.hostname;
      rule.value.realConfig.port = parsed.port;
      // pathname 整体放入 path，prefix 清空让用户自行调整
      rule.value.realConfig.prefix = '';
      rule.value.realConfig.path = parsed.pathname.replace(/^\//, '');
    }
    ElMessage.success('已解析并填入地址');
  } catch {
    ElMessage.error('剪贴板内容不是有效的 URL');
  }
};

// --- 模板相关逻辑 ---

/** 模板列表数据，从后端 API 加载 */
const templateList = ref<MockTemplate[]>([]);
/** 后端管理 API 的基础地址 */
const API_BASE = 'http://localhost:3000';

/**
 * 从后端加载所有模板列表
 * 在组件挂载时调用，以及保存模板后刷新
 */
const loadTemplates = async () => {
  try {
    const res = await fetch(`${API_BASE}/_admin/templates`);
    templateList.value = await res.json();
  } catch (e) { console.error('Load templates failed', e); }
};

/**
 * 当前响应模式下可用的模板列表
 * 根据 rule.responseMode（'basic' / 'advanced'）过滤匹配的模板
 */
// 过滤当前模式下的可用模板
const availableTemplates = computed(() => {
  return templateList.value.filter(t => t.mode === rule.value.responseMode);
});

/**
 * 将当前响应数据保存为模板
 * 弹出对话框让用户输入模板名称，然后调用后端 API 保存
 */
// 保存为模板
const handleSaveAsTemplate = () => {
  ElMessageBox.prompt('请输入模板名称', '存为模板', {
    confirmButtonText: '保存',
    cancelButtonText: '取消',
    inputPattern: /\S+/,
    inputErrorMessage: '名称不能为空'
  }).then(async ({ value }: any) => {
    const content = rule.value.responseMode === 'basic'
        ? rule.value.responseBasic
        : rule.value.responseAdvanced;

    const newTemplate: Partial<MockTemplate> = {
      name: value,
      mode: rule.value.responseMode,
      content: content || '',
      contentType: rule.value.responseType
    };

    try {
      await fetch(`${API_BASE}/_admin/template/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTemplate)
      });
      ElMessage.success('模板保存成功');
      loadTemplates(); // 刷新列表
    } catch (e) {
      ElMessage.error('保存失败');
    }
  }).catch(() => {});
};

/**
 * 应用选中的模板到当前接口
 * 基础模式模板会同时更新响应内容和 Content-Type，高级模式模板只更新脚本内容
 * @param {MockTemplate} tpl - 要应用的模板对象
 */
// 应用模板
const applyTemplate = (tpl: MockTemplate) => {
  if (tpl.mode === 'basic') {
    rule.value.responseBasic = tpl.content;
    if (tpl.contentType) rule.value.responseType = tpl.contentType;
  } else {
    rule.value.responseAdvanced = tpl.content;
  }
  ElMessage.success(`已应用模板: ${tpl.name}`);
};

// --- 智能生成 dataTemplate 弹窗 ---
const showGenDialog = ref(false);
const genInput = ref('');
const genPreview = ref('');
const genError = ref('');
const genDetectedType = ref<'json' | 'typescript'>('json');
const genInterfaceNames = ref<string[]>([]);
const genSelectedInterface = ref('');

/** 根据当前输入和选中的 interface 生成预览 */
function updateGenPreview() {
  const val = genInput.value;
  if (!val.trim()) {
    genPreview.value = '';
    genError.value = '';
    genInterfaceNames.value = [];
    genSelectedInterface.value = '';
    return;
  }
  try {
    genDetectedType.value = detectInputType(val);

    // 如果是 TS，提取所有可选 interface 名称
    if (genDetectedType.value === 'typescript') {
      const names = extractTsInterfaceNames(val);
      genInterfaceNames.value = names;
      // 如果当前选中的不在列表中，自动选最后一个
      if (!genSelectedInterface.value || !names.includes(genSelectedInterface.value)) {
        genSelectedInterface.value = names.length > 0 ? names[names.length - 1] : '';
      }
    } else {
      genInterfaceNames.value = [];
      genSelectedInterface.value = '';
    }

    const targetName = genDetectedType.value === 'typescript' ? genSelectedInterface.value || undefined : undefined;
    const templateBody = generateDataTemplate(val, targetName);
    genPreview.value = buildAdvancedTemplate(templateBody);
    genError.value = '';
  } catch (e: any) {
    genPreview.value = '';
    genError.value = e.message || '解析失败，请检查输入格式';
  }
}

/** 实时预览：用户输入变化时自动生成预览 */
watch(genInput, () => updateGenPreview());

/** 切换目标 interface 时重新生成 */
watch(genSelectedInterface, () => {
  if (genInput.value.trim()) updateGenPreview();
});

/** 打开智能生成弹窗 */
const handleOpenGenDialog = () => {
  genInput.value = '';
  genPreview.value = '';
  genError.value = '';
  genInterfaceNames.value = [];
  genSelectedInterface.value = '';
  showGenDialog.value = true;
};

/** 确认应用生成的 dataTemplate */
const handleApplyGenerated = () => {
  if (!genPreview.value) {
    ElMessage.warning('请先输入有效的 JSON 或 TypeScript 数据');
    return;
  }
  rule.value.responseAdvanced = genPreview.value;
  showGenDialog.value = false;
  ElMessage.success('已生成并填入 dataTemplate');
};

// --- 路径参数检测 ---
/** 从 URL 中提取路径参数名称列表（如 /users/:id -> ['id']） */
const detectedPathParams = computed(() => {
  const url = rule.value.url || '';
  const matches = url.match(/:([a-zA-Z_]\w*)/g);
  if (!matches) return [];
  return matches.map(m => m.slice(1));
});

// --- 条件响应（Mock 期望）---
/** 条件来源选项 */
const conditionSources: { label: string; value: ConditionSource }[] = [
  { label: 'Query 参数', value: 'query' },
  { label: 'Header', value: 'header' },
  { label: 'Body (JSON path)', value: 'body' },
  { label: '路径参数', value: 'pathParam' },
];
/** 条件操作符选项 */
const conditionOperators: { label: string; value: ConditionOperator }[] = [
  { label: '等于', value: 'equals' },
  { label: '包含', value: 'contains' },
  { label: '正则', value: 'regex' },
  { label: '存在', value: 'exists' },
  { label: '大于', value: 'gt' },
  { label: '小于', value: 'lt' },
];

/** 新增期望 */
const addExpectation = () => {
  if (!rule.value.expectations) rule.value.expectations = [];
  const newExp: MockExpectation = {
    id: Date.now(),
    name: `期望 ${rule.value.expectations.length + 1}`,
    conditions: [{ source: 'query', key: '', operator: 'equals', value: '' }],
    statusCode: 200,
    responseMode: 'basic',
    responseType: 'application/json',
    responseBasic: '{}',
    responseAdvanced: '',
  };
  rule.value.expectations.push(newExp);
};

/** 删除期望 */
const removeExpectation = (idx: number) => {
  rule.value.expectations?.splice(idx, 1);
};

/** 为期望添加条件 */
const addCondition = (exp: MockExpectation) => {
  exp.conditions.push({ source: 'query', key: '', operator: 'equals', value: '' });
};

/** 删除期望中的条件 */
const removeCondition = (exp: MockExpectation, idx: number) => {
  exp.conditions.splice(idx, 1);
};

// --- 响应断言 ---
/** 断言目标选项 */
const assertionTargets: { label: string; value: AssertionTarget }[] = [
  { label: '状态码', value: 'status' },
  { label: '响应体', value: 'body' },
  { label: '响应头', value: 'header' },
  { label: '响应时间', value: 'responseTime' },
];

/** 新增断言 */
const addAssertion = () => {
  if (!rule.value.assertions) rule.value.assertions = [];
  rule.value.assertions.push({
    id: Date.now(),
    target: 'status',
    operator: 'equals',
    value: '200',
  });
};

/** 删除断言 */
const removeAssertion = (idx: number) => {
  rule.value.assertions?.splice(idx, 1);
};

/** 断言执行结果 */
const assertionResults = ref<AssertionResult[]>([]);

/** 评估断言（在测试完成后由父组件触发） */
const evaluateAssertions = () => {
  if (!rule.value.assertions?.length || !props.testResultMeta) {
    assertionResults.value = [];
    return;
  }
  const meta = props.testResultMeta;
  const results: AssertionResult[] = [];

  for (const assertion of rule.value.assertions) {
    let actual = '';
    switch (assertion.target) {
      case 'status':
        actual = String(meta.status);
        break;
      case 'body':
        actual = assertion.key ? getByPath(props.testResult, assertion.key) : props.testResult;
        break;
      case 'header':
        actual = assertion.key ? (meta.headers[assertion.key.toLowerCase()] || '') : '';
        break;
      case 'responseTime':
        actual = String(meta.time);
        break;
    }

    const passed = evaluateConditionFrontend(actual, assertion.operator, assertion.value);
    results.push({
      assertion,
      passed,
      actual: String(actual),
      message: passed ? '通过' : `期望 ${assertion.operator} ${assertion.value}，实际为 ${actual}`,
    });
  }
  assertionResults.value = results;
};

/** 前端条件评估 */
function evaluateConditionFrontend(actual: string, operator: string, expected: string): boolean {
  switch (operator) {
    case 'equals': return actual === expected;
    case 'contains': return actual.includes(expected);
    case 'regex': try { return new RegExp(expected).test(actual); } catch { return false; }
    case 'exists': return actual !== '' && actual !== 'undefined' && actual !== 'null';
    case 'gt': return Number(actual) > Number(expected);
    case 'lt': return Number(actual) < Number(expected);
    default: return false;
  }
}

/** 从 JSON 字符串中按路径取值 */
function getByPath(jsonStr: string, path: string): string {
  try {
    let obj = JSON.parse(jsonStr);
    for (const key of path.split('.')) {
      if (obj == null) return '';
      obj = obj[key];
    }
    return obj == null ? '' : String(obj);
  } catch {
    return '';
  }
}

/** 保存为测试用例 */
const saveAsTestCase = () => {
  if (!rule.value.id || !rule.value.url) return;
  const testcase = {
    id: Date.now(),
    name: `${rule.value.name || rule.value.url} 测试`,
    ruleId: rule.value.id,
    groupId: 0, // 由父组件填充
    method: rule.value.method || 'GET',
    url: rule.value.url,
    headers: JSON.parse(JSON.stringify(rule.value.headers || [])),
    params: JSON.parse(JSON.stringify(rule.value.params || [])),
    body: JSON.parse(JSON.stringify(rule.value.body || { type: 'none', raw: '', formData: [] })),
    assertions: JSON.parse(JSON.stringify(rule.value.assertions || [])),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  emit('save-testcase', testcase);
};

/** 监听测试结果变化，自动执行断言 */
watch(() => props.testResultMeta, () => {
  if (props.testResultMeta) evaluateAssertions();
});

// --- URL Query 参数双向同步 ---
const urlInitialized = ref(false);
let urlSyncTimer: ReturnType<typeof setTimeout> | null = null;
// 记录从 URL 中同步过来的 key，手动添加的参数不受影响
const urlSyncedKeys = ref<Set<string>>(new Set());

watch(() => props.modelValue.id, () => {
  urlInitialized.value = false;
  urlSyncedKeys.value = new Set();
  if (urlSyncTimer) { clearTimeout(urlSyncTimer); urlSyncTimer = null; }
  setTimeout(() => { urlInitialized.value = true; }, 100);
}, { immediate: true });

watch(() => rule.value.url, () => {
  if (!urlInitialized.value) return;

  if (urlSyncTimer) clearTimeout(urlSyncTimer);
  urlSyncTimer = setTimeout(() => {
    const currentUrl = rule.value.url;
    if (!rule.value.params) rule.value.params = [];

    // 解析当前 URL 中的 query 参数
    const urlParams = new Map<string, string>();
    if (currentUrl && currentUrl.includes('?')) {
      const queryStr = currentUrl.slice(currentUrl.indexOf('?') + 1);
      for (const pair of queryStr.split('&').filter(Boolean)) {
        if (!pair.includes('=')) continue;
        const [key, ...rest] = pair.split('=');
        if (key) urlParams.set(decodeURIComponent(key), decodeURIComponent(rest.join('=')));
      }
    }

    // 删除：之前从 URL 同步的 key 但现在 URL 里已经没有了
    const prevSynced = urlSyncedKeys.value;
    rule.value.params = rule.value.params.filter(p =>
      !prevSynced.has(p.key) || urlParams.has(p.key)
    );

    // 新增或更新
    for (const [key, value] of urlParams) {
      const existing = rule.value.params.find(p => p.key === key);
      if (existing) {
        existing.value = value;
      } else {
        rule.value.params.push({ key, value, required: false });
      }
    }

    // 更新同步记录
    urlSyncedKeys.value = new Set(urlParams.keys());
  }, 600);
});

onMounted(() => {
  loadTemplates(); // 加载模板
}); // 加载模板
</script>

<template>
  <!-- 编辑器主容器 -->
  <el-main class="editor-main">
    <!-- 已选中接口时显示编辑器 -->
    <div v-if="hasSelection" class="editor-layout">

      <!-- 面包屑导航 -->
      <div v-if="groupName" class="breadcrumb">
        <span class="breadcrumb-group">{{ groupName }}</span>
        <span class="breadcrumb-sep">/</span>
        <span class="breadcrumb-rule">{{ rule.name || rule.url || '未命名接口' }}</span>
      </div>

      <!-- ==================== 顶级 Tab 导航栏 ==================== -->
      <div class="main-tabs-header">
        <div
            class="tab-item"
            :class="{ active: mainTab === 'interface' }"
            @click="mainTab = 'interface'"
        >接口定义</div>
        <div
            class="tab-item"
            :class="{ active: mainTab === 'response' }"
            @click="mainTab = 'response'"
        >响应数据</div>
        <div
            class="tab-item"
            :class="{ active: mainTab === 'logs' }"
            @click="mainTab = 'logs'"
        >接口调试</div>
      </div>

      <!-- ==================== Tab 内容区域 ==================== -->
      <div class="tab-content-area">

        <!-- ========== Tab 1: 接口定义面板 ========== -->
        <div v-show="mainTab === 'interface'" class="interface-panel">
          <!-- 接口名称 + Mock 地址区 -->
          <div class="addr-section">
            <div class="addr-row">
              <span class="addr-tag name">名称</span>
              <el-input v-model="rule.name" placeholder="接口名称（选填）" class="url-input" />
            </div>
          </div>

          <!-- Mock 地址区 -->
          <div class="addr-section">
            <div class="addr-row">
              <span class="addr-tag mock">Mock</span>
              <el-select v-model="rule.method" style="width: 90px" size="default">
                <el-option value="GET" /><el-option value="POST" /><el-option value="PUT" /><el-option value="DELETE" />
              </el-select>
              <el-input v-model="rule.url" placeholder="/api/path" class="url-input" />
              <el-button type="primary" plain :icon="CopyDocument" @click="$emit('copy')" title="复制Mock地址" />
            </div>
            <div v-if="rule.url" class="addr-url-preview" @click="$emit('copy')" title="点击复制完整地址">
              {{ mockUrlFull }}
            </div>
            <!-- 路径参数标签 -->
            <div v-if="detectedPathParams.length" class="path-params-tags">
              <span class="path-params-label">路径参数：</span>
              <el-tag v-for="p in detectedPathParams" :key="p" size="small" type="info" effect="plain">:{{ p }}</el-tag>
            </div>
          </div>

          <!-- 真实地址区 -->
          <div class="addr-section">
            <div class="addr-row">
              <span class="addr-tag real">真实</span>
              <el-input v-model="realPath" placeholder="/api/path" class="url-input" />
              <el-button plain :icon="CopyDocument" @click="handleCopyRealUrl" title="复制真实地址" />
              <el-button plain :icon="DocumentCopy" @click="handlePasteRealUrl" title="粘贴并解析URL" />
              <el-button plain @click="showRealDetail = !showRealDetail" :type="showRealDetail ? 'primary' : ''" :title="showRealDetail ? '收起地址配置' : '展开地址配置'">
                <el-icon :size="14"><component :is="showRealDetail ? ArrowDown : ArrowRight" /></el-icon>
              </el-button>
            </div>
            <div v-if="showRealDetail" class="addr-detail-row">
              <el-select v-model="realProtocol" style="width: 78px" size="small">
                <el-option label="http" value="http" />
                <el-option label="https" value="https" />
              </el-select>
              <span class="addr-sep">://</span>
              <el-input v-model="realHost" placeholder="主机地址" size="small" style="flex: 2; min-width: 80px" />
              <span class="addr-sep">:</span>
              <el-input v-model="realPort" placeholder="端口" size="small" style="width: 56px" />
              <span class="addr-sep">/</span>
              <el-input v-model="realPrefix" placeholder="前缀" size="small" style="flex: 1; min-width: 60px" />
            </div>
            <div v-if="realUrlFull" class="addr-url-preview" @click="handleCopyRealUrl" title="点击复制完整地址">
              {{ realUrlFull }}
            </div>
          </div>

          <!-- 配置行：延迟 + Mock.js 开关 -->
          <div class="config-row">
            <div class="config-item">
              <span class="config-label">延迟 (ms)：</span>
              <el-input-number v-model="rule.delay" :min="0" :max="30000" :step="100" size="small" controls-position="right" style="width: 110px" />
              <span class="config-sep">~</span>
              <el-input-number v-model="rule.delayMax" :min="0" :max="30000" :step="100" size="small" controls-position="right" style="width: 110px" placeholder="最大值" />
              <el-tooltip content="设置最大值后，延迟将在 [最小值, 最大值] 范围内随机" placement="top">
                <el-icon style="color: var(--text-secondary); cursor: help; margin-left: 2px"><Warning /></el-icon>
              </el-tooltip>
            </div>
            <div class="config-item" v-if="rule.responseMode === 'basic'">
              <el-tooltip content="启用后，基础模式的 JSON 响应将通过 Mock.js 处理，支持 @cname、@email 等语法" placement="top">
                <el-checkbox v-model="rule.mockjsEnabled" label="Mock.js 增强" size="small" border />
              </el-tooltip>
            </div>
          </div>

          <!-- 操作栏：保存按钮 + 时间信息 -->
          <div class="addr-actions">
            <div v-if="rule.createdAt || rule.updatedAt" class="time-info">
              <span v-if="rule.createdAt" title="创建时间">创建: {{ formatTime(rule.createdAt) }}</span>
              <span v-if="rule.updatedAt" title="更新时间">更新: {{ formatTime(rule.updatedAt) }}</span>
            </div>
            <el-button :type="saveSuccess ? 'info' : 'success'" :icon="Check" @click="handleSave">{{ saveSuccess ? '已保存 ✓' : '保存' }}</el-button>
          </div>

          <!-- 接口定义子 Tab：请求头 / 请求参数 / 请求体 / 响应头 -->
          <el-tabs v-model="interfaceTab" class="sub-tabs">
            <!-- 子 Tab: 请求头 -->
            <el-tab-pane label="请求头" name="req-header">
              <div class="kv-list">
                <div v-for="(item, idx) in rule.headers" :key="idx" class="kv-row">
                  <el-input v-model="item.key" placeholder="Key" />
                  <el-input v-model="item.value" placeholder="Value" />
                  <el-checkbox v-model="item.required" label="必传" border size="small" />
                  <el-button :icon="Delete" circle plain type="danger" size="small" @click="removeRow(rule.headers!, idx)" />
                </div>
                <el-button link type="primary" :icon="Plus" @click="addRow(rule.headers!)">添加 Header</el-button>
              </div>
            </el-tab-pane>

            <!-- 子 Tab: 请求参数（Query Parameters） -->
            <el-tab-pane label="请求参数" name="req-query">
              <div class="kv-list">
                <div v-for="(item, idx) in rule.params" :key="idx" class="kv-row">
                  <el-input v-model="item.key" placeholder="参数名" />
                  <el-input v-model="item.value" placeholder="示例值" />
                  <el-checkbox v-model="item.required" label="必传" border size="small" />
                  <el-button :icon="Delete" circle plain type="danger" size="small" @click="removeRow(rule.params!, idx)" />
                </div>
                <el-button link type="primary" :icon="Plus" @click="addRow(rule.params!)">添加参数</el-button>
              </div>
            </el-tab-pane>

            <!-- 子 Tab: 请求体（支持 none / json / form-data 三种类型） -->
            <el-tab-pane label="请求体" name="req-body">
              <div class="body-panel">
                <!-- 请求体类型切换 -->
                <el-radio-group v-model="rule.body!.type" size="small" style="margin-bottom: 10px">
                  <el-radio-button label="none">none</el-radio-button>
                  <el-radio-button label="json">json</el-radio-button>
                  <el-radio-button label="form-data">form-data</el-radio-button>
                </el-radio-group>

                <!-- JSON 类型：代码编辑器 -->
                <div v-if="rule.body!.type === 'json'" class="full-height">
                  <CodeEditor
                      v-model="jsonBodyCode"
                      language="json"
                      :is-dark="isDark"
                  />
                </div>

                <!-- form-data 类型：键值对列表 -->
                <div v-else-if="rule.body!.type === 'form-data'" class="kv-list">
                  <div v-for="(item, idx) in rule.body!.formData" :key="idx" class="kv-row">
                    <el-input v-model="item.key" placeholder="Key" />
                    <el-input v-model="item.value" placeholder="Value" />
                    <el-button :icon="Delete" circle plain type="danger" size="small" @click="removeRow(rule.body!.formData, idx)" />
                  </div>
                  <el-button link type="primary" :icon="Plus" @click="addRow(rule.body!.formData)">添加字段</el-button>
                </div>
                <!-- none 类型：空状态提示 -->
                <el-empty v-else description="该请求没有 Body" :image-size="60" />
              </div>
            </el-tab-pane>

            <!-- 子 Tab: 响应头 -->
            <el-tab-pane label="响应头" name="res-header">
              <div class="kv-list">
                <div v-for="(item, idx) in rule.responseHeaders" :key="idx" class="kv-row">
                  <el-input v-model="item.key" placeholder="Content-Type" />
                  <el-input v-model="item.value" placeholder="application/json" />
                  <el-button :icon="Delete" circle plain type="danger" size="small" @click="removeRow(rule.responseHeaders!, idx)" />
                </div>
                <el-button link type="primary" :icon="Plus" @click="addRow(rule.responseHeaders!)">添加响应头</el-button>
              </div>
            </el-tab-pane>

            <!-- 子 Tab: 条件响应 -->
            <el-tab-pane name="expectations">
              <template #label>
                条件响应
                <el-badge v-if="rule.expectations?.length" :value="rule.expectations.length" type="info" class="exp-badge" />
              </template>
              <div class="expectations-editor">
                <div v-for="(exp, expIdx) in rule.expectations" :key="exp.id" class="exp-card">
                  <div class="exp-header">
                    <el-input v-model="exp.name" size="small" style="width: 160px" placeholder="期望名称" />
                    <el-tag size="small" type="info">{{ exp.conditions.length }} 个条件</el-tag>
                    <div class="exp-response-config">
                      <el-select v-model="exp.statusCode" size="small" style="width: 90px">
                        <el-option :value="200" label="200" /><el-option :value="201" label="201" />
                        <el-option :value="400" label="400" /><el-option :value="401" label="401" />
                        <el-option :value="403" label="403" /><el-option :value="404" label="404" />
                        <el-option :value="500" label="500" />
                      </el-select>
                      <el-select v-model="exp.responseMode" size="small" style="width: 100px">
                        <el-option value="basic" label="基础模式" /><el-option value="advanced" label="高级模式" />
                      </el-select>
                    </div>
                    <el-button :icon="Delete" circle plain type="danger" size="small" @click="removeExpectation(expIdx)" />
                  </div>

                  <!-- 条件列表 -->
                  <div v-for="(cond, condIdx) in exp.conditions" :key="condIdx" class="cond-row">
                    <el-select v-model="cond.source" size="small" style="width: 110px">
                      <el-option v-for="s in conditionSources" :key="s.value" :label="s.label" :value="s.value" />
                    </el-select>
                    <el-input v-model="cond.key" size="small" placeholder="参数名" style="width: 120px" />
                    <el-select v-model="cond.operator" size="small" style="width: 80px">
                      <el-option v-for="op in conditionOperators" :key="op.value" :label="op.label" :value="op.value" />
                    </el-select>
                    <el-input v-model="cond.value" size="small" placeholder="值" style="flex: 1" :disabled="cond.operator === 'exists'" />
                    <el-button :icon="Delete" circle plain type="danger" size="small" @click="removeCondition(exp, condIdx)" />
                  </div>
                  <el-button link type="primary" size="small" :icon="Plus" @click="addCondition(exp)">添加条件</el-button>

                  <!-- 期望响应内容（折叠） -->
                  <div class="exp-response">
                    <el-input v-if="exp.responseMode === 'basic'" v-model="exp.responseBasic" type="textarea" :rows="3" placeholder='响应内容（JSON）' />
                    <el-input v-else v-model="exp.responseAdvanced" type="textarea" :rows="3" placeholder='高级模式脚本' />
                  </div>
                </div>

                <el-button type="primary" plain :icon="Plus" @click="addExpectation" style="margin-top: 8px">添加条件响应</el-button>
                <div v-if="!rule.expectations?.length" class="empty-tip" style="padding: 20px; text-align: center; color: var(--text-secondary); font-size: 13px">
                  暂无条件响应。添加后，当请求满足条件时将返回对应的响应数据，优先级高于默认响应和场景预设。
                </div>
              </div>
            </el-tab-pane>
          </el-tabs>
        </div>

        <!-- ========== Tab 2: 响应数据面板 ========== -->
        <div v-show="mainTab === 'response'" class="response-panel">
          <!-- 响应数据工具栏：模式切换 / 响应类型选择 / 模板操作 / 保存按钮 -->
          <div class="mode-bar">
            <!-- 基础模式 / 高级模式切换 -->
            <div class="mode-switch">
              <span class="label">模式：</span>
              <el-radio-group v-model="rule.responseMode" size="default">
                <el-radio-button label="basic">基础模式</el-radio-button>
                <el-radio-button label="advanced">高级模式</el-radio-button>
              </el-radio-group>
            </div>

            <!-- 基础模式下的响应类型（Content-Type）选择器 -->
            <div v-if="rule.responseMode === 'basic'" class="type-select">
              <span class="label">响应类型：</span>
              <el-select v-model="rule.responseType" style="width: 180px" filterable>
                <el-option-group v-for="group in ['文本', '文件', '其他']" :key="group" :label="group">
                  <el-option v-for="t in contentTypes.filter(c => c.group === group)" :key="t.value" :label="t.label" :value="t.value" />
                </el-option-group>
              </el-select>
            </div>

            <div class="template-actions">
              <el-dropdown @command="applyTemplate" trigger="click" :disabled="!availableTemplates.length">
                <el-button type="primary" plain>
                  应用模板<el-icon class="el-icon--right"><arrow-down /></el-icon>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item v-for="t in availableTemplates" :key="t.id" :command="t">
                      {{ t.name }}
                    </el-dropdown-item>
                    <el-dropdown-item v-if="!availableTemplates.length" disabled>暂无该模式模板</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>

              <el-button type="warning" plain @click="handleSaveAsTemplate">存为模板</el-button>
            </div>

            <el-button :type="saveSuccess ? 'info' : 'success'" :icon="Check" @click="handleSave">{{ saveSuccess ? '已保存 ✓' : '保存配置' }}</el-button>
          </div>

          <div class="editor-area">
            <div v-if="rule.responseMode === 'basic'" class="full-height">
              <!-- 文件类型：显示文件选择器 -->
              <div v-if="isBinaryType" class="file-picker-area">
                <div class="file-picker-content">
                  <div v-if="rule.responseFile" class="file-info">
                    <el-icon :size="40" color="#409eff"><Document /></el-icon>
                    <div class="file-detail">
                      <span class="file-name">{{ selectedFileName }}</span>
                      <span class="file-path">{{ rule.responseFile }}</span>
                    </div>
                    <el-button :icon="Close" circle plain type="danger" size="small" @click="handleClearFile" title="清除文件" />
                  </div>
                  <div v-else class="file-empty">
                    <el-icon :size="48" color="#c0c4cc"><FolderOpened /></el-icon>
                    <span>请选择本地文件作为响应数据</span>
                  </div>
                  <el-button type="primary" :icon="FolderOpened" @click="handleSelectFile">
                    {{ rule.responseFile ? '重新选择文件' : '选择文件' }}
                  </el-button>
                </div>
              </div>
              <!-- 文本类型：显示代码编辑器 -->
              <template v-else>
                <CodeEditor
                    v-model="responseBasicCode"
                    :language="editorLanguage"
                    :is-dark="isDark"
                />
              </template>
            </div>

            <div v-else class="full-height advanced-editor">
              <div class="script-hint">
                <el-icon><Document /></el-icon>
                <span>入口函数为 main(req, Mock)，支持 mockjs 语法。</span>
                <el-button type="primary" size="small" :icon="MagicStick" @click="handleOpenGenDialog" class="gen-btn">智能生成</el-button>
              </div>
              <CodeEditor
                  v-model="responseAdvancedCode"
                  language="javascript"
                  :is-dark="isDark"
              />
            </div>
          </div>
        </div>

        <div v-show="mainTab === 'logs'" class="logs-panel">
          <div class="test-panel">
            <div class="panel-header">
              <span>发送请求</span>
              <div class="test-actions">
                <el-button type="primary" size="small" :icon="VideoPlay" @click="$emit('test', 'mock')" :loading="isTesting">{{ isTesting ? '请求中...' : '请求Mock' }}</el-button>
                <el-button type="warning" size="small" :icon="VideoPlay" @click="$emit('test', 'real')" :disabled="!realUrlFull || isTesting" :loading="isTesting">{{ isTesting ? '请求中...' : '请求真实接口' }}</el-button>
                <el-button type="info" size="small" plain @click="saveAsTestCase" title="保存当前接口配置为测试用例">保存为用例</el-button>
              </div>
            </div>

            <!-- 请求元信息（可折叠） -->
            <div v-if="testResultMeta" class="meta-section">
              <div class="meta-summary" @click="showMeta = !showMeta">
                <el-icon class="meta-arrow" :class="{ expanded: showMeta }"><ArrowRight /></el-icon>
                <span class="meta-badge" :class="testResultMeta.status < 400 ? 'success' : 'error'">{{ testResultMeta.status }}</span>
                <span class="meta-method">{{ testResultMeta.method }}</span>
                <span class="meta-url">{{ testResultMeta.url }}</span>
                <span class="meta-time">{{ testResultMeta.time }}ms</span>
                <span class="meta-mode">{{ testResultMeta.mode === 'real' ? '真实接口' : 'Mock' }}</span>
              </div>
              <div v-show="showMeta" class="meta-detail">
                <div class="meta-group">
                  <div class="meta-group-title">基本信息</div>
                  <div class="meta-row"><span class="meta-key">Status</span><span>{{ testResultMeta.status }} {{ testResultMeta.statusText }}</span></div>
                  <div class="meta-row"><span class="meta-key">Method</span><span>{{ testResultMeta.method }}</span></div>
                  <div class="meta-row"><span class="meta-key">URL</span><span class="meta-val-url">{{ testResultMeta.url }}</span></div>
                  <div class="meta-row"><span class="meta-key">Time</span><span>{{ testResultMeta.time }}ms</span></div>
                </div>
                <div class="meta-group">
                  <div class="meta-group-title">响应头</div>
                  <div v-for="(v, k) in testResultMeta.headers" :key="k" class="meta-row">
                    <span class="meta-key">{{ k }}</span><span>{{ v }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- 文件下载区 -->
            <div v-if="testResultFile" class="file-download-bar">
              <el-icon :size="20" color="#409eff"><Document /></el-icon>
              <span class="file-download-name">{{ testResultFile.filename }}</span>
              <span class="file-download-size">{{ (testResultFile.size / 1024).toFixed(1) }} KB</span>
              <el-button v-if="testResultFile.blobUrl" type="primary" size="small" :icon="Download" @click="handleDownloadFile">下载文件</el-button>
              <span v-else class="file-download-hint">请重新请求以下载</span>
            </div>

            <!-- 断言区域 -->
            <div v-if="rule.assertions?.length" class="assertions-section">
              <div class="assertions-header">
                <span>响应断言</span>
                <span v-if="assertionResults.length" class="assertions-summary">
                  <span class="passed">{{ assertionResults.filter(r => r.passed).length }} 通过</span>
                  <span v-if="assertionResults.some(r => !r.passed)" class="failed">{{ assertionResults.filter(r => !r.passed).length }} 失败</span>
                </span>
              </div>
              <div v-for="(result, idx) in assertionResults" :key="idx" class="assertion-result-row" :class="{ passed: result.passed, failed: !result.passed }">
                <el-icon v-if="result.passed" color="#67C23A"><CircleCheckFilled /></el-icon>
                <el-icon v-else color="#F56C6C"><CircleCloseFilled /></el-icon>
                <span class="assertion-desc">{{ assertionTargets.find(t => t.value === result.assertion.target)?.label }}{{ result.assertion.key ? ` [${result.assertion.key}]` : '' }} {{ conditionOperators.find(o => o.value === result.assertion.operator)?.label }} {{ result.assertion.value }}</span>
                <span class="assertion-actual">实际: {{ result.actual }}</span>
              </div>
            </div>

            <!-- 断言配置 -->
            <div class="assertions-config">
              <div class="assertions-config-header">
                <span>断言规则</span>
                <el-button type="primary" plain size="small" :icon="Plus" @click="addAssertion">添加断言</el-button>
              </div>
              <div v-for="(a, idx) in rule.assertions" :key="a.id" class="assertion-row">
                <el-select v-model="a.target" size="small" style="width: 100px">
                  <el-option v-for="t in assertionTargets" :key="t.value" :label="t.label" :value="t.value" />
                </el-select>
                <el-input v-if="a.target === 'header' || a.target === 'body'" v-model="a.key" size="small" placeholder="key / path" style="width: 120px" />
                <el-select v-model="a.operator" size="small" style="width: 80px">
                  <el-option v-for="op in conditionOperators" :key="op.value" :label="op.label" :value="op.value" />
                </el-select>
                <el-input v-model="a.value" size="small" placeholder="期望值" style="flex: 1" :disabled="a.operator === 'exists'" />
                <el-button :icon="Delete" circle plain type="danger" size="small" @click="removeAssertion(idx)" />
              </div>
            </div>

            <!-- 响应数据 -->
            <div v-if="!testResultFile" class="test-result">
              <CodeEditor
                  :model-value="testResult || '暂无请求记录'"
                  language="javascript"
                  :is-dark="isDark"
                  readonly
              />
            </div>
          </div>
        </div>

      </div>
    </div>
    <el-empty v-else description="请选择接口" />

    <!-- 智能生成 dataTemplate 弹窗 -->
    <el-dialog v-model="showGenDialog" title="智能生成 dataTemplate" width="90%" top="5vh" :close-on-click-modal="false" class="gen-dialog">
      <div class="gen-dialog-body">
        <div class="gen-input-section">
          <div class="gen-section-header">
            <span class="gen-section-title">粘贴数据</span>
            <el-tag size="small" :type="genDetectedType === 'typescript' ? 'warning' : 'primary'" v-if="genInput.trim()">
              {{ genDetectedType === 'typescript' ? 'TypeScript' : 'JSON' }}
            </el-tag>
            <el-select
              v-if="genInterfaceNames.length > 1"
              v-model="genSelectedInterface"
              size="small"
              style="width: 160px; margin-left: auto"
              placeholder="选择目标接口"
            >
              <el-option v-for="n in genInterfaceNames" :key="n" :label="n" :value="n" />
            </el-select>
          </div>
          <el-input
            v-model="genInput"
            type="textarea"
            :rows="14"
            placeholder='粘贴 JSON 数据，例如：
{
  "id": 1,
  "name": "张三",
  "age": 25,
  "email": "test@example.com",
  "list": [{ "title": "标题", "price": 99.9 }]
}

或 TypeScript 接口定义：
interface User {
  id: number;
  name: string;
  age: number;
  email: string;
  list: { title: string; price: number }[];
}'
          />
          <div v-if="genError" class="gen-error">{{ genError }}</div>
        </div>
        <div class="gen-preview-section">
          <div class="gen-section-header">
            <span class="gen-section-title">生成预览</span>
          </div>
          <div class="gen-preview-editor">
            <CodeEditor
              :model-value="genPreview || '// 在左侧粘贴数据后自动生成预览...'"
              language="javascript"
              :is-dark="isDark"
              readonly
            />
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="showGenDialog = false">取消</el-button>
        <el-button type="primary" :disabled="!genPreview" @click="handleApplyGenerated">应用到编辑器</el-button>
      </template>
    </el-dialog>
  </el-main>
</template>

<style scoped>
.editor-main { padding: 0; display: flex; flex-direction: column; height: 100%; background: var(--bg-card); }
.editor-layout { display: flex; flex-direction: column; height: 100%; }

/* 顶级 Tab */
.main-tabs-header { display: flex; border-bottom: 1px solid var(--border-color); background: var(--bg-frame); }
.tab-item {
  padding: 8px 20px; cursor: pointer; font-size: 13px; font-weight: 500; color: var(--text-secondary);
  border-bottom: 2px solid transparent; transition: all 0.2s;
}
.tab-item:hover { color: var(--primary-color); }
.tab-item.active { color: var(--primary-color); border-bottom-color: var(--primary-color); background: var(--bg-card); }

.tab-content-area { flex: 1; overflow: hidden; display: flex; flex-direction: column; }
.full-height { height: 100%; display: flex; flex-direction: column; overflow: hidden; }

/* 接口面板 */
.interface-panel { display: flex; flex-direction: column; height: 100%; overflow: hidden; }

/* 地址区块：包裹输入行 + 预览行 */
.addr-section {
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-hover);
}
/* 地址输入行 */
.addr-row {
  padding: 6px 10px; display: flex; gap: 4px; align-items: center;
}
.addr-tag {
  padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; flex-shrink: 0; white-space: nowrap;
}
.addr-tag.name { background: #ecf5ff; color: #409EFF; }
.addr-tag.mock { background: #e1f3d8; color: #67C23A; }
.addr-tag.real { background: #fdf6ec; color: #E6A23C; }
/* 完整地址预览行 */
.addr-url-preview {
  padding: 0 10px 6px 20px;
  font-size: 11px;
  font-family: 'Courier New', Courier, monospace;
  color: var(--text-secondary);
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color 0.2s;
}
.addr-url-preview:hover { color: var(--primary-color); }
/* 真实地址展开配置行 */
.addr-detail-row {
  padding: 2px 10px 6px 20px;
  display: flex;
  gap: 4px;
  align-items: center;
}
.addr-sep { color: var(--text-secondary); font-size: 13px; font-family: monospace; flex-shrink: 0; }
.addr-actions { padding: 4px 10px; display: flex; justify-content: flex-end; border-bottom: 1px solid var(--border-color); background: var(--bg-hover); }
.url-input { flex: 1; }
.sub-tabs { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-height: 0; }
:deep(.el-tabs__header) { margin: 0; padding: 0 12px; }
:deep(.el-tabs__content) { flex: 1; overflow: auto; padding: 12px; }

/* Body 面板 */
.body-panel { height: 100%; display: flex; flex-direction: column; }

/* 响应面板 */
.response-panel { display: flex; flex-direction: column; height: 100%; }
.mode-bar { padding: 8px 12px; border-bottom: 1px solid var(--border-color); display: flex; align-items: center; gap: 10px; background: var(--bg-hover); flex-wrap: wrap; }
.mode-switch, .type-select { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--text-primary); }
.mode-switch .label, .type-select .label { white-space: nowrap; }
.editor-area { flex: 1; padding: 0; overflow: hidden; }

/* 高级模式容器 */
.advanced-editor { display: flex; flex-direction: column; }
.script-hint {
  padding: 6px 12px; background: #e6f7ff; color: #1890ff; font-size: 12px; display: flex; align-items: center; gap: 6px; border-bottom: 1px solid #91d5ff; flex-shrink: 0;
}
/* 文件选择器 */
.file-picker-area {
  flex: 1; display: flex; align-items: center; justify-content: center; padding: 20px;
}
.file-picker-content {
  display: flex; flex-direction: column; align-items: center; gap: 16px;
  padding: 24px; border: 2px dashed var(--border-color); border-radius: 12px;
  background: var(--bg-hover); min-width: 280px; max-width: 100%;
}
.file-info {
  display: flex; align-items: center; gap: 12px; width: 100%;
  padding: 12px 16px; background: var(--bg-card); border-radius: 8px; border: 1px solid var(--border-color);
}
.file-detail { flex: 1; display: flex; flex-direction: column; gap: 4px; overflow: hidden; }
.file-name { font-size: 15px; font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.file-path { font-size: 12px; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.file-empty { display: flex; flex-direction: column; align-items: center; gap: 8px; color: var(--text-secondary); font-size: 14px; }

/* 列表样式 */
.kv-list { display: flex; flex-direction: column; gap: 8px; }
.kv-row { display: flex; gap: 8px; align-items: center; }

/* 日志面板 */
.logs-panel { padding: 0; height: 100%; display: flex; flex-direction: column; }
.test-panel { flex: 1; display: flex; flex-direction: column; overflow: auto; }
.panel-header { padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); background: var(--bg-hover); flex-shrink: 0; position: sticky; top: 0; z-index: 1; }
.test-actions { display: flex; gap: 8px; }
.test-result { min-height: 120px; flex: 1; overflow: hidden; padding: 0; border: none; }

/* 请求元信息 */
.meta-section { flex-shrink: 0; border-bottom: 1px solid var(--border-color); }
.meta-summary {
  padding: 8px 12px; display: flex; align-items: center; gap: 8px;
  cursor: pointer; font-size: 13px; user-select: none;
  background: var(--bg-hover); transition: background 0.15s;
}
.meta-summary:hover { background: var(--bg-card); }
.meta-arrow { font-size: 12px; transition: transform 0.2s; color: var(--text-secondary); }
.meta-arrow.expanded { transform: rotate(90deg); }
.meta-badge {
  padding: 1px 8px; border-radius: 3px; font-size: 12px; font-weight: 600; font-family: monospace;
}
.meta-badge.success { background: #e1f3d8; color: #67C23A; }
.meta-badge.error { background: #fde2e2; color: #F56C6C; }
.meta-method { font-weight: 600; color: var(--text-primary); font-family: monospace; }
.meta-url { flex: 1; color: var(--text-secondary); font-family: monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.meta-time { color: #E6A23C; font-family: monospace; flex-shrink: 0; }
.meta-mode { font-size: 11px; padding: 1px 6px; border-radius: 3px; background: var(--bg-card); color: var(--text-secondary); flex-shrink: 0; }
.meta-detail { padding: 0 12px 10px; font-size: 12px; max-height: 260px; overflow: auto; }
.meta-group { margin-top: 8px; }
.meta-group-title { font-size: 12px; font-weight: 600; color: var(--text-primary); margin-bottom: 4px; padding-bottom: 4px; border-bottom: 1px solid var(--border-color); }
.meta-row { display: flex; gap: 12px; padding: 3px 0; line-height: 1.6; color: var(--text-primary); }
.meta-key { min-width: 140px; color: var(--text-secondary); font-family: monospace; flex-shrink: 0; }
.meta-val-url { word-break: break-all; font-family: monospace; }

/* 文件下载栏 */
.file-download-bar {
  padding: 10px 16px; display: flex; align-items: center; gap: 10px;
  background: #f0f9eb; border-bottom: 1px solid #e1f3d8; flex-shrink: 0;
}
.file-download-name { font-size: 14px; font-weight: 500; color: var(--text-primary); }
.file-download-size { font-size: 12px; color: var(--text-secondary); }
.file-download-hint { font-size: 12px; color: #E6A23C; font-style: italic; }

.template-actions { display: flex; gap: 8px; margin-left: auto; }

/* 时间信息 */
.time-info {
  display: flex;
  gap: 16px;
  font-size: 11px;
  color: var(--text-secondary);
  margin-right: auto;
}

/* 面包屑导航 */
.breadcrumb {
  padding: 6px 16px;
  font-size: 12px;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}
.breadcrumb-group {
  color: var(--text-secondary);
}
.breadcrumb-sep {
  color: var(--text-secondary);
  opacity: 0.5;
}
.breadcrumb-rule {
  color: var(--text-primary);
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 智能生成按钮 */
.gen-btn {
  margin-left: auto;
}

/* 智能生成弹窗 */
.gen-dialog-body {
  display: flex;
  gap: 16px;
  height: 60vh;
}
.gen-input-section,
.gen-preview-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.gen-section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.gen-section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}
.gen-input-section :deep(.el-textarea__inner) {
  height: 100%;
  font-family: 'Courier New', Courier, monospace;
  font-size: 13px;
  resize: none;
}
.gen-input-section :deep(.el-textarea) {
  flex: 1;
}
.gen-preview-editor {
  flex: 1;
  overflow: hidden;
  border: 1px solid var(--border-color);
  border-radius: 4px;
}
.gen-error {
  margin-top: 6px;
  font-size: 12px;
  color: #F56C6C;
}

/* 路径参数标签 */
.path-params-tags {
  padding: 2px 10px 6px 20px;
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}
.path-params-label {
  font-size: 11px;
  color: var(--text-secondary);
}

/* 配置行 */
.config-row {
  padding: 6px 10px;
  display: flex;
  align-items: center;
  gap: 16px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-hover);
  flex-wrap: wrap;
}
.config-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
}
.config-label {
  color: var(--text-secondary);
  font-size: 12px;
  white-space: nowrap;
}
.config-sep {
  color: var(--text-secondary);
  font-size: 13px;
  margin: 0 2px;
}

/* 条件响应编辑器 */
.expectations-editor {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.exp-card {
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: var(--bg-hover);
}
.exp-header {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.exp-response-config {
  display: flex;
  gap: 6px;
  margin-left: auto;
}
.cond-row {
  display: flex;
  gap: 6px;
  align-items: center;
}
.exp-response {
  margin-top: 4px;
}
.exp-badge {
  margin-left: 4px;
}

/* 断言区域 */
.assertions-section {
  border-bottom: 1px solid var(--border-color);
  padding: 8px 12px;
  flex-shrink: 0;
}
.assertions-header {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 6px;
}
.assertions-summary .passed { color: #67C23A; font-size: 12px; }
.assertions-summary .failed { color: #F56C6C; font-size: 12px; margin-left: 8px; }
.assertion-result-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  font-size: 12px;
}
.assertion-result-row.passed { color: #67C23A; }
.assertion-result-row.failed { color: #F56C6C; }
.assertion-desc { flex: 1; color: var(--text-primary); }
.assertion-actual { color: var(--text-secondary); font-family: monospace; font-size: 11px; }

/* 断言配置 */
.assertions-config {
  border-bottom: 1px solid var(--border-color);
  padding: 8px 12px;
  flex-shrink: 0;
}
.assertions-config-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 6px;
}
.assertion-row {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-bottom: 6px;
}
</style>