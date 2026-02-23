/**
 * @file GroupSidebar.vue
 * @description 接口分组侧边栏组件（三层树结构：服务 → 分组 → 接口）
 *
 * 功能：
 * - 按项目过滤服务、搜索接口、右键菜单（复制/移动）、拖拽排序
 * - 服务层：展示名称、端口、运行状态
 * - 分组层：名称、子前缀、新增接口按钮
 * - 接口层：方法标签、名称/URL、启用/禁用
 */
<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { Plus, Edit, Delete, Search, Rank, DocumentCopy, ArrowRight } from '@element-plus/icons-vue';
import type { MockService, MockServiceGroup, MockRule, Project } from '@/types/mock';
import { TagType } from "@/types/groupSideBar";

const props = defineProps<{
  services: MockService[];
  currentRuleId: number | null;
  projects: Project[];
  currentProjectId: number | null;
  serviceStatusMap: Record<string, { running: boolean; port: number; prefix: string }>;
}>();

const emit = defineEmits<{
  (e: 'project-change', projectId: number | null): void;
  (e: 'group-add', service: MockService): void;
  (e: 'group-rename', service: MockService, group: MockServiceGroup): void;
  (e: 'group-delete', service: MockService, groupIdx: number): void;
  (e: 'rule-add', service: MockService, group: MockServiceGroup): void;
  (e: 'rule-select', rule: MockRule): void;
  (e: 'rule-delete', service: MockService, group: MockServiceGroup, rule: MockRule): void;
  (e: 'rule-toggle'): void;
  (e: 'rule-copy', rule: MockRule, targetServiceId: number, targetGroupId: number): void;
  (e: 'rule-move', rule: MockRule, sourceService: MockService, sourceGroup: MockServiceGroup, targetServiceId: number, targetGroupId: number): void;
  (e: 'rule-reorder', group: MockServiceGroup, fromIdx: number, toIdx: number): void;
  (e: 'rule-clone', rule: MockRule, service: MockService, group: MockServiceGroup): void;
  (e: 'curl-import', service: MockService, group: MockServiceGroup): void;
  (e: 'batch-action', action: string, ruleIds: number[]): void;
}>();

/** 展开的服务 ID 集合 */
const expandedServiceIds = ref<Set<number>>(new Set());
/** 展开的分组 key 集合（格式：serviceId_groupId） */
const expandedGroupKeys = ref<Set<string>>(new Set());

const toggleService = (id: number) => {
  const s = expandedServiceIds.value;
  if (s.has(id)) s.delete(id); else s.add(id);
};
const toggleGroup = (key: string) => {
  const s = expandedGroupKeys.value;
  if (s.has(key)) s.delete(key); else s.add(key);
};
const isServiceExpanded = (id: number) => expandedServiceIds.value.has(id);
const isGroupExpanded = (key: string) => expandedGroupKeys.value.has(key);

// --- 搜索 ---
const searchKeyword = ref('');
const searchInputRef = ref<HTMLInputElement | null>(null);

const focusSearch = () => {
  nextTick(() => searchInputRef.value?.focus());
};

/** 按项目过滤后的服务列表 */
const projectFilteredServices = computed(() => {
  if (props.currentProjectId === null) return props.services;
  return props.services.filter(s => s.projectId === props.currentProjectId);
});

/** 搜索过滤后的服务列表 */
const filteredServices = computed(() => {
  const kw = searchKeyword.value.trim().toLowerCase();
  if (!kw) return projectFilteredServices.value;

  return projectFilteredServices.value
    .map(service => {
      // 搜索匹配服务名
      if (service.name.toLowerCase().includes(kw)) return service;

      // 搜索匹配分组名或接口
      const matchedGroups = service.groups
        .map(group => {
          const matchedChildren = group.children.filter(rule =>
            (rule.name?.toLowerCase().includes(kw)) ||
            rule.url.toLowerCase().includes(kw) ||
            rule.method.toLowerCase().includes(kw)
          );
          if (matchedChildren.length > 0) return { ...group, children: matchedChildren };
          if (group.name.toLowerCase().includes(kw)) return group;
          return null;
        })
        .filter(Boolean) as MockServiceGroup[];

      if (matchedGroups.length > 0) return { ...service, groups: matchedGroups };
      return null;
    })
    .filter(Boolean) as MockService[];
});

