/**
 * @file GroupSidebar.vue
 * @description 接口分组侧边栏组件
 *
 * 功能说明：
 * - 展示分组列表（可折叠手风琴），每个分组下包含接口列表
 * - 分组操作：新增分组、重命名、删除、服务配置
 * - 接口操作：新增接口、选中、删除、启用/禁用开关
 * - 接口按 HTTP 方法（GET/POST/PUT/DELETE）显示不同颜色标签
 */
<script setup lang="ts">
import { ref, watch } from 'vue';
import { Plus, Edit, Delete, Setting } from '@element-plus/icons-vue';
import type { MockGroup, MockRule } from '@/types/mock';
import { TagType } from "@/types/groupSideBar";

/**
 * 组件属性
 * @property {MockGroup[]} groups - 分组数据列表，包含分组信息及其下属接口
 * @property {number | null} currentRuleId - 当前选中的接口 ID，用于高亮显示
 */
const props = defineProps<{
  groups: MockGroup[];
  currentRuleId: number | null;
}>();

/**
 * 组件事件
 * @event group-add - 新增分组
 * @event group-rename - 重命名分组，携带目标分组对象
 * @event group-delete - 删除分组，携带分组索引
 * @event group-config - 打开分组的服务配置，携带目标分组对象
 * @event rule-add - 在指定分组下新增接口，携带目标分组对象
 * @event rule-select - 选中某个接口，携带目标接口对象
 * @event rule-delete - 删除接口，携带所属分组和目标接口对象
 * @event rule-toggle - 切换接口的启用/禁用状态
 */
const emit = defineEmits<{
  (e: 'group-add'): void;
  (e: 'group-rename', group: MockGroup): void;
  (e: 'group-delete', idx: number): void;
  (e: 'group-config', group: MockGroup): void;
  (e: 'rule-add', group: MockGroup): void;
  (e: 'rule-select', rule: MockRule): void;
  (e: 'rule-delete', group: MockGroup, rule: MockRule): void; // 新增删除事件
  (e: 'rule-toggle'): void;
}>();

/** 当前展开的分组 ID 列表，用于控制手风琴折叠状态 */
const activeGroupNames = ref<number[]>([]);

/**
 * 监听分组数据变化
 * 当分组数据首次加载时，默认展开所有分组
 */
watch(() => props.groups, (newVal) => {
  if (newVal && activeGroupNames.value.length === 0) {
    activeGroupNames.value = newVal.map(g => g.id);
  }
}, { immediate: true });

/**
 * 根据 HTTP 方法返回对应的标签颜色类型
 * @param {string} method - HTTP 方法名（GET/POST/PUT/DELETE）
 * @returns {TagType} Element Plus 标签颜色类型
 */
const methodTagType = (method: string) => {
  const map: Record<string, TagType> = {
    GET: 'primary',
    POST: 'success',
    PUT: 'warning',
    DELETE: 'danger'
  };
  return map[method] || 'info';
};
</script>

<template>
  <!-- 侧边栏容器 -->
  <el-aside :width="'100%'" class="inner-sidebar">
    <!-- 顶部标题栏：标题 + 新建分组按钮 -->
    <div class="inner-header">
      <span class="title">接口列表</span>
      <el-button type="primary" size="small" :icon="Plus" circle @click="$emit('group-add')" title="新建分组" />
    </div>
    <!-- 可滚动的分组列表区域 -->
    <el-scrollbar>
      <div class="group-wrapper">
        <!-- 手风琴折叠面板，每个面板对应一个分组 -->
        <el-collapse v-model="activeGroupNames">
          <el-collapse-item v-for="(group, idx) in groups" :key="group.id" :name="group.id">
            <!-- 分组标题栏：分组名称 + 操作按钮组 -->
            <template #title>
              <div class="group-title-content">
                <span class="group-name">{{ group.name }}</span>
                <!-- 分组操作按钮：服务配置、新增接口、重命名、删除 -->
                <div class="group-btns">
                  <el-button link type="info" @click.stop="$emit('group-config', group)" title="服务配置">
                    <el-icon><Setting /></el-icon>
                  </el-button>
                  <el-button link type="primary" @click.stop="$emit('rule-add', group)" title="新增接口">
                    <el-icon><Plus /></el-icon>
                  </el-button>
                  <el-button link type="warning" @click.stop="$emit('group-rename', group)" title="重命名">
                    <el-icon><Edit /></el-icon>
                  </el-button>
                  <el-button link type="danger" @click.stop="$emit('group-delete', idx)" title="删除分组">
                    <el-icon><Delete /></el-icon>
                  </el-button>
                </div>
              </div>
            </template>

            <!-- 接口列表：遍历分组下的所有接口规则 -->
            <div
                v-for="rule in group.children"
                :key="rule.id"
                class="rule-item"
                :class="{ active: currentRuleId === rule.id }"
                @click="$emit('rule-select', rule)"
            >
              <!-- 接口左侧：HTTP 方法标签 + 接口名称/路径 -->
              <div class="rule-left">
                <el-tag size="small" :type="methodTagType(rule.method)" effect="dark" class="method-tag">{{ rule.method }}</el-tag>
                <div class="rule-info">
                  <span v-if="rule.name" class="rule-name" :title="rule.name">{{ rule.name }}</span>
                  <span class="rule-url" :class="{ 'is-sub': !!rule.name }" :title="rule.url">{{ rule.url }}</span>
                </div>
              </div>

              <!-- 接口右侧操作区：删除按钮 + 启用/禁用开关 -->
              <div class="rule-actions">
                <el-button
                    link
                    type="danger"
                    size="small"
                    class="del-btn"
                    @click.stop="$emit('rule-delete', group, rule)"
                    title="删除接口"
                >
                  <el-icon><Delete /></el-icon>
                </el-button>

                <el-switch
                    v-model="rule.active"
                    size="small"
                    @change="$emit('rule-toggle')"
                    @click.stop
                />
              </div>
            </div>
            <!-- 空状态提示 -->
            <div v-if="!group.children.length" class="empty-tip">暂无接口</div>
          </el-collapse-item>
        </el-collapse>
      </div>
    </el-scrollbar>
  </el-aside>
</template>

<style scoped>
.inner-sidebar {
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  background-color: transparent;
  height: 100%;
  overflow: hidden;
  flex: 1;
}
.inner-header {
  height: 42px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 15px;
  border-bottom: 1px solid var(--border-color);
  font-weight: 600;
  color: var(--text-primary);
}
.group-wrapper { padding: 10px; }
:deep(.el-collapse-item__header) {
  height: 40px;
  padding-left: 5px;
  font-weight: 600;
  background-color: transparent;
  color: var(--text-primary);
  border-bottom-color: var(--border-color);
}
:deep(.el-collapse-item__wrap) {
  background-color: transparent;
  border-bottom-color: var(--border-color);
}
.group-title-content {
  display: flex;
  justify-content: space-between;
  width: 100%;
  padding-right: 10px;
  align-items: center;
}
.group-btns {
  display: none;
}
.group-title-content:hover .group-btns {
  display: flex;
}
.rule-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  margin: 4px 0;
  border-radius: 6px;
  cursor: pointer;
  background: transparent;
  border: 1px solid transparent;
  transition: all 0.2s;
}
.rule-item:hover {
  background: var(--bg-hover);
}
.rule-item.active {
  background: var(--primary-bg);
  border-color: transparent;
}
.rule-left {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  overflow: hidden;
}
.method-tag {
  width: 45px;
  justify-content: center;
  font-weight: bold;
  border: none;
}
.rule-info {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.rule-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.rule-item.active .rule-name {
  color: var(--primary-color);
}
.rule-url {
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.rule-url.is-sub {
  font-size: 10px;
  opacity: 0.7;
}
.rule-item.active .rule-url {
  color: var(--primary-color);
}

/* 右侧操作区样式 */
.rule-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.del-btn {
  opacity: 0; /* 默认隐藏 */
  transition: opacity 0.2s;
  padding: 0;
}
.rule-item:hover .del-btn {
  opacity: 1; /* 悬停显示 */
}

.empty-tip {
  text-align: center;
  color: var(--text-secondary);
  font-size: 12px;
  padding: 10px;
}
</style>
