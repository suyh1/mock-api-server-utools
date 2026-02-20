/**
 * @file GroupSidebar.vue
 * @description 接口分组侧边栏组件
 *
 * 功能：
 * - 按项目过滤分组、搜索接口、右键菜单（复制/移动）、拖拽排序
 * - 分组操作：新增、重命名、删除、服务配置、描述 tooltip
 * - 接口操作：新增、选中、删除、启用/禁用
 */
<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { Plus, Edit, Delete, Setting, Search, Rank, DocumentCopy } from '@element-plus/icons-vue';
import type { MockGroup, MockRule, Project } from '@/types/mock';
import { TagType } from "@/types/groupSideBar";

const props = defineProps<{
  groups: MockGroup[];
  currentRuleId: number | null;
  projects: Project[];
  currentProjectId: number | null;
}>();

const emit = defineEmits<{
  (e: 'project-change', projectId: number | null): void;
  (e: 'group-add'): void;
  (e: 'group-rename', group: MockGroup): void;
  (e: 'group-delete', idx: number): void;
  (e: 'group-config', group: MockGroup): void;
  (e: 'rule-add', group: MockGroup): void;
  (e: 'rule-select', rule: MockRule): void;
  (e: 'rule-delete', group: MockGroup, rule: MockRule): void;
  (e: 'rule-toggle'): void;
  (e: 'rule-copy', rule: MockRule, targetGroupId: number): void;
  (e: 'rule-move', rule: MockRule, sourceGroup: MockGroup, targetGroupId: number): void;
  (e: 'rule-reorder', group: MockGroup, fromIdx: number, toIdx: number): void;
}>();

const activeGroupNames = ref<number[]>([]);

// --- 搜索 ---
const searchKeyword = ref('');
const searchInputRef = ref<HTMLInputElement | null>(null);

/** 暴露聚焦搜索框方法给父组件 */
const focusSearch = () => {
  nextTick(() => searchInputRef.value?.focus());
};
defineExpose({ focusSearch });

/** 按项目过滤后的分组列表 */
const projectFilteredGroups = computed(() => {
  if (props.currentProjectId === null) return props.groups;
  return props.groups.filter(g => g.projectId === props.currentProjectId);
});

/** 搜索过滤后的分组列表 */
const filteredGroups = computed(() => {
  const kw = searchKeyword.value.trim().toLowerCase();
  if (!kw) return projectFilteredGroups.value;

  return projectFilteredGroups.value
    .map(group => {
      const matchedChildren = group.children.filter(rule =>
        (rule.name?.toLowerCase().includes(kw)) ||
        rule.url.toLowerCase().includes(kw) ||
        rule.method.toLowerCase().includes(kw)
      );
      if (matchedChildren.length > 0) {
        return { ...group, children: matchedChildren };
      }
      // 分组名匹配时显示全部接口
      if (group.name.toLowerCase().includes(kw)) return group;
      return null;
    })
    .filter(Boolean) as MockGroup[];
});

const getOriginalIndex = (group: MockGroup) => {
  return props.groups.findIndex(g => g.id === group.id);
};

watch(() => filteredGroups.value, (newVal) => {
  if (newVal && newVal.length > 0) {
    activeGroupNames.value = newVal.map(g => g.id);
  }
}, { immediate: true });

// --- 右键菜单 ---
const contextMenu = ref({ visible: false, x: 0, y: 0 });
const contextRule = ref<MockRule | null>(null);
const contextGroup = ref<MockGroup | null>(null);
const showCopyMoveDialog = ref(false);
const copyMoveMode = ref<'copy' | 'move'>('copy');
const targetGroupId = ref<number | null>(null);

const onRuleContextMenu = (e: MouseEvent, group: MockGroup, rule: MockRule) => {
  e.preventDefault();
  contextMenu.value = { visible: true, x: e.clientX, y: e.clientY };
  contextRule.value = rule;
  contextGroup.value = group;
};

const closeContextMenu = () => {
  contextMenu.value.visible = false;
};

const openCopyMoveDialog = (mode: 'copy' | 'move') => {
  copyMoveMode.value = mode;
  targetGroupId.value = null;
  showCopyMoveDialog.value = true;
  closeContextMenu();
};