watch(() => filteredServices.value, (newVal) => {
  if (newVal && newVal.length > 0) {
    expandedServiceIds.value = new Set(newVal.map(s => s.id));
    const keys = new Set<string>();
    newVal.forEach(s => s.groups.forEach(g => keys.add(`${s.id}_${g.id}`)));
    expandedGroupKeys.value = keys;
  }
}, { immediate: true });

// --- 右键菜单 ---
const contextMenu = ref({ visible: false, x: 0, y: 0 });
const contextRule = ref<MockRule | null>(null);
const contextService = ref<MockService | null>(null);
const contextGroup = ref<MockServiceGroup | null>(null);
const showCopyMoveDialog = ref(false);
const copyMoveMode = ref<'copy' | 'move'>('copy');
const targetServiceId = ref<number | null>(null);
const targetGroupId = ref<number | null>(null);

/** 所有服务中所有分组的扁平列表（用于复制/移动对话框） */
const allGroupOptions = computed(() => {
  const options: { serviceId: number; serviceName: string; groupId: number; groupName: string }[] = [];
  props.services.forEach(s => {
    s.groups.forEach(g => {
      options.push({ serviceId: s.id, serviceName: s.name, groupId: g.id, groupName: g.name });
    });
  });
  return options;
});

const onRuleContextMenu = (e: MouseEvent, service: MockService, group: MockServiceGroup, rule: MockRule) => {
  e.preventDefault();
  contextMenu.value = { visible: true, x: e.clientX, y: e.clientY };
  contextRule.value = rule;
  contextService.value = service;
  contextGroup.value = group;
};

const closeContextMenu = () => {
  contextMenu.value.visible = false;
};

const openCopyMoveDialog = (mode: 'copy' | 'move') => {
  copyMoveMode.value = mode;
  targetServiceId.value = null;
  targetGroupId.value = null;
  showCopyMoveDialog.value = true;
  closeContextMenu();
};

const confirmCopyMove = () => {
  if (!targetServiceId.value || !targetGroupId.value || !contextRule.value) return;
  if (copyMoveMode.value === 'copy') {
    emit('rule-copy', contextRule.value, targetServiceId.value, targetGroupId.value);
  } else {
    emit('rule-move', contextRule.value, contextService.value!, contextGroup.value!, targetServiceId.value, targetGroupId.value);
  }
  showCopyMoveDialog.value = false;
};

// --- 拖拽排序 ---
const dragRuleId = ref<number | null>(null);
const dragGroupId = ref<number | null>(null);
const dropTargetId = ref<number | null>(null);

