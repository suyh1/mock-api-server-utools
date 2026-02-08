<script setup lang="ts">
import { computed } from 'vue';
import { Check, Delete, VideoPlay } from '@element-plus/icons-vue';
import type { MockRule } from '@/types/mock';

const props = defineProps<{
  modelValue: Partial<MockRule>; // 使用 Partial，允许空对象
  testResult: string;
  hasSelection: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', val: Partial<MockRule>): void;
  (e: 'save'): void;
  (e: 'delete'): void;
  (e: 'test'): void;
}>();

// computed 的类型通常能自动推断
const rule = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
});
</script>

<template>
  <el-main class="editor-main">
    <div v-if="hasSelection" class="editor-layout">
      <div class="editor-toolbar">
        <el-select v-model="rule.method" style="width: 100px" size="default">
          <el-option value="GET" /><el-option value="POST" /><el-option value="PUT" /><el-option value="DELETE" />
        </el-select>
        <el-input v-model="rule.url" placeholder="/api/path" class="url-input" />
        <el-button type="success" :icon="Check" @click="$emit('save')">保存</el-button>
        <el-button type="danger" :icon="Delete" plain @click="$emit('delete')">删除</el-button>
      </div>

      <div class="editor-settings">
        <span class="label">模拟延迟(ms):</span>
        <el-input-number v-model="rule.delay" :min="0" :step="100" size="small" />
      </div>

      <div class="json-editor">
        <div class="section-title">Response Body (JSON)</div>
        <el-input type="textarea" v-model="rule.response" class="code-textarea" resize="none" />
      </div>

      <div class="test-panel">
        <div class="panel-header">
          <span>调试结果</span>
          <el-button type="primary" size="small" :icon="VideoPlay" @click="$emit('test')">发送请求</el-button>
        </div>
        <div class="test-result">
          <pre>{{ testResult }}</pre>
        </div>
      </div>
    </div>
    <el-empty v-else description="请选择或创建一个接口开始 Mock" />
  </el-main>
</template>

<style scoped>
.editor-main { padding: 0; display: flex; flex-direction: column; height: 100%; }
.editor-layout { display: flex; flex-direction: column; height: 100%; }
.editor-toolbar { padding: 15px; display: flex; gap: 10px; border-bottom: 1px solid #eee; background: #fff; }
.url-input { flex: 1; }
.editor-settings { padding: 10px 15px; display: flex; align-items: center; gap: 10px; background: #fdfdfd; border-bottom: 1px solid #eee; font-size: 13px; color: #666; }
.json-editor { flex: 1; display: flex; flex-direction: column; padding: 15px; overflow: hidden; }
.section-title { font-weight: 600; margin-bottom: 8px; color: #333; font-size: 14px; }
.code-textarea { flex: 1; height: 100%; }
:deep(.el-textarea__inner) { height: 100% !important; font-family: Consolas, monospace; background: #fafafa; color: #333; }
.test-panel { height: 200px; border-top: 1px solid #eee; display: flex; flex-direction: column; background: #fff; }
.panel-header { padding: 8px 15px; display: flex; justify-content: space-between; align-items: center; background: #f5f7fa; border-bottom: 1px solid #eee; font-size: 13px; font-weight: 600; }
.test-result { flex: 1; background: #2b2b2b; color: #a9b7c6; padding: 10px 15px; overflow: auto; font-size: 12px; }
.test-result pre { margin: 0; font-family: Consolas, monospace; }
</style>