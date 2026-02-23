<script setup lang="ts">
import { ref } from 'vue';
import { QuestionFilled } from '@element-plus/icons-vue';

defineProps<{ title?: string }>();

const visible = ref(false);

function open() {
  visible.value = true;
}

defineExpose({ open });
</script>

<template>
  <el-button size="small" link :icon="QuestionFilled" @click="open" title="使用指南">帮助</el-button>
  <el-dialog v-model="visible" :title="title || '使用指南'" width="620px" destroy-on-close>
    <div class="guide-dialog-body">
      <slot />
    </div>
  </el-dialog>
</template>

<style scoped>
.guide-dialog-body {
  max-height: 60vh;
  overflow-y: auto;
  font-size: 13px;
  color: var(--text-primary);
  line-height: 1.8;
}
.guide-dialog-body :deep(h4) { margin: 14px 0 6px 0; font-size: 14px; }
.guide-dialog-body :deep(h4:first-child) { margin-top: 0; }
.guide-dialog-body :deep(ol),
.guide-dialog-body :deep(ul) { padding-left: 20px; margin: 4px 0; }
.guide-dialog-body :deep(li) { margin: 2px 0; }
.guide-dialog-body :deep(p) { margin: 6px 0; }
.guide-dialog-body :deep(b) { color: var(--text-primary); }
.guide-dialog-body :deep(code) { background: var(--bg-hover); padding: 1px 5px; border-radius: 3px; font-size: 12px; }
.guide-dialog-body :deep(table) { width: 100%; border-collapse: collapse; font-size: 12px; margin: 8px 0; }
.guide-dialog-body :deep(th),
.guide-dialog-body :deep(td) { border: 1px solid var(--border-color); padding: 6px 10px; text-align: left; }
.guide-dialog-body :deep(th) { background: var(--bg-card); font-weight: 600; color: var(--text-secondary); }
.guide-dialog-body :deep(pre) { background: var(--bg-card); border-radius: 6px; padding: 10px 14px; font-size: 12px; line-height: 1.6; margin: 8px 0; white-space: pre-wrap; font-family: 'Courier New', Courier, monospace; }
.guide-dialog-body :deep(.guide-tip) { color: var(--text-secondary); font-style: italic; margin-top: 12px; }
</style>
