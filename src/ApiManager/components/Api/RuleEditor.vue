<script setup lang="ts">
import { computed, inject, ref, watch, onMounted } from 'vue';
import { Check, VideoPlay, CopyDocument, Plus, Delete, Document, ArrowDown, ArrowRight, FolderOpened, Close, Download, DocumentCopy } from '@element-plus/icons-vue';
import type { MockRule, KeyValueItem, MockTemplate, ServiceConfig, TestResultFile, TestResultMeta } from '@/types/mock';
import CodeEditor from '@/ApiManager/components/CodeEditor.vue'; // 引入 CodeMirror 封装组件
import { ElMessage, ElMessageBox } from 'element-plus';

const props = defineProps<{
  modelValue: Partial<MockRule>;
  testResult: string;
  testResultFile?: TestResultFile | null;
  testResultMeta?: TestResultMeta | null;
  hasSelection: boolean;
  groupConfig?: ServiceConfig;
  localIp?: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', val: Partial<MockRule>): void;
  (e: 'save'): void;
  (e: 'copy'): void;
  (e: 'test', mode: 'mock' | 'real'): void;
}>();

// 【关键】注入全局的深色模式状态 (由 index.vue 提供)
const isDark = inject('isDark', ref(false));

// 顶级 Tab：接口 | 响应数据 | 请求日志
const mainTab = ref('interface');
// 接口定义子 Tab
const interfaceTab = ref('req-header');
// 请求详情是否展开
const showMeta = ref(false);

const rule = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
});

// --- 新增：类型安全的计算属性代理 ---

// 1. 基础模式代码代理
const responseBasicCode = computed({
  get: () => rule.value.responseBasic ?? '', // 如果是 undefined，返回空字符串
  set: (val: string) => {
    rule.value.responseBasic = val;
  }
});

// 2. 高级模式代码代理
const responseAdvancedCode = computed({
  get: () => rule.value.responseAdvanced ?? '',
  set: (val: string) => {
    rule.value.responseAdvanced = val;
  }
});

// 3. JSON Body 代码代理 (防止 body 为 undefined 时报错)
const jsonBodyCode = computed({
  get: () => rule.value.body?.raw ?? '',
  set: (val: string) => {
    if (rule.value.body) {
      rule.value.body.raw = val;
    }
  }
});


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

// 通用行操作
const addRow = (list: KeyValueItem[]) => list.push({ key: '', value: '', required: false });
const removeRow = (list: KeyValueItem[], idx: number) => list.splice(idx, 1);

// --- Mock 地址计算 ---
const mockUrlPrefix = computed(() => {
  const cfg = props.groupConfig;
  const ip = props.localIp || 'localhost';
  const port = cfg?.port || 3888;
  let prefix = cfg?.prefix || '';
  if (prefix && !prefix.startsWith('/')) prefix = '/' + prefix;
  return `http://${ip}:${port}${prefix}`;
});

// --- 真实地址计算（接口级别覆盖分组配置）---
const realProtocol = computed({
  get: () => rule.value.realConfig?.protocol || props.groupConfig?.realProtocol || 'http',
  set: (v: string) => { if (rule.value.realConfig) rule.value.realConfig.protocol = v; }
});
const realHost = computed({
  get: () => rule.value.realConfig?.host || props.groupConfig?.realHost || '',
  set: (v: string) => { if (rule.value.realConfig) rule.value.realConfig.host = v; }
});
const realPort = computed({
  get: () => rule.value.realConfig?.port || props.groupConfig?.realPort || '',
  set: (v: string) => { if (rule.value.realConfig) rule.value.realConfig.port = v; }
});
const realPrefix = computed({
  get: () => rule.value.realConfig?.prefix ?? props.groupConfig?.realPrefix ?? '',
  set: (v: string) => { if (rule.value.realConfig) rule.value.realConfig.prefix = v; }
});
const realPath = computed({
  get: () => rule.value.realConfig?.path ?? rule.value.url ?? '',
  set: (v: string) => { if (rule.value.realConfig) rule.value.realConfig.path = v; }
});

const realUrlFull = computed(() => {
  if (!realHost.value) return '';
  let url = `${realProtocol.value}://${realHost.value}`;
  if (realPort.value) url += `:${realPort.value}`;
  let prefix = realPrefix.value;
  if (prefix && !prefix.startsWith('/')) prefix = '/' + prefix;
  url += prefix;
  let path = realPath.value;
  if (path && !path.startsWith('/')) path = '/' + path;
  url += path;
  return url;
});

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

// 二进制（文件）类型集合
const binaryTypes = new Set([
  'application/pdf', 'application/zip', 'application/octet-stream', 'video/mp4',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]);

// 判断当前是否为文件类型
const isBinaryType = computed(() => binaryTypes.has(rule.value.responseType || ''));

// 根据响应类型返回编辑器语言
const editorLanguage = computed(() => {
  const type = rule.value.responseType || 'application/json';
  if (type.includes('json')) return 'json';
  return 'javascript';
});

