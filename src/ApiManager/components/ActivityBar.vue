/**
 * ActivityBar - 左侧导航栏组件
 * 包含顶部菜单项（接口、模板、工具）和底部菜单项（设置、关于），
 * 通过 v-model 双向绑定当前选中的 tab，点击切换主内容区域。
 */
<script setup lang="ts">
import { Connection, DocumentCopy, Setting, InfoFilled, Briefcase } from '@element-plus/icons-vue';
import type { Component } from 'vue';

/** 当前选中的导航项 key，支持 v-model 双向绑定 */
defineProps<{ modelValue: string }>();

/** 选中项变更事件，向父组件同步当前激活的 tab */
defineEmits<{ (e: 'update:modelValue', val: string): void }>();

/** 导航项数据结构 */
interface NavItem { key: string; label: string; icon: Component; }

/** 顶部主菜单项列表：接口管理、模板管理、工具箱 */
const menuItems: NavItem[] = [
  { key: 'api', label: '接口', icon: Connection },
  { key: 'template', label: '模板', icon: DocumentCopy },
  { key: 'tools', label: '工具', icon: Briefcase },
];

/** 底部辅助菜单项列表：设置、关于 */
const bottomItems: NavItem[] = [
  { key: 'settings', label: '设置', icon: Setting },
  { key: 'about', label: '关于', icon: InfoFilled },
];
</script>

<template>
  <!-- 左侧活动栏容器，上下分区布局 -->
  <div class="activity-bar">
    <!-- 顶部主菜单区域 -->
    <div class="bar-top">
      <div
          v-for="item in menuItems"
          :key="item.key"
          class="nav-item"
          :class="{ active: modelValue === item.key }"
          @click="$emit('update:modelValue', item.key)"
          :title="item.label"
      >
        <!-- 选中态左侧指示条 -->
        <div class="active-indicator" v-if="modelValue === item.key"></div>

        <el-icon :size="22"><component :is="item.icon" /></el-icon>
        <span class="nav-label">{{ item.label }}</span>
      </div>
    </div>

    <!-- 底部辅助菜单区域 -->
    <div class="bar-bottom">
      <div
          v-for="item in bottomItems"
          :key="item.key"
          class="nav-item"
          :class="{ active: modelValue === item.key }"
          @click="$emit('update:modelValue', item.key)"
          :title="item.label"
      >
        <!-- 选中态左侧指示条 -->
        <div class="active-indicator" v-if="modelValue === item.key"></div>
        <el-icon :size="22"><component :is="item.icon" /></el-icon>
        <span class="nav-label">{{ item.label }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.activity-bar {
  width: 72px; /* 稍微宽一点点 */
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 16px 0;
  flex-shrink: 0;
  /* 关键：背景透明，透出 app-frame 的颜色 */
  background: transparent;
}

.nav-item {
  position: relative; /* 为了定位指示条 */
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 60px;
  width: 56px;
  margin: 4px auto; /* 居中 */
  border-radius: 12px; /* 方圆形按钮 */
  cursor: pointer;
  color: var(--text-secondary);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.nav-item:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

.nav-item.active {
  color: var(--primary-color);
  background-color: var(--bg-hover); /* 或者是白色背景，看个人喜好 */
}

/* 选中时的指示条（左侧小竖条） */
.active-indicator {
  position: absolute;
  left: -8px; /* 在 Bar 的边缘 */
  width: 4px;
  height: 24px;
  background-color: var(--primary-color);
  border-radius: 0 4px 4px 0;
}

.nav-label {
  font-size: 10px;
  margin-top: 4px;
  font-weight: 500;
  transform: scale(0.9);
}
</style>