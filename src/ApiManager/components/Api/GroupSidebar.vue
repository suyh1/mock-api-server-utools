<script setup lang="ts">
import { ref, watch } from 'vue';
import { Plus, Edit, Delete, Setting } from '@element-plus/icons-vue';
import type { MockGroup, MockRule } from '@/types/mock';
import {TagType} from "@/types/groupSideBar";

// 定义 Props (使用 TS 泛型语法)
const props = defineProps<{
  groups: MockGroup[];
  currentRuleId: number | null;
}>();

// 定义 Emits
const emit = defineEmits<{
  (e: 'group-add'): void;
  (e: 'group-rename', group: MockGroup): void;
  (e: 'group-delete', idx: number): void;
  (e: 'rule-add', group: MockGroup): void;
  (e: 'rule-select', rule: MockRule): void;
  (e: 'rule-toggle'): void;
  (e: 'group-config', group: MockGroup): void; // 新增配置事件
}>();

const activeGroupNames = ref<number[]>([]);

watch(() => props.groups, (newVal) => {
  if (newVal && activeGroupNames.value.length === 0) {
    activeGroupNames.value = newVal.map(g => g.id);
  }
}, { immediate: true });

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
  <el-aside width="300px" class="inner-sidebar">
    <div class="inner-header">
      <span class="title">Mock 接口列表</span>
      <el-button type="primary" size="small" :icon="Plus" circle @click="$emit('group-add')" />
    </div>
    <el-scrollbar>
      <div class="group-wrapper">
        <el-collapse v-model="activeGroupNames">
          <el-collapse-item v-for="(group, idx) in groups" :key="group.id" :name="group.id">
            <template #title>
              <div class="group-title-content">
                <span class="group-name">{{ group.name }}</span>
                <div class="group-btns">
                  <el-button link type="primary" @click.stop="$emit('rule-add', group)" title="新增接口"><el-icon><Plus /></el-icon></el-button>
                  <el-button link type="warning" @click.stop="$emit('group-rename', group)" title="编辑分组名称"><el-icon><Edit /></el-icon></el-button>
                  <el-button link type="danger" @click.stop="$emit('group-delete', idx)" title="删除分组"><el-icon><Delete /></el-icon></el-button>
                  <el-button link type="primary" @click.stop="$emit('group-config', group)" title="服务配置"><el-icon><Setting /></el-icon></el-button>
                </div>
              </div>
            </template>
            <div
                v-for="rule in group.children"
                :key="rule.id"
                class="rule-item"
                :class="{ active: currentRuleId === rule.id }"
                @click="$emit('rule-select', rule)"
            >
              <div class="rule-left">
                <el-tag size="small" :type="methodTagType(rule.method)" effect="dark" class="method-tag">{{ rule.method }}</el-tag>
                <span class="rule-url">{{ rule.url }}</span>
              </div>
              <el-switch
                  v-model="rule.active"
                  size="small"
                  @change="$emit('rule-toggle')"
                  @click.stop
              />
            </div>
            <div v-if="!group.children.length" class="empty-tip">暂无接口</div>
          </el-collapse-item>
        </el-collapse>
      </div>
    </el-scrollbar>
  </el-aside>
</template>

<style scoped>
.inner-sidebar {
  display: flex;
  flex-direction: column;
  background-color: transparent;
  border-right: 1px solid var(--border-color); /* 适配深色边框 */
  height: 100%;
}
.inner-header {
  height: 50px;
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
  border-radius: 4px;
  cursor: pointer;
  background: transparent; /* 默认透明 */
  border: 1px solid transparent;
}
.rule-item:hover {
  background: var(--bg-hover);
}
.rule-item.active {
  background: var(--primary-bg);
  color: var(--primary-color);
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
}
.rule-url {
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.empty-tip {
  text-align: center;
  color: var(--text-secondary);
  font-size: 12px;
  padding: 10px;
}
</style>