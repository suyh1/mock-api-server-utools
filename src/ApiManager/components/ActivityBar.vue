/**
 * ActivityBar - 左侧导航栏组件
 * 包含顶部菜单项（接口、模板、工具）和底部菜单项（设置、关于），
 * 通过 v-model 双向绑定当前选中的 tab，点击切换主内容区域。
 */
<script setup lang="ts">
import { Connection, DocumentCopy, Setting, InfoFilled, Briefcase, FolderOpened, Tickets, Operation } from '@element-plus/icons-vue';
import type { Component } from 'vue';

/** 当前选中的导航项 key，支持 v-model 双向绑定 */
defineProps<{ modelValue: string }>();

/** 选中项变更事件，向父组件同步当前激活的 tab */
defineEmits<{ (e: 'update:modelValue', val: string): void }>();

/** 导航项数据结构 */
interface NavItem { key: string; label: string; icon: Component; }

/** 顶部主菜单项列表：项目管理、接口管理、模板管理、工具箱 */
const menuItems: NavItem[] = [
  { key: 'project', label: '项目', icon: FolderOpened },
  { key: 'api', label: '接口', icon: Connection },
  { key: 'template', label: '模板', icon: DocumentCopy },
  { key: 'tools', label: '工具', icon: Briefcase },
  { key: 'log', label: '日志', icon: Tickets },
  { key: 'scenario', label: '场景', icon: Operation },
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
  width: 52px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 10px 0;
  flex-shrink: 0;
  background: transparent;
}

.nav-item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 48px;
  width: 42px;
  margin: 2px auto;
  border-radius: 10px;
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
  left: -6px;
  width: 3px;
  height: 20px;
  background-color: var(--primary-color);
  border-radius: 0 3px 3px 0;
}

.nav-label {
  font-size: 10px;
  margin-top: 2px;
  font-weight: 500;
  transform: scale(0.85);
}
</style>