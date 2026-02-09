<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import GroupSidebar from './GroupSidebar.vue';
import RuleEditor from './RuleEditor.vue';
import type { MockGroup, MockRule } from '@/types/mock'; // 确保路径指向你的 src/types.ts
import ServiceConfigPanel from './ServiceConfig.vue';

// 后端服务地址
const API_BASE = 'http://localhost:3000';
const groups = ref<MockGroup[]>([]);

// 视图控制状态
const configGroupId = ref<number | null>(null); // 当前正在配置的分组 ID
const currentRuleId = ref<number | null>(null);

const editingRule = ref<Partial<MockRule>>({}); // 编辑中的规则，可能不完整所以用 Partial
const testResult = ref<string>('');

// --- 数据交互 ---

// 加载数据
const loadData = async () => {
  try {
    const res = await fetch(`${API_BASE}/_admin/rules`);
    if (!res.ok) throw new Error('Network response was not ok');

    // 类型断言：告诉 TS 返回的数据结构
    const data = (await res.json()) as MockGroup[];
    groups.value = Array.isArray(data) ? data : [];
  } catch (e) {
    console.error(e);
    ElMessage.error('无法连接 Mock 服务器，请检查插件是否运行正常');
  }
};

// 保存数据 (持久化到后端)
const saveData = async () => {
  try {
    await fetch(`${API_BASE}/_admin/rules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(groups.value)
    });
  } catch (e) {
    ElMessage.error('保存失败');
  }
};

// --- 业务逻辑：分组管理 ---

const handleAddGroup = () => {
  ElMessageBox.prompt('请输入分组名称', '新建分组', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
  }).then(({ value }: any) => {
    if (!value) return;
    const newGroup: MockGroup = {
      id: Date.now(),
      name: value,
      children: []
    };
    groups.value.push(newGroup);
    saveData();
    ElMessage.success('分组已创建');
  }).catch(() => {});
};

const handleRenameGroup = (group: MockGroup) => {
  ElMessageBox.prompt('请输入新名称', '重命名', {
    inputValue: group.name,
    confirmButtonText: '保存',
  }).then(({ value }: any) => {
    if (value) {
      group.name = value;
      saveData();
      ElMessage.success('重命名成功');
    }
  }).catch(() => {});
};

const handleDeleteGroup = (idx: number) => {
  ElMessageBox.confirm('确定删除该分组及其下所有接口吗？', '警告', {
    type: 'warning',
    confirmButtonText: '确定删除',
    cancelButtonText: '取消'
  }).then(() => {
    // 如果当前选中的接口属于该分组，清空选中状态
    const groupToDelete = groups.value[idx];
    if (currentRuleId.value && groupToDelete.children.some(r => r.id === currentRuleId.value)) {
      currentRuleId.value = null;
      editingRule.value = {};
    }

    groups.value.splice(idx, 1);
    saveData();
    ElMessage.success('分组已删除');
  }).catch(() => {});
};

// 点击分组配置
const handleGroupConfig = (group: MockGroup) => {
  configGroupId.value = group.id;
  currentRuleId.value = null; // 互斥：清空接口选中
};

// 更新分组信息（从配置页回调）
const handleUpdateGroup = (updatedGroup: MockGroup) => {
  const idx = groups.value.findIndex(g => g.id === updatedGroup.id);
  if (idx !== -1) {
    groups.value[idx] = updatedGroup;
    // 注意：saveData 由组件事件触发，这里只更新本地状态
  }
};

// --- 业务逻辑：接口规则管理 ---

const handleAddRule = (group: MockGroup) => {
  const newRule: MockRule = {
    id: Date.now(),
    active: true,
    method: 'GET',
    url: '/api/new',
    response: '{\n  "code": 200,\n  "msg": "Hello World"\n}',
    delay: 0
  };
  group.children.push(newRule);

  // 自动选中新创建的规则
  handleSelectRule(newRule);
  saveData();
};

const handleSelectRule = (rule: MockRule) => {
  currentRuleId.value = rule.id;
  configGroupId.value = null; // 互斥：清空分组配置
  // 深拷贝，防止在编辑器修改时直接影响列表显示（直到点击保存）
  editingRule.value = JSON.parse(JSON.stringify(rule));
  testResult.value = ''; // 切换接口时清空测试结果
};

const handleToggleRule = () => {
  // 开关状态改变直接保存
  saveData();
};

const handleSaveRule = () => {
  // 遍历查找当前规则所属的分组和索引
  for (const group of groups.value) {
    const idx = group.children.findIndex(r => r.id === currentRuleId.value);
    if (idx !== -1) {
      // 更新规则数据 (合并 editingRule 到原对象)
      group.children[idx] = {
        ...group.children[idx],
        ...(editingRule.value as MockRule)
      };
      saveData();
      ElMessage.success('保存成功');
      return;
    }
  }
};

const handleDeleteRule = () => {
  ElMessageBox.confirm('确定删除当前接口吗？', '提示', {
    type: 'warning',
    confirmButtonText: '删除',
    cancelButtonText: '取消'
  }).then(() => {
    for (const group of groups.value) {
      const idx = group.children.findIndex(r => r.id === currentRuleId.value);
      if (idx !== -1) {
        group.children.splice(idx, 1);
        currentRuleId.value = null;
        editingRule.value = {};
        saveData();
        ElMessage.success('接口已删除');
        return;
      }
    }
  }).catch(() => {});
};

// --- 业务逻辑：接口测试 ---

const handleRunTest = async () => {
  if (!editingRule.value.url) return;

  testResult.value = 'Requesting...';
  try {
    const start = Date.now();
    // 拼接完整 URL 发起请求
    const res = await fetch(API_BASE + editingRule.value.url, {
      method: editingRule.value.method
    });

    const ms = Date.now() - start;
    const text = await res.text();

    // 尝试格式化 JSON 显示
    let displayBody = text;
    try {
      displayBody = JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      // 保持纯文本
    }

    testResult.value = `[Status: ${res.status}] [Time: ${ms}ms]\n\n${displayBody}`;
  } catch (e: any) {
    testResult.value = `Request Error: ${e.message}`;
  }
};

// 初始化
onMounted(() => {
  loadData();
});
</script>

<template>
  <el-container class="full-height">
    <GroupSidebar
        :groups="groups"
        :currentRuleId="currentRuleId"
        @group-add="handleAddGroup"
        @group-rename="handleRenameGroup"
        @group-delete="handleDeleteGroup"
        @group-config="handleGroupConfig"
        @rule-add="handleAddRule"
        @rule-select="handleSelectRule"
        @rule-toggle="handleToggleRule"
    />

    <ServiceConfigPanel
        v-if="configGroupId"
        :group="groups.find(g => g.id === configGroupId)!"
        @update:group="handleUpdateGroup"
        @save="saveData"
    />

    <RuleEditor
        v-else-if="currentRuleId"
        v-model="editingRule"
        :testResult="testResult"
        :hasSelection="true"
        @save="handleSaveRule"
        @delete="handleDeleteRule"
        @test="handleRunTest"
    />

    <el-main v-else class="empty-container">
      <el-empty description="请点击分组设置或选择接口" />
    </el-main>
  </el-container>
</template>

<style scoped>
.full-height { height: 100%; overflow: hidden; }
.empty-container {
  display: flex; justify-content: center; align-items: center;
  height: 100%; background: var(--bg-card);
}
</style>