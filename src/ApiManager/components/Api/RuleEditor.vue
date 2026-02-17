<script setup lang="ts">
import { computed, inject, ref, watch, onMounted } from 'vue';
import { Check, VideoPlay, CopyDocument, Plus, Delete, Document, ArrowDown } from '@element-plus/icons-vue';
import type { MockRule, KeyValueItem, MockTemplate } from '@/types/mock';
import CodeEditor from '@/ApiManager/components/CodeEditor.vue'; // 引入 CodeMirror 封装组件
import { ElMessage, ElMessageBox } from 'element-plus';

const props = defineProps<{
  modelValue: Partial<MockRule>;
  testResult: string;
  hasSelection: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', val: Partial<MockRule>): void;
  (e: 'save'): void;
  (e: 'copy'): void;
  (e: 'test'): void;
}>();

// 【关键】注入全局的深色模式状态 (由 index.vue 提供)
const isDark = inject('isDark', ref(false));

// 顶级 Tab：接口 | 响应数据 | 请求日志
const mainTab = ref('interface');
// 接口定义子 Tab
const interfaceTab = ref('req-header');

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

  // 直接初始化 responseBasic (如果为空)
  if (val.responseBasic === undefined) {
    rule.value.responseBasic = '{}';
  }
  if (!val.responseAdvanced) rule.value.responseAdvanced = advancedTemplate;
}, { immediate: true, deep: true });

// 通用行操作
const addRow = (list: KeyValueItem[]) => list.push({ key: '', value: '', required: false });
const removeRow = (list: KeyValueItem[], idx: number) => list.splice(idx, 1);

// 响应类型选项
const contentTypes = [
  { label: 'application/json', value: 'application/json' },
  { label: 'text/plain', value: 'text/plain' },
  { label: 'text/html', value: 'text/html' },
  { label: 'application/xml', value: 'application/xml' },
];

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
        >请求日志</div>
      </div>

      <div class="tab-content-area">

        <div v-show="mainTab === 'interface'" class="interface-panel">
          <div class="toolbar">
            <el-select v-model="rule.method" style="width: 100px">
              <el-option value="GET" /><el-option value="POST" /><el-option value="PUT" /><el-option value="DELETE" />
            </el-select>
            <el-input v-model="rule.url" placeholder="/api/path" class="url-input" />
            <el-button type="success" :icon="Check" @click="$emit('save')">保存</el-button>
            <el-button type="primary" plain :icon="CopyDocument" @click="$emit('copy')">复制URL</el-button>
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
              <el-select v-model="rule.responseType" style="width: 180px">
                <el-option v-for="t in contentTypes" :key="t.value" :label="t.label" :value="t.value" />
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
              <CodeEditor
                  v-model="responseBasicCode"
                  :language="rule.responseType?.includes('json') ? 'json' : 'javascript'"
                  :is-dark="isDark"
              />
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
              <span>调试请求</span>
              <el-button type="primary" size="small" :icon="VideoPlay" @click="$emit('test')">发送请求</el-button>
            </div>
            <div class="test-result">
              <CodeEditor
                  :model-value="testResult || '暂无请求记录'"
                  language="json"
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
.toolbar { padding: 12px; display: flex; gap: 10px; border-bottom: 1px solid var(--border-color); }
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

/* 列表样式 */
.kv-list { display: flex; flex-direction: column; gap: 8px; }
.kv-row { display: flex; gap: 8px; align-items: center; }

/* 日志面板 */
.logs-panel { padding: 0; height: 100%; display: flex; flex-direction: column; }
.test-panel { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.panel-header { padding: 10px 16px; display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-color); background: var(--bg-hover); flex-shrink: 0; }
.test-result { flex: 1; overflow: hidden; padding: 0; border: none; }

.template-actions { display: flex; gap: 10px; margin-left: 20px; border-left: 1px solid var(--border-color); padding-left: 20px; }
</style>