const onDragStart = (e: DragEvent, group: MockServiceGroup, rule: MockRule) => {
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

const onDrop = (e: DragEvent, group: MockServiceGroup, targetRule: MockRule) => {
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

// --- 批量模式 ---
const batchMode = ref(false);
const selectedRuleIds = ref<Set<number>>(new Set());

const toggleBatchMode = () => {
  batchMode.value = !batchMode.value;
  if (!batchMode.value) selectedRuleIds.value.clear();
};

const toggleRuleSelection = (ruleId: number) => {
  if (selectedRuleIds.value.has(ruleId)) {
    selectedRuleIds.value.delete(ruleId);
  } else {
    selectedRuleIds.value.add(ruleId);
  }
};

const selectAllInGroup = (group: MockServiceGroup) => {
  group.children.forEach(r => selectedRuleIds.value.add(r.id));
};

const deselectAllInGroup = (group: MockServiceGroup) => {
  group.children.forEach(r => selectedRuleIds.value.delete(r.id));
};

const isAllSelectedInGroup = (group: MockServiceGroup) => {
  return group.children.length > 0 && group.children.every(r => selectedRuleIds.value.has(r.id));
};

const handleBatchAction = (action: string) => {
  if (selectedRuleIds.value.size === 0) return;
  emit('batch-action', action, Array.from(selectedRuleIds.value));
  if (action === 'delete') selectedRuleIds.value.clear();
};

// --- cURL 导入弹窗 ---
const showCurlImportDialog = ref(false);
const curlImportText = ref('');
const curlImportTargetService = ref<MockService | null>(null);
const curlImportTargetGroup = ref<MockServiceGroup | null>(null);

const openCurlImport = (service: MockService, group: MockServiceGroup) => {
  curlImportTargetService.value = service;
  curlImportTargetGroup.value = group;
  curlImportText.value = '';
  showCurlImportDialog.value = true;
};

const confirmCurlImport = () => {
  if (!curlImportText.value.trim() || !curlImportTargetService.value || !curlImportTargetGroup.value) return;
  emit('curl-import', curlImportTargetService.value, curlImportTargetGroup.value);
  showCurlImportDialog.value = false;
};

defineExpose({ focusSearch, curlImportText });

// --- 工具方法 ---
const methodTagType = (method: string) => {
  const map: Record<string, TagType> = {
    GET: 'primary', POST: 'success', PUT: 'warning', DELETE: 'danger'
  };
  return map[method] || 'info';
};

const isServiceRunning = (serviceId: number) => {
  return props.serviceStatusMap[String(serviceId)]?.running || false;
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
      <div class="header-actions">
        <el-button :type="batchMode ? 'warning' : 'info'" size="small" plain @click="toggleBatchMode" :title="batchMode ? '退出批量模式' : '批量操作'">
          {{ batchMode ? '退出' : '批量' }}
        </el-button>
      </div>
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

    <!-- 三层树结构：服务 → 分组 → 接口 -->
    <el-scrollbar>
      <div class="tree-wrapper">
        <template v-for="service in filteredServices" :key="service.id">
          <!-- 服务节点 -->
          <div class="tree-node service-node" @click="toggleService(service.id)">
            <el-icon class="tree-arrow" :class="{ expanded: isServiceExpanded(service.id) }"><ArrowRight /></el-icon>
            <span class="service-status-dot" :class="{ running: isServiceRunning(service.id) }"></span>
            <span class="service-name">{{ service.name }}</span>
            <el-tag size="small" effect="plain" type="info" class="port-tag">:{{ service.port }}</el-tag>
          </div>

          <!-- 分组层 -->
          <template v-if="isServiceExpanded(service.id)">
            <template v-for="(group, gIdx) in service.groups" :key="group.id">
              <!-- 分组节点 -->
              <div class="tree-node group-node" @click="toggleGroup(`${service.id}_${group.id}`)">
                <el-icon class="tree-arrow" :class="{ expanded: isGroupExpanded(`${service.id}_${group.id}`) }"><ArrowRight /></el-icon>
                <span class="group-name">{{ group.name }}</span>
                <span v-if="group.subPrefix" class="group-prefix">{{ group.subPrefix }}</span>
                <span class="group-count">({{ group.children.length }})</span>
                <div class="group-btns">
                  <el-button link type="primary" @click.stop="$emit('rule-add', service, group)" title="新增接口">
                    <el-icon><Plus /></el-icon>
                  </el-button>
                  <el-button link type="info" @click.stop="openCurlImport(service, group)" title="从 cURL 导入">
                    <el-icon><DocumentCopy /></el-icon>
                  </el-button>
                  <el-button link type="warning" @click.stop="$emit('group-rename', service, group)" title="重命名">
                    <el-icon><Edit /></el-icon>
                  </el-button>
                  <el-button link type="danger" @click.stop="$emit('group-delete', service, gIdx)" title="删除分组">
                    <el-icon><Delete /></el-icon>
                  </el-button>
                </div>
              </div>

              <!-- 接口层 -->
              <template v-if="isGroupExpanded(`${service.id}_${group.id}`)">
                <!-- 批量模式工具栏 -->
                <div v-if="batchMode" class="batch-group-bar" style="padding-left: 36px">
                  <el-button link size="small" @click="isAllSelectedInGroup(group) ? deselectAllInGroup(group) : selectAllInGroup(group)">
                    {{ isAllSelectedInGroup(group) ? '取消全选' : '全选' }}
                  </el-button>
                </div>

                <!-- 接口列表 -->
                <div
                  v-for="rule in group.children"
                  :key="rule.id"
                  class="tree-node rule-node"
                  :class="{ active: currentRuleId === rule.id && !batchMode, 'drop-target': dropTargetId === rule.id, disabled: !rule.active, selected: batchMode && selectedRuleIds.has(rule.id) }"
                  :draggable="!batchMode"
                  @click="batchMode ? toggleRuleSelection(rule.id) : $emit('rule-select', rule)"
                  @contextmenu="onRuleContextMenu($event, service, group, rule)"
                  @dragstart="!batchMode && onDragStart($event, group, rule)"
                  @dragover="!batchMode && onDragOver($event, rule)"
                  @dragleave="onDragLeave"
                  @drop="!batchMode && onDrop($event, group, rule)"
                  @dragend="onDragEnd"
                >
                  <el-checkbox v-if="batchMode" :model-value="selectedRuleIds.has(rule.id)" @click.stop @change="toggleRuleSelection(rule.id)" size="small" style="margin-right: 4px" />
                  <el-tag size="small" :type="methodTagType(rule.method)" effect="dark" class="method-tag">{{ rule.method }}</el-tag>
                  <div class="rule-info">
                    <span v-if="rule.name" class="rule-name" :title="rule.name">{{ rule.name }}</span>
                    <span class="rule-url" :class="{ 'is-sub': !!rule.name }" :title="rule.url">{{ rule.url }}</span>
                  </div>
                  <div v-if="!batchMode" class="rule-actions">
                    <el-button link type="danger" size="small" class="del-btn" @click.stop="$emit('rule-delete', service, group, rule)" title="删除接口">
                      <el-icon><Delete /></el-icon>
                    </el-button>
                    <el-switch v-model="rule.active" size="small" @change="$emit('rule-toggle')" @click.stop />
                  </div>
                </div>
                <div v-if="!group.children.length" class="empty-tip" style="padding-left: 36px">暂无接口，点击 + 新建</div>
              </template>
            </template>
          </template>
        </template>

        <!-- 搜索无结果 -->
        <div v-if="searchKeyword && !filteredServices.length" class="empty-tip">未找到匹配的接口，试试调整关键词</div>
        <!-- 服务为空 -->
        <div v-if="!searchKeyword && !filteredServices.length" class="empty-tip">暂无服务，请先在「服务」模块中创建</div>
      </div>
    </el-scrollbar>

    <!-- 右键菜单 -->
    <Teleport to="body">
      <div
        v-if="contextMenu.visible"
        class="context-menu"
        :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
      >
        <div class="context-menu-item" @click="() => { if (contextService && contextGroup && contextRule) { $emit('rule-clone', contextRule, contextService, contextGroup); closeContextMenu(); } }">
          <el-icon><DocumentCopy /></el-icon> 复制接口
        </div>
        <div class="context-menu-item" @click="openCopyMoveDialog('copy')">
          <el-icon><DocumentCopy /></el-icon> 复制到其他分组
        </div>
        <div class="context-menu-item" @click="openCopyMoveDialog('move')">
          <el-icon><Rank /></el-icon> 移动到其他分组
        </div>
        <div class="context-menu-divider"></div>
        <div class="context-menu-item danger" @click="() => { if (contextService && contextGroup && contextRule) { $emit('rule-delete', contextService, contextGroup, contextRule); closeContextMenu(); } }">
          <el-icon><Delete /></el-icon> 删除接口
        </div>
      </div>
    </Teleport>

    <!-- 批量操作栏 -->
    <div v-if="batchMode && selectedRuleIds.size > 0" class="batch-actions-bar">
      <span class="batch-count">已选 {{ selectedRuleIds.size }} 个</span>
      <el-button type="success" size="small" plain @click="handleBatchAction('enable')">启用</el-button>
      <el-button type="warning" size="small" plain @click="handleBatchAction('disable')">禁用</el-button>
      <el-button type="danger" size="small" plain @click="handleBatchAction('delete')">删除</el-button>
    </div>

    <!-- 复制/移动对话框 -->
    <el-dialog v-model="showCopyMoveDialog" :title="copyMoveMode === 'copy' ? '复制到分组' : '移动到分组'" width="360px" destroy-on-close>
      <el-select v-model="targetGroupId" placeholder="选择目标分组" style="width: 100%">
        <el-option-group v-for="s in services" :key="s.id" :label="s.name">
          <el-option
            v-for="g in s.groups.filter(g => !(g.id === contextGroup?.id && s.id === contextService?.id))"
            :key="g.id"
            :label="`${s.name} / ${g.name}`"
            :value="g.id"
          >
            <template #default>
              <span @click="targetServiceId = s.id">{{ g.name }}</span>
            </template>
          </el-option>
        </el-option-group>
      </el-select>
      <template #footer>
        <el-button @click="showCopyMoveDialog = false">取消</el-button>
        <el-button type="primary" @click="confirmCopyMove" :disabled="!targetGroupId">确定</el-button>
      </template>
    </el-dialog>

    <!-- cURL 导入弹窗 -->
    <el-dialog v-model="showCurlImportDialog" title="从 cURL 导入接口" width="500px" destroy-on-close>
      <el-input
        v-model="curlImportText"
        type="textarea"
        :rows="8"
        placeholder="粘贴 cURL 命令，例如:&#10;curl -X POST https://api.example.com/users \&#10;  -H 'Content-Type: application/json' \&#10;  -d '{&quot;name&quot;: &quot;test&quot;}'"
      />
      <template #footer>
        <el-button @click="showCurlImportDialog = false">取消</el-button>
        <el-button type="primary" @click="confirmCurlImport" :disabled="!curlImportText.trim()">导入</el-button>
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

/* 树结构容器 */
.tree-wrapper { padding: 4px 6px; }

/* 通用树节点 */
.tree-node {
  display: flex;
  align-items: center;
  height: 28px;
  cursor: pointer;
  border-radius: 4px;
  transition: background 0.15s;
  user-select: none;
  gap: 4px;
}
.tree-node:hover {
  background: var(--bg-hover);
}

/* 箭头图标 */
.tree-arrow {
  font-size: 12px;
  color: var(--text-secondary);
  transition: transform 0.2s;
  flex-shrink: 0;
}
.tree-arrow.expanded {
  transform: rotate(90deg);
}

/* 服务节点 */
.service-node {
  padding-left: 4px;
  font-weight: 600;
}
.service-status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #909399;
  flex-shrink: 0;
}
.service-status-dot.running {
  background: #67c23a;
}
.service-name {
  font-size: 13px;
  color: var(--text-primary);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.port-tag {
  flex-shrink: 0;
  margin-right: 4px;
}

/* 分组节点 */
.group-node {
  padding-left: 20px;
  font-weight: 500;
}
.group-name {
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.group-prefix {
  font-size: 10px;
  color: var(--text-secondary);
  font-weight: 400;
  margin-left: 4px;
  opacity: 0.7;
}
.group-count {
  font-size: 11px;
  color: var(--text-secondary);
  font-weight: 400;
  margin-left: 2px;
  flex-shrink: 0;
}
.group-btns {
  display: none;
  margin-left: auto;
  flex-shrink: 0;
}
.group-node:hover .group-btns {
  display: flex;
}

/* 接口节点 */
.rule-node {
  padding-left: 36px;
  padding-right: 6px;
  border: 1px solid transparent;
}
.rule-node.active {
  background: var(--primary-bg);
}
.rule-node.disabled {
  opacity: 0.5;
}
.rule-node.disabled .rule-url {
  text-decoration: line-through;
}
.rule-node.drop-target {
  border-color: var(--primary-color);
  border-style: dashed;
}
.rule-node.selected {
  background: var(--primary-bg);
  border-color: var(--primary-color);
}

.method-tag {
  width: 38px;
  justify-content: center;
  font-weight: bold;
  border: none;
  font-size: 10px;
  flex-shrink: 0;
}
.rule-info {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 0;
  min-width: 0;
}
.rule-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.3;
}
.rule-node.active .rule-name {
  color: var(--primary-color);
}
.rule-url {
  font-size: 11px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.3;
}
.rule-url.is-sub {
  font-size: 10px;
  opacity: 0.7;
}
.rule-node.active .rule-url {
  color: var(--primary-color);
}
.rule-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}
.del-btn {
  opacity: 0;
  transition: opacity 0.2s;
  padding: 0;
}
.rule-node:hover .del-btn {
  opacity: 1;
}

.empty-tip {
  text-align: center;
  color: var(--text-secondary);
  font-size: 12px;
  padding: 8px;
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

/* 头部操作按钮组 */
.header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

/* 批量操作栏 */
.batch-actions-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-top: 1px solid var(--border-color);
  background: var(--bg-hover);
  flex-shrink: 0;
}
.batch-count {
  font-size: 12px;
  color: var(--text-secondary);
  margin-right: auto;
}
.batch-group-bar {
  padding: 2px 8px;
  display: flex;
  justify-content: flex-end;
}
</style>
