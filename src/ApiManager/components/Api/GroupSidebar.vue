<script setup lang="ts">
import { ref, watch } from 'vue';
import { Plus, Edit, Delete, Setting } from '@element-plus/icons-vue';
import type { MockGroup, MockRule } from '@/types/mock';
import { TagType } from "@/types/groupSideBar";

const props = defineProps<{
  groups: MockGroup[];
  currentRuleId: number | null;
}>();

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
      <el-button type="primary" size="small" :icon="Plus" circle @click="$emit('group-add')" title="新建分组" />
    </div>
    <el-scrollbar>
      <div class="group-wrapper">
        <el-collapse v-model="activeGroupNames">
          <el-collapse-item v-for="(group, idx) in groups" :key="group.id" :name="group.id">
            <template #title>
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
                  <el-button link type="danger" @click.stop="$emit('group-delete', idx)" title="删除分组">
                    <el-icon><Delete /></el-icon>
                  </el-button>
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
                <span class="rule-url" :title="rule.url">{{ rule.url }}</span>
              </div>

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
.rule-url {
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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