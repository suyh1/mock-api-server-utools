/**
 * CodeEditor - 代码编辑器组件
 *
 * 基于 vue-codemirror 封装的通用代码编辑器，提供以下能力：
 * - 支持 JSON / JavaScript / TypeScript 语言高亮
 * - 深色模式（One Dark 主题）与浅色模式自动切换
 * - 只读模式
 * - JSON 语法实时校验（lint 红线提示）
 * - 通过 v-model 双向绑定代码内容
 */
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

/**
 * 组件事件
 * @event update:modelValue - 代码内容变更时触发，用于 v-model 双向绑定
 * @event change            - 代码内容变更时触发，供父组件监听
 */
const emit = defineEmits(['update:modelValue', 'change']);

/**
 * 可写计算属性 - 作为 v-model 的代理
 * get: 读取父组件传入的 modelValue
 * set: 写入时同时触发 update:modelValue 和 change 事件
 * 【核心修复】避免直接修改 props，通过计算属性代理实现双向绑定
 */
const code = computed({
  get: () => props.modelValue,
  set: (val: string) => {
    emit('update:modelValue', val);
    emit('change', val);
  }
});

/**
 * 动态计算 CodeMirror 扩展插件列表
 * 根据 props 的变化自动重新计算，包含：
 * - 基础功能（lint 提示槽、编辑器高度撑满）
 * - 语言支持与语法检查（JSON / JS / TS）
 * - 主题切换（深色 One Dark / 浅色自定义）
 * - 只读模式控制
 */
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
  <!-- 编辑器外层容器，通过 dark 类名切换深色/浅色样式 -->
  <div class="code-editor-wrapper" :class="{ dark: isDark }">
    <!-- CodeMirror 编辑器实例，通过 v-model 绑定代码内容，extensions 控制语言/主题/只读等行为 -->
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