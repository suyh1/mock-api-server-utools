<script setup lang="ts">
import {
  Connection, DocumentCopy, Setting, InfoFilled
} from '@element-plus/icons-vue';
import type {Component} from "vue";

// 接收当前激活的 Tab，并支持双向绑定
defineProps<{
  modelValue: string
}>();

defineEmits<{
  (e: 'update:modelValue', val: string): void
}>();

// 定义菜单项接口
interface NavItem {
  key: string;
  label: string;
  icon: Component;
}

const menuItems: NavItem[] = [
  { key: 'api', label: '接口', icon: Connection },
  { key: 'template', label: '模板', icon: DocumentCopy },
];

const bottomItems: NavItem[] = [
  { key: 'settings', label: '设置', icon: Setting },
  { key: 'about', label: '关于', icon: InfoFilled },
];
</script>

<template>
  <div class="activity-bar">
    <div class="bar-top">
      <div
          v-for="item in menuItems"
          :key="item.key"
          class="nav-item"
          :class="{ active: modelValue === item.key }"
          @click="$emit('update:modelValue', item.key)"
          :title="item.label"
      >
        <el-icon :size="24"><component :is="item.icon" /></el-icon>
        <span class="nav-label">{{ item.label }}</span>
      </div>
    </div>

    <div class="bar-bottom">
      <div
          v-for="item in bottomItems"
          :key="item.key"
          class="nav-item"
          :class="{ active: modelValue === item.key }"
          @click="$emit('update:modelValue', item.key)"
          :title="item.label"
      >
        <el-icon :size="24"><component :is="item.icon" /></el-icon>
        <span class="nav-label">{{ item.label }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.activity-bar {
  width: 64px;
  background-color: #2b2d30;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 10px 0;
  flex-shrink: 0;
  z-index: 10;
}
.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 64px;
  cursor: pointer;
  color: #8c8c8c;
  transition: all 0.2s;
  border-left: 3px solid transparent;
}
.nav-item:hover { color: #fff; background-color: #3e4043; }
.nav-item.active { color: #fff; border-left-color: #409eff; background-color: #35373a; }
.nav-label { font-size: 10px; margin-top: 4px; }
</style>