// 文件名（从路径中提取）
const selectedFileName = computed(() => {
  const filePath = rule.value.responseFile;
  if (!filePath) return '';
  return filePath.split('/').pop() || filePath.split('\\').pop() || filePath;
});

// 文件选择对话框的过滤器
const fileFilters: Record<string, { name: string; extensions: string[] }[]> = {
  'application/pdf': [{ name: 'PDF 文件', extensions: ['pdf'] }],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [{ name: 'Word 文档', extensions: ['doc', 'docx'] }],
  'application/zip': [{ name: '压缩文件', extensions: ['zip', 'rar', '7z'] }],
  'video/mp4': [{ name: '视频文件', extensions: ['mp4', 'avi', 'mov', 'mkv'] }],
  'application/octet-stream': [{ name: '所有文件', extensions: ['*'] }],
};

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

// 清除已选文件
const handleClearFile = () => {
  rule.value.responseFile = '';
};

// 下载测试结果中的文件
const handleDownloadFile = () => {
  const file = props.testResultFile;
  if (!file) return;
  const a = document.createElement('a');
  a.href = file.blobUrl;
  a.download = file.filename;
  a.click();
};

// 复制真实地址完整 URL
const handleCopyRealUrl = () => {
  const url = realUrlFull.value;
  if (!url) { ElMessage.warning('真实地址为空'); return; }
  navigator.clipboard.writeText(url);
  ElMessage.success('已复制真实地址');
};

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
const templateList = ref<MockTemplate[]>([]);
const API_BASE = 'http://localhost:3000';

const loadTemplates = async () => {
  try {
    const res = await fetch(`${API_BASE}/_admin/templates`);
    templateList.value = await res.json();
  } catch (e) { console.error('Load templates failed', e); }
};

// 过滤当前模式下的可用模板
const availableTemplates = computed(() => {
  return templateList.value.filter(t => t.mode === rule.value.responseMode);
});

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

onMounted(() => {
  loadTemplates(); // 加载模板
}); // 加载模板
</script>

<template>
  <el-main class="editor-main">
    <div v-if="hasSelection" class="editor-layout">

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

      <div class="tab-content-area">

        <div v-show="mainTab === 'interface'" class="interface-panel">
          <!-- Mock 地址行 -->
          <div class="addr-row">
            <span class="addr-tag mock">Mock</span>
            <el-select v-model="rule.method" style="width: 90px" size="default">
              <el-option value="GET" /><el-option value="POST" /><el-option value="PUT" /><el-option value="DELETE" />
            </el-select>
            <el-input v-model="rule.url" placeholder="/path" class="url-input">
              <template #prepend>{{ mockUrlPrefix }}</template>
            </el-input>
            <el-button type="primary" plain :icon="CopyDocument" @click="$emit('copy')" title="复制Mock地址" />
          </div>

          <!-- 真实地址行 -->
          <div class="addr-row real-row">
            <span class="addr-tag real">真实</span>
            <el-select v-model="realProtocol" style="width: 82px" size="default">
              <el-option label="http" value="http" />
              <el-option label="https" value="https" />
            </el-select>
            <span class="addr-sep">://</span>
            <el-input v-model="realHost" placeholder="主机地址" style="width: 150px" />
            <span class="addr-sep">:</span>
            <el-input v-model="realPort" placeholder="端口" style="width: 70px" />
            <span class="addr-sep">/</span>
            <el-input v-model="realPrefix" placeholder="前缀" style="width: 100px" />
            <span class="addr-sep">/</span>
            <el-input v-model="realPath" placeholder="路径" class="url-input" />
            <el-button plain :icon="CopyDocument" @click="handleCopyRealUrl" title="复制真实地址" />
            <el-button plain :icon="DocumentCopy" @click="handlePasteRealUrl" title="粘贴并解析URL" />
          </div>

          <!-- 操作栏 -->
          <div class="addr-actions">
            <el-button type="success" :icon="Check" @click="$emit('save')">保存</el-button>
          </div>

          <el-tabs v-model="interfaceTab" class="sub-tabs">
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

            <el-tab-pane label="请求体" name="req-body">
              <div class="body-panel">
                <el-radio-group v-model="rule.body!.type" size="small" style="margin-bottom: 10px">
                  <el-radio-button label="none">none</el-radio-button>
                  <el-radio-button label="json">json</el-radio-button>
                  <el-radio-button label="form-data">form-data</el-radio-button>
                </el-radio-group>

                <div v-if="rule.body!.type === 'json'" class="full-height">
                  <CodeEditor
                      v-model="jsonBodyCode"
                      language="json"
                      :is-dark="isDark"
                  />
                </div>

                <div v-else-if="rule.body!.type === 'form-data'" class="kv-list">
                  <div v-for="(item, idx) in rule.body!.formData" :key="idx" class="kv-row">
                    <el-input v-model="item.key" placeholder="Key" />
                    <el-input v-model="item.value" placeholder="Value" />
                    <el-button :icon="Delete" circle plain type="danger" size="small" @click="removeRow(rule.body!.formData, idx)" />
                  </div>
                  <el-button link type="primary" :icon="Plus" @click="addRow(rule.body!.formData)">添加字段</el-button>
                </div>
                <el-empty v-else description="该请求没有 Body" :image-size="60" />
              </div>
            </el-tab-pane>

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
          </el-tabs>
        </div>

        <div v-show="mainTab === 'response'" class="response-panel">
          <div class="mode-bar">
            <div class="mode-switch">
              <span class="label">模式：</span>
              <el-radio-group v-model="rule.responseMode" size="default">
                <el-radio-button label="basic">基础模式</el-radio-button>
                <el-radio-button label="advanced">高级模式</el-radio-button>
              </el-radio-group>
            </div>

            <div v-if="rule.responseMode === 'basic'" class="type-select">
              <span class="label">响应类型：</span>
              <el-select v-model="rule.responseType" style="width: 220px" filterable>
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

            <el-button type="success" :icon="Check" @click="$emit('save')" style="margin-left: auto">保存配置</el-button>
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
                <el-button type="primary" size="small" :icon="VideoPlay" @click="$emit('test', 'mock')">请求Mock</el-button>
                <el-button type="warning" size="small" :icon="VideoPlay" @click="$emit('test', 'real')" :disabled="!realUrlFull">请求真实接口</el-button>
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
  </el-main>
</template>

<style scoped>
.editor-main { padding: 0; display: flex; flex-direction: column; height: 100%; background: var(--bg-card); }
.editor-layout { display: flex; flex-direction: column; height: 100%; }

/* 顶级 Tab */
.main-tabs-header { display: flex; border-bottom: 1px solid var(--border-color); background: var(--bg-frame); }
.tab-item {
  padding: 12px 24px; cursor: pointer; font-size: 14px; font-weight: 500; color: var(--text-secondary);
  border-bottom: 2px solid transparent; transition: all 0.2s;
}
.tab-item:hover { color: var(--primary-color); }
.tab-item.active { color: var(--primary-color); border-bottom-color: var(--primary-color); background: var(--bg-card); }

.tab-content-area { flex: 1; overflow: hidden; display: flex; flex-direction: column; }
.full-height { height: 100%; display: flex; flex-direction: column; overflow: hidden; }

/* 接口面板 */
.interface-panel { display: flex; flex-direction: column; height: 100%; }

/* 地址行 */
.addr-row {
  padding: 8px 12px; display: flex; gap: 6px; align-items: center;
  border-bottom: 1px solid var(--border-color); background: var(--bg-hover);
}
.addr-tag {
  padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; flex-shrink: 0; white-space: nowrap;
}
.addr-tag.mock { background: #e1f3d8; color: #67C23A; }
.addr-tag.real { background: #fdf6ec; color: #E6A23C; }
.addr-sep { color: var(--text-secondary); font-size: 13px; font-family: monospace; flex-shrink: 0; }
.real-row { padding-top: 0; border-top: none; }
.addr-actions { padding: 6px 12px; display: flex; justify-content: flex-end; border-bottom: 1px solid var(--border-color); background: var(--bg-hover); }
.url-input { flex: 1; }
.sub-tabs { flex: 1; display: flex; flex-direction: column; }
:deep(.el-tabs__header) { margin: 0; padding: 0 16px; }
:deep(.el-tabs__content) { flex: 1; overflow: auto; padding: 16px; }

/* Body 面板 */
.body-panel { height: 100%; display: flex; flex-direction: column; }

/* 响应面板 */
.response-panel { display: flex; flex-direction: column; height: 100%; }
.mode-bar { padding: 12px 16px; border-bottom: 1px solid var(--border-color); display: flex; align-items: center; gap: 20px; background: var(--bg-hover); }
.mode-switch, .type-select { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text-primary); }
.editor-area { flex: 1; padding: 0; overflow: hidden; }

/* 高级模式容器 */
.advanced-editor { display: flex; flex-direction: column; }
.script-hint {
  padding: 8px 16px; background: #e6f7ff; color: #1890ff; font-size: 12px; display: flex; align-items: center; gap: 6px; border-bottom: 1px solid #91d5ff; flex-shrink: 0;
}
/* 文件选择器 */
.file-picker-area {
  flex: 1; display: flex; align-items: center; justify-content: center; padding: 40px;
}
.file-picker-content {
  display: flex; flex-direction: column; align-items: center; gap: 20px;
  padding: 40px; border: 2px dashed var(--border-color); border-radius: 12px;
  background: var(--bg-hover); min-width: 400px;
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
.panel-header { padding: 10px 16px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); background: var(--bg-hover); flex-shrink: 0; position: sticky; top: 0; z-index: 1; }
.test-actions { display: flex; gap: 8px; }
.test-result { min-height: 200px; flex: 1; overflow: hidden; padding: 0; border: none; }

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

.template-actions { display: flex; gap: 10px; margin-left: 20px; border-left: 1px solid var(--border-color); padding-left: 20px; }
</style>