/**
 * ActivityBar - 左侧导航栏组件
 * 从设置中读取用户自定义的模块排列，支持一级入口和「更多」弹出面板。
 */
<script setup lang="ts">
import { ref, computed, inject } from 'vue';
import { Connection, DocumentCopy, Setting, Briefcase, FolderOpened, Tickets, Operation, Promotion, DataLine, Collection, Document, MoreFilled } from '@element-plus/icons-vue';
import type { Component } from 'vue';
import { settingsKey, type SidebarModuleKey } from '@/composables/useSettings';

const props = defineProps<{ modelValue: string }>();
const emit = defineEmits<{ (e: 'update:modelValue', val: string): void }>();

const settings = inject(settingsKey)!;

/** 全部模块元数据 */
interface NavItem { key: SidebarModuleKey; label: string; icon: Component; }

const allModules: Record<SidebarModuleKey, NavItem> = {
  dashboard: { key: 'dashboard', label: '看板', icon: DataLine },
  project: { key: 'project', label: '项目', icon: FolderOpened },
  api: { key: 'api', label: '接口', icon: Connection },
  template: { key: 'template', label: '模板', icon: DocumentCopy },
  scenario: { key: 'scenario', label: '场景', icon: Operation },
  tools: { key: 'tools', label: '工具', icon: Briefcase },
  environment: { key: 'environment', label: '环境', icon: Collection },
  doc: { key: 'doc', label: '文档', icon: Document },
  log: { key: 'log', label: '日志', icon: Tickets },
  websocket: { key: 'websocket', label: 'WS', icon: Promotion },
};

/** 从设置中读取一级入口 */
const primaryItems = computed(() =>
  settings.sidebarPrimary.map(k => allModules[k]).filter(Boolean)
);

/** 从设置中读取更多面板 */
const moreItems = computed(() =>
  settings.sidebarMore.map(k => allModules[k]).filter(Boolean)
);

const moreKeys = computed(() => new Set(settings.sidebarMore));

const showMore = ref(false);
const moreActive = computed(() => moreKeys.value.has(props.modelValue as SidebarModuleKey));

function handleMoreClick(key: string) {
  emit('update:modelValue', key);
  showMore.value = false;
}

function toggleMore() {
  showMore.value = !showMore.value;
}
</script>

<template>
  <div class="activity-bar">
    <!-- 顶部主菜单 -->
    <div class="bar-top">
      <div
        v-for="item in primaryItems"
        :key="item.key"
        class="nav-item"
        :class="{ active: modelValue === item.key }"
        @click="$emit('update:modelValue', item.key)"
        :title="item.label"
      >
        <div class="active-indicator" v-if="modelValue === item.key"></div>
        <el-icon :size="18"><component :is="item.icon" /></el-icon>
        <span class="nav-label">{{ item.label }}</span>
      </div>

      <div class="nav-divider"></div>

      <!-- 更多按钮 -->
      <div class="nav-item-wrapper">
        <div
          class="nav-item"
          :class="{ active: moreActive, 'more-open': showMore }"
          @click="toggleMore"
          title="更多"
        >
          <div class="active-indicator" v-if="moreActive && !showMore"></div>
          <el-icon :size="18"><MoreFilled /></el-icon>
          <span class="nav-label">更多</span>
        </div>

        <!-- 弹出面板 -->
        <Transition name="more-pop">
          <div v-if="showMore" class="more-panel" @click.stop>
            <div class="more-panel-title">更多模块</div>
            <div
              v-for="item in moreItems"
              :key="item.key"
              class="more-item"
              :class="{ active: modelValue === item.key }"
              @click="handleMoreClick(item.key)"
            >
              <el-icon :size="16"><component :is="item.icon" /></el-icon>
              <span>{{ item.label }}</span>
            </div>
          </div>
        </Transition>
      </div>
    </div>

    <!-- 底部：设置 -->
    <div class="bar-bottom">
      <div
        class="nav-item"
        :class="{ active: modelValue === 'settings' }"
        @click="$emit('update:modelValue', 'settings')"
        title="设置"
      >
        <div class="active-indicator" v-if="modelValue === 'settings'"></div>
        <el-icon :size="18"><Setting /></el-icon>
        <span class="nav-label">设置</span>
      </div>
    </div>
  </div>

  <!-- 遮罩层：点击关闭更多面板 -->
  <Teleport to="body">
    <div v-if="showMore" class="more-overlay" @click="showMore = false"></div>
  </Teleport>
</template>

<style scoped>
.activity-bar {
  width: 52px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 6px 0;
  flex-shrink: 0;
  background: transparent;
  overflow: visible;
}

.bar-top {
  display: flex;
  flex-direction: column;
}

.nav-item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 40px;
  width: 42px;
  margin: 1px auto;
  border-radius: 8px;
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
  background-color: var(--bg-hover);
}

.active-indicator {
  position: absolute;
  left: -6px;
  width: 3px;
  height: 16px;
  background-color: var(--primary-color);
  border-radius: 0 3px 3px 0;
}

.nav-label {
  font-size: 10px;
  margin-top: 1px;
  font-weight: 500;
  transform: scale(0.8);
  line-height: 1;
}

.nav-divider {
  width: 24px;
  height: 1px;
  background: var(--border-color);
  margin: 4px auto;
  opacity: 0.6;
}

/* 更多按钮容器 */
.nav-item-wrapper {
  position: relative;
}

.nav-item.more-open {
  background-color: var(--bg-hover);
  color: var(--primary-color);
}

/* 弹出面板 */
.more-panel {
  position: absolute;
  left: 50px;
  top: -4px;
  width: 130px;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 6px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  z-index: 1000;
}

.more-panel-title {
  font-size: 11px;
  color: var(--text-secondary);
  padding: 4px 8px 6px;
  font-weight: 500;
}

.more-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-secondary);
  transition: all 0.15s;
}

.more-item:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.more-item.active {
  color: var(--primary-color);
  background: var(--primary-bg);
}

/* 弹出动画 */
.more-pop-enter-active { transition: all 0.15s ease-out; }
.more-pop-leave-active { transition: all 0.1s ease-in; }
.more-pop-enter-from { opacity: 0; transform: translateX(-6px) scale(0.95); }
.more-pop-leave-to { opacity: 0; transform: translateX(-6px) scale(0.95); }

/* 遮罩层 */
.more-overlay {
  position: fixed;
  inset: 0;
  z-index: 999;
}
</style>