const confirmCopyMove = () => {
  if (!targetGroupId.value || !contextRule.value) return;
  if (copyMoveMode.value === 'copy') {
    emit('rule-copy', contextRule.value, targetGroupId.value);
  } else {
    emit('rule-move', contextRule.value, contextGroup.value!, targetGroupId.value);
  }
  showCopyMoveDialog.value = false;
};

// --- 拖拽排序 ---
const dragRuleId = ref<number | null>(null);
const dragGroupId = ref<number | null>(null);
const dropTargetId = ref<number | null>(null);

const onDragStart = (e: DragEvent, group: MockGroup, rule: MockRule) => {
  dragRuleId.value = rule.id;
  dragGroupId.value = group.id;
  e.dataTransfer!.effectAllowed = 'move';
};

const onDragOver = (e: DragEvent, rule: MockRule) => {
  e.preventDefault();
  dropTargetId.value = rule.id;
};

const onDragLeave = () => {
  dropTargetId.value = null;
};

const onDrop = (e: DragEvent, group: MockGroup, targetRule: MockRule) => {
  e.preventDefault();
  dropTargetId.value = null;
  if (!dragRuleId.value || dragGroupId.value !== group.id) return;
  if (dragRuleId.value === targetRule.id) return;

  const fromIdx = group.children.findIndex(r => r.id === dragRuleId.value);
  const toIdx = group.children.findIndex(r => r.id === targetRule.id);
  if (fromIdx !== -1 && toIdx !== -1) {
    emit('rule-reorder', group, fromIdx, toIdx);
  }
  dragRuleId.value = null;
  dragGroupId.value = null;
};

const onDragEnd = () => {
  dragRuleId.value = null;
  dragGroupId.value = null;
  dropTargetId.value = null;
};

// --- 工具方法 ---
const methodTagType = (method: string) => {
  const map: Record<string, TagType> = {
    GET: 'primary', POST: 'success', PUT: 'warning', DELETE: 'danger'
  };
  return map[method] || 'info';
};

// 点击其他地方关闭右键菜单
if (typeof document !== 'undefined') {
  document.addEventListener('click', closeContextMenu);
}
</script>

<template>
  <el-aside :width="'100%'" class="inner-sidebar">
    <!-- 顶部标题栏 -->
    <div class="inner-header">
      <span class="title">接口列表</span>
      <el-button type="primary" size="small" :icon="Plus" circle @click="$emit('group-add')" title="新建分组" />
    </div>

    <!-- 项目选择器 -->
    <div class="project-selector">
      <el-select
        :model-value="currentProjectId"
        @update:model-value="$emit('project-change', $event)"
        placeholder="全部项目"
        clearable
        size="small"
        style="width: 100%"
      >
        <el-option v-for="p in projects" :key="p.id" :label="`${p.icon || '📦'} ${p.name}`" :value="p.id" />
      </el-select>
    </div>

    <!-- 搜索框 -->
    <div class="search-bar">
      <el-input
        ref="searchInputRef"
        v-model="searchKeyword"
        :prefix-icon="Search"
        placeholder="搜索接口名称、URL、方法"
        size="small"
        clearable
      />
    </div>

    <!-- 分组列表 -->
    <el-scrollbar>
      <div class="group-wrapper">
        <el-collapse v-model="activeGroupNames">
          <el-collapse-item v-for="group in filteredGroups" :key="group.id" :name="group.id">
            <template #title>
              <el-tooltip :content="group.description" placement="right" :disabled="!group.description" :show-after="500">
                <div class="group-title-content">
                  <span class="group-name">{{ group.name }}</span>
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
                    <el-button link type="danger" @click.stop="$emit('group-delete', getOriginalIndex(group))" title="删除分组">
                      <el-icon><Delete /></el-icon>
                    </el-button>
                  </div>
                </div>
              </el-tooltip>
            </template>

            <!-- 接口列表（支持拖拽排序和右键菜单） -->
            <div
              v-for="rule in group.children"
              :key="rule.id"
              class="rule-item"
              :class="{ active: currentRuleId === rule.id, 'drop-target': dropTargetId === rule.id }"
              draggable="true"
              @click="$emit('rule-select', rule)"
              @contextmenu="onRuleContextMenu($event, group, rule)"
              @dragstart="onDragStart($event, group, rule)"
              @dragover="onDragOver($event, rule)"
              @dragleave="onDragLeave"
              @drop="onDrop($event, group, rule)"
              @dragend="onDragEnd"
            >
              <div class="rule-left">
                <el-tag size="small" :type="methodTagType(rule.method)" effect="dark" class="method-tag">{{ rule.method }}</el-tag>
                <div class="rule-info">
                  <span v-if="rule.name" class="rule-name" :title="rule.name">{{ rule.name }}</span>
                  <span class="rule-url" :class="{ 'is-sub': !!rule.name }" :title="rule.url">{{ rule.url }}</span>
                </div>
              </div>
              <div class="rule-actions">
                <el-button link type="danger" size="small" class="del-btn" @click.stop="$emit('rule-delete', group, rule)" title="删除接口">
                  <el-icon><Delete /></el-icon>
                </el-button>
                <el-switch v-model="rule.active" size="small" @change="$emit('rule-toggle')" @click.stop />
              </div>
            </div>
            <div v-if="!group.children.length" class="empty-tip">暂无接口</div>
          </el-collapse-item>
        </el-collapse>

        <!-- 搜索无结果 -->
        <div v-if="searchKeyword && !filteredGroups.length" class="empty-tip">未找到匹配的接口</div>
      </div>
    </el-scrollbar>

    <!-- 右键菜单 -->
    <Teleport to="body">
      <div
        v-if="contextMenu.visible"
        class="context-menu"
        :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
      >
        <div class="context-menu-item" @click="openCopyMoveDialog('copy')">
          <el-icon><DocumentCopy /></el-icon> 复制到其他分组
        </div>
        <div class="context-menu-item" @click="openCopyMoveDialog('move')">
          <el-icon><Rank /></el-icon> 移动到其他分组
        </div>
        <div class="context-menu-divider"></div>
        <div class="context-menu-item danger" @click="() => { if (contextGroup && contextRule) { $emit('rule-delete', contextGroup, contextRule); closeContextMenu(); } }">
          <el-icon><Delete /></el-icon> 删除接口
        </div>
      </div>
    </Teleport>

    <!-- 复制/移动对话框 -->
    <el-dialog v-model="showCopyMoveDialog" :title="copyMoveMode === 'copy' ? '复制到分组' : '移动到分组'" width="360px" destroy-on-close>
      <el-select v-model="targetGroupId" placeholder="选择目标分组" style="width: 100%">
        <el-option
          v-for="g in groups.filter(g => g.id !== contextGroup?.id)"
          :key="g.id"
          :label="g.name"
          :value="g.id"
        />
      </el-select>
      <template #footer>
        <el-button @click="showCopyMoveDialog = false">取消</el-button>
        <el-button type="primary" @click="confirmCopyMove" :disabled="!targetGroupId">确定</el-button>
      </template>
    </el-dialog>
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
.project-selector {
  padding: 8px 12px 0;
}
.search-bar {
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-color);
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
.rule-item.drop-target {
  border-color: var(--primary-color);
  border-style: dashed;
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
.rule-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.del-btn {
  opacity: 0;
  transition: opacity 0.2s;
  padding: 0;
}
.rule-item:hover .del-btn {
  opacity: 1;
}
.empty-tip {
  text-align: center;
  color: var(--text-secondary);
  font-size: 12px;
  padding: 10px;
}

/* 右键菜单 */
.context-menu {
  position: fixed;
  z-index: 9999;
  background: var(--bg-card, #fff);
  border: 1px solid var(--border-color, #e5e6eb);
  border-radius: 6px;
  padding: 4px 0;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  min-width: 160px;
}
.context-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  font-size: 13px;
  color: var(--text-primary, #1d2129);
  cursor: pointer;
  transition: background 0.15s;
}
.context-menu-item:hover {
  background: var(--bg-hover, rgba(0,0,0,0.04));
}
.context-menu-item.danger {
  color: #f56c6c;
}
.context-menu-divider {
  height: 1px;
  background: var(--border-color, #e5e6eb);
  margin: 4px 0;
}
</style>