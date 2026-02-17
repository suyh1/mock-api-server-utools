<script setup lang="ts">
import { computed } from 'vue';
import { Codemirror } from 'vue-codemirror';
import { json, jsonParseLinter } from '@codemirror/lang-json';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';
import { linter, lintGutter } from '@codemirror/lint';
import { EditorView } from '@codemirror/view';

// 接收 Props
const props = defineProps<{
  modelValue: string;      // 代码内容
  language?: 'json' | 'javascript' | 'typescript'; // 语言类型
  isDark?: boolean;        // 是否深色模式
  readonly?: boolean;      // 是否只读
}>();

const emit = defineEmits(['update:modelValue', 'change']);

// 【核心修复】创建一个可写的计算属性代理
const code = computed({
  get: () => props.modelValue,
  set: (val: string) => {
    emit('update:modelValue', val);
    emit('change', val);
  }
});

// 动态计算扩展插件
const extensions = computed(() => {
  const exts = [
    // 基础功能：错误提示槽
    lintGutter(),
    // 外观配置：让编辑器撑满容器
    EditorView.theme({
      "&": { height: "100%" },
      ".cm-scroller": { overflow: "auto" }
    })
  ];

  // 1. 语言支持 & 语法检查
  if (props.language === 'json') {
    exts.push(json());
    exts.push(linter(jsonParseLinter())); // JSON 格式错误校验（红线提示）
  } else if (props.language === 'javascript') {
    exts.push(javascript());
  } else if (props.language === 'typescript') {
    exts.push(javascript({ typescript: true }));
  }

  // 2. 主题支持
  if (props.isDark) {
    exts.push(oneDark); // 深色主题 (One Dark)
  } else {
    // 浅色模式使用默认主题，可以自定义一些高亮颜色
    exts.push(EditorView.theme({
      ".cm-content": { caretColor: "#000" },
      "&.cm-focused .cm-cursor": { borderLeftColor: "#000" },
      ".cm-activeLine": { backgroundColor: "#f0f8ff" }, // 浅色高亮行
      ".cm-gutters": { backgroundColor: "#f5f7fa", color: "#ddd", borderRight: "1px solid #e4e7ed" }
    }));
  }

  // 3. 只读模式
  if (props.readonly) {
    exts.push(EditorView.editable.of(false));
  }

  return exts;
});
</script>

<template>
  <div class="code-editor-wrapper" :class="{ dark: isDark }">
    <codemirror
        v-model="code"
        :style="{ height: '100%' }"
        :autofocus="false"
        :indent-with-tab="true"
        :tab-size="2"
        :extensions="extensions"
    />
  </div>
</template>

<style scoped>
.code-editor-wrapper {
  height: 100%;
  width: 100%;
  overflow: hidden;
  border: 1px solid var(--border-color); /* 跟随系统边框 */
  font-size: 13px;
  background-color: #ffffff; /* 浅色背景 */
}

/* 深色模式下的容器背景 */
.code-editor-wrapper.dark {
  background-color: #282c34; /* One Dark 背景色 */
  border-color: #303030;
}
</style>