<script setup>
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import GroupSidebar from './GroupSidebar.vue';
import RuleEditor from './RuleEditor.vue';

const API_BASE = 'http://localhost:3000';

const groups = ref([]);
const currentRuleId = ref(null);
const editingRule = ref({});
const testResult = ref('');

// --- 数据同步 ---
const loadData = async () => {
  try {
    const res = await fetch(`${API_BASE}/_admin/rules`);
    const data = await res.json();
    groups.value = Array.isArray(data) ? data : [];
  } catch (e) {
    ElMessage.error('无法连接 Mock 服务器');
  }
};

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

// --- 业务逻辑 (Group) ---
const handleAddGroup = () => {
  ElMessageBox.prompt('请输入分组名称', '新建分组').then(({ value }) => {
    if (!value) return;
    groups.value.push({ id: Date.now(), name: value, children: [] });
    saveData();
  }).catch(() => {});
};

const handleRenameGroup = (group) => {
  ElMessageBox.prompt('新名称', '重命名', { inputValue: group.name }).then(({ value }) => {
    if (value) {
      group.name = value;
      saveData();
    }
  }).catch(() => {});
};

const handleDeleteGroup = (idx) => {
  ElMessageBox.confirm('确定删除该分组及其下所有接口吗？', '警告', { type: 'warning' }).then(() => {
    if (groups.value[idx].children.some(r => r.id === currentRuleId.value)) {
      currentRuleId.value = null;
    }
    groups.value.splice(idx, 1);
    saveData();
  }).catch(() => {});
};

// --- 业务逻辑 (Rule) ---
const handleAddRule = (group) => {
  const newRule = {
    id: Date.now(),
    active: true,
    method: 'GET',
    url: '/api/new',
    response: '{\n  "code": 200,\n  "msg": "OK"\n}',
    delay: 0
  };
  group.children.push(newRule);
  handleSelectRule(newRule);
  saveData();
};

const handleSelectRule = (rule) => {
  currentRuleId.value = rule.id;
  // 深拷贝到编辑对象
  editingRule.value = JSON.parse(JSON.stringify(rule));
  testResult.value = '';
};

const handleToggleRule = () => {
  saveData();
};

const handleSaveRule = () => {
  for (const group of groups.value) {
    const idx = group.children.findIndex(r => r.id === currentRuleId.value);
    if (idx !== -1) {
      group.children[idx] = { ...editingRule.value };
      saveData();
      ElMessage.success('保存成功');
      return;
    }
  }
};

const handleDeleteRule = () => {
  ElMessageBox.confirm('确定删除当前接口吗？', '提示', { type: 'warning' }).then(() => {
    for (const group of groups.value) {
      const idx = group.children.findIndex(r => r.id === currentRuleId.value);
      if (idx !== -1) {
        group.children.splice(idx, 1);
        currentRuleId.value = null;
        saveData();
        return;
      }
    }
  }).catch(() => {});
};

const handleRunTest = async () => {
  testResult.value = 'Requesting...';
  try {
    const start = Date.now();
    const res = await fetch(API_BASE + editingRule.value.url, {
      method: editingRule.value.method
    });
    const ms = Date.now() - start;
    const text = await res.text();
    let display = text;
    try { display = JSON.stringify(JSON.parse(text), null, 2); } catch {}
    testResult.value = `[Status: ${res.status}] [Time: ${ms}ms]\n\n${display}`;
  } catch (e) {
    testResult.value = `Error: ${e.message}`;
  }
};

onMounted(loadData);
</script>

<template>
  <el-container class="full-height">
    <GroupSidebar
        :groups="groups"
        :currentRuleId="currentRuleId"
        @group-add="handleAddGroup"
        @group-rename="handleRenameGroup"
        @group-delete="handleDeleteGroup"
        @rule-add="handleAddRule"
        @rule-select="handleSelectRule"
        @rule-toggle="handleToggleRule"
    />

    <RuleEditor
        v-model="editingRule"
        :testResult="testResult"
        :hasSelection="!!currentRuleId"
        @save="handleSaveRule"
        @delete="handleDeleteRule"
        @test="handleRunTest"
    />
  </el-container>
</template>

<style scoped>
.full-height { height: 100%; }
</style>