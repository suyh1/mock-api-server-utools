<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Check, VideoPlay, CopyDocument, Plus, Delete, InfoFilled } from '@element-plus/icons-vue';
import type { MockRule, KeyValueItem } from '@/types/mock';

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

const activeTab = ref('res-body'); // 默认选中响应体

const rule = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
});

// 初始化数据结构，防止 undefined 报错
watch(() => props.modelValue, (val) => {
  if (!val) return;
  if (!val.headers) rule.value.headers = [];
  if (!val.params) rule.value.params = [];
  if (!val.responseHeaders) rule.value.responseHeaders = [];
  if (!val.body) {
    rule.value.body = { type: 'none', raw: '', formData: [] };
  }
}, { immediate: true, deep: true });

// 通用增删行逻辑
const addRow = (list: KeyValueItem[]) => {
  list.push({ key: '', value: '', required: false, description: '' });
};
const removeRow = (list: KeyValueItem[], index: number) => {
  list.splice(index, 1);
};
</script>

<template>
  <el-main class="editor-main">
    <div v-if="hasSelection" class="editor-layout">
      <div class="editor-toolbar">
        <el-select v-model="rule.method" style="width: 100px">
          <el-option value="GET" /><el-option value="POST" /><el-option value="PUT" /><el-option value="DELETE" />
        </el-select>
        <el-input v-model="rule.url" placeholder="/api/path" class="url-input" />
        <el-button type="success" :icon="Check" @click="$emit('save')">保存</el-button>
        <el-button type="primary" plain :icon="CopyDocument" @click="$emit('copy')">复制URL</el-button>
      </div>

      <div class="tabs-container">
        <el-tabs v-model="activeTab" class="custom-tabs">
          <el-tab-pane label="请求头" name="req-header">
            <div class="pane-content">
              <div class="kv-list">
                <div v-for="(item, idx) in rule.headers" :key="idx" class="kv-row">
                  <el-input v-model="item.key" placeholder="Key" />
                  <el-input v-model="item.value" placeholder="Value" />
                  <el-checkbox v-model="item.required" label="必填" border size="small" />
                  <el-button type="danger" :icon="Delete" circle plain size="small" @click="removeRow(rule.headers!, idx)" />
                </div>
                <div class="kv-actions">
                  <el-button type="primary" link :icon="Plus" @click="addRow(rule.headers!)">添加 Header</el-button>
                </div>
                <el-empty v-if="!rule.headers?.length" :image-size="60" description="未配置请求头">
                  <el-button type="primary" size="small" @click="addRow(rule.headers!)">添加</el-button>
                </el-empty>
              </div>
            </div>
          </el-tab-pane>

          <el-tab-pane label="请求参数" name="req-query">
            <div class="pane-content">
              <div class="kv-list">
                <div v-for="(item, idx) in rule.params" :key="idx" class="kv-row">
                  <el-input v-model="item.key" placeholder="参数名" />
                  <el-input v-model="item.value" placeholder="示例值" />
                  <el-checkbox v-model="item.required" label="必填" border size="small" />
                  <el-button type="danger" :icon="Delete" circle plain size="small" @click="removeRow(rule.params!, idx)" />
                </div>
                <div class="kv-actions">
                  <el-button type="primary" link :icon="Plus" @click="addRow(rule.params!)">添加参数</el-button>
                </div>
                <el-empty v-if="!rule.params?.length" :image-size="60" description="未配置 Query 参数">
                  <el-button type="primary" size="small" @click="addRow(rule.params!)">添加</el-button>
                </el-empty>
              </div>
            </div>
          </el-tab-pane>

          <el-tab-pane label="请求体" name="req-body">
            <div class="pane-content body-pane">
              <div class="body-type-selector">
                <el-radio-group v-model="rule.body!.type" size="small">
                  <el-radio-button label="none">none</el-radio-button>
                  <el-radio-button label="json">json</el-radio-button>
                  <el-radio-button label="form-data">form-data</el-radio-button>
                  <el-radio-button label="x-www-form-urlencoded">x-www-form</el-radio-button>
                  <el-radio-button label="text">text</el-radio-button>
                </el-radio-group>
              </div>

              <div v-if="['json', 'text', 'xml'].includes(rule.body!.type)" class="raw-editor">
                <el-input
                    type="textarea"
                    v-model="rule.body!.raw"
                    :rows="8"
                    placeholder="在此输入请求体内容（仅作文档展示）"
                    class="code-textarea"
                />
              </div>

              <div v-else-if="['form-data', 'x-www-form-urlencoded'].includes(rule.body!.type)" class="kv-list">
                <div v-for="(item, idx) in rule.body!.formData" :key="idx" class="kv-row">
                  <el-input v-model="item.key" placeholder="Key" />
                  <el-input v-model="item.value" placeholder="Value" />
                  <el-button type="danger" :icon="Delete" circle plain size="small" @click="removeRow(rule.body!.formData, idx)" />
                </div>
                <div class="kv-actions">
                  <el-button type="primary" link :icon="Plus" @click="addRow(rule.body!.formData)">添加字段</el-button>
                </div>
                <el-empty v-if="!rule.body?.formData?.length" :image-size="60" description="无字段">
                  <el-button type="primary" size="small" @click="addRow(rule.body!.formData)">添加</el-button>
                </el-empty>
              </div>

              <div v-else class="empty-body">
                <span>该请求没有 Body</span>
              </div>
            </div>
          </el-tab-pane>

          <el-tab-pane label="响应头" name="res-header">
            <div class="pane-content">
              <div class="kv-list">
                <div v-for="(item, idx) in rule.responseHeaders" :key="idx" class="kv-row">
                  <el-input v-model="item.key" placeholder="Key (e.g. Content-Type)" />
                  <el-input v-model="item.value" placeholder="Value (e.g. application/json)" />
                  <el-button type="danger" :icon="Delete" circle plain size="small" @click="removeRow(rule.responseHeaders!, idx)" />
                </div>
                <div class="kv-actions">
                  <el-button type="primary" link :icon="Plus" @click="addRow(rule.responseHeaders!)">添加响应头</el-button>
                </div>
                <el-empty v-if="!rule.responseHeaders?.length" :image-size="60" description="未配置响应头">
                  <el-button type="primary" size="small" @click="addRow(rule.responseHeaders!)">添加</el-button>
                </el-empty>
              </div>
            </div>
          </el-tab-pane>

          <el-tab-pane label="响应体 (Response)" name="res-body">
            <div class="pane-content column-layout">
              <div class="editor-settings">
                <span class="label">模拟延迟(ms):</span>
                <el-input-number v-model="rule.delay" :min="0" :step="100" size="small" />
                <el-tooltip content="设置接口返回数据的模拟延迟时间" placement="top">
                  <el-icon class="help-icon"><InfoFilled /></el-icon>
                </el-tooltip>
              </div>
              <div class="json-wrapper">
                <el-input
                    type="textarea"
                    v-model="rule.response"
                    class="code-textarea"
                    resize="none"
                    placeholder="输入 JSON 响应"
                />
              </div>
            </div>
          </el-tab-pane>
        </el-tabs>
      </div>

<!--      <div class="test-panel">-->
<!--        <div class="panel-header">-->
<!--          <span>调试结果</span>-->
<!--          <el-button type="primary" size="small" :icon="VideoPlay" @click="$emit('test')">发送请求</el-button>-->
<!--        </div>-->
<!--        <div class="test-result">-->
<!--          <pre>{{ testResult }}</pre>-->
<!--        </div>-->
<!--      </div>-->
    </div>
    <el-empty v-else description="请选择或创建一个接口开始 Mock" />
  </el-main>
</template>

<style scoped>
.editor-main {
  padding: 0;
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--bg-card);
}
.editor-layout {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.editor-toolbar {
  padding: 12px 16px;
  display: flex;
  gap: 12px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-card);
  flex-shrink: 0;
}
.url-input { flex: 1; }

.tabs-container {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.custom-tabs {
  height: 100%;
  display: flex;
  flex-direction: column;
}
:deep(.el-tabs__header) {
  margin: 0;
  padding: 0 16px;
  border-bottom: 1px solid var(--border-color);
}
:deep(.el-tabs__content) {
  flex: 1;
  overflow: auto;
  padding: 0;
}
.pane-content {
  padding: 16px;
  height: 100%;
  box-sizing: border-box;
}

/* Key-Value List Styles */
.kv-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.kv-row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.kv-actions {
  margin-top: 8px;
}

/* Body Pane */
.body-type-selector {
  margin-bottom: 12px;
}
.raw-editor {
  flex: 1;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  overflow: hidden;
}
.empty-body {
  height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  border: 1px dashed var(--border-color);
  border-radius: 6px;
}

/* Response Body Layout */
.column-layout {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.editor-settings {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-secondary);
}
.help-icon { cursor: pointer; }
.json-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
}

/* Code Textarea */
.code-textarea {
  flex: 1;
  height: 100%;
}
:deep(.el-textarea__inner) {
  height: 100% !important;
  font-family: 'Consolas', monospace;
  background: var(--bg-frame);
  color: var(--text-primary);
  border-color: var(--border-color);
  line-height: 1.5;
}

/* Test Panel */
.test-panel {
  height: 200px;
  border-top: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  background: var(--bg-card);
  flex-shrink: 0;
}
.panel-header {
  padding: 8px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--bg-hover);
  border-bottom: 1px solid var(--border-color);
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}
.test-result {
  flex: 1;
  background: #1e1e1e;
  color: #a9b7c6;
  padding: 12px 16px;
  overflow: auto;
  font-size: 12px;
}
.test-result pre { margin: 0; font-family: 'Consolas', monospace; }
</style>