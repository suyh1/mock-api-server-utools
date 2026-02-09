<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import GroupSidebar from './GroupSidebar.vue';
import RuleEditor from './RuleEditor.vue';
import ServiceConfigPanel from './ServiceConfig.vue';
import type { MockGroup, MockRule } from '@/types/mock';

const localIp = ref('localhost');
const API_BASE = ref('http://localhost:3000'); // 默认值
const groups = ref<MockGroup[]>([]);

// 视图状态
const currentRuleId = ref<number | null>(null);
const configGroupId = ref<number | null>(null);
const editingRule = ref<Partial<MockRule>>({});
const testResult = ref<string>('');

// ... loadData, saveData 保持不变 ...
const loadData = async () => { try { const res = await fetch(`${API_BASE.value}/_admin/rules`); if (!res.ok) throw new Error(); const data = (await res.json()) as MockGroup[]; groups.value = Array.isArray(data) ? data : []; } catch (e) { console.error(e); ElMessage.error('无法连接 Mock 服务器'); } };
const saveData = async () => { try { await fetch(`${API_BASE.value}/_admin/rules`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(groups.value) }); } catch (e) { ElMessage.error('保存失败'); } };

// ... 分组操作逻辑保持不变 ...
const handleAddGroup = () => { ElMessageBox.prompt('请输入分组名称', '新建分组').then(({ value }: any) => { if (!value) return; groups.value.push({ id: Date.now(), name: value, children: [] }); saveData(); }).catch(() => {}); };
const handleRenameGroup = (group: MockGroup) => { ElMessageBox.prompt('请输入新名称', '重命名', { inputValue: group.name }).then(({ value }: any) => { if (value) { group.name = value; saveData(); } }).catch(() => {}); };
const handleDeleteGroup = (idx: number) => { ElMessageBox.confirm('确定删除该分组及其下所有接口吗？', '警告', { type: 'warning' }).then(() => { if (groups.value[idx].children.some(r => r.id === currentRuleId.value)) { currentRuleId.value = null; editingRule.value = {}; } groups.value.splice(idx, 1); saveData(); }).catch(() => {}); };
const handleGroupConfig = (group: MockGroup) => { configGroupId.value = group.id; currentRuleId.value = null; };

// --- 接口操作逻辑 ---

const handleAddRule = (group: MockGroup) => {
  const newRule: MockRule = {
    id: Date.now(),
    active: true,
    method: 'GET',
    url: '/api/new',
    response: '{\n  "code": 200,\n  "msg": "Hello World"\n}',
    delay: 0,

    // --- 新增：必须初始化这些字段 ---
    headers: [],        // 初始化为空数组
    params: [],         // 初始化为空数组
    responseHeaders: [],// 初始化为空数组
    body: {             // 初始化默认 body 结构
      type: 'none',
      raw: '',
      formData: []
    }
  };
  group.children.push(newRule);
  handleSelectRule(newRule);
  saveData();
};

const handleSelectRule = (rule: MockRule) => {
  currentRuleId.value = rule.id;
  configGroupId.value = null;
  editingRule.value = JSON.parse(JSON.stringify(rule));
  testResult.value = '';
};

const handleToggleRule = () => { saveData(); };

const handleSaveRule = () => {
  for (const group of groups.value) {
    const idx = group.children.findIndex(r => r.id === currentRuleId.value);
    if (idx !== -1) {
      group.children[idx] = { ...group.children[idx], ...(editingRule.value as MockRule) };
      saveData();
      ElMessage.success('保存成功');
      return;
    }
  }
};

// 【更新】删除接口 (现在由 Sidebar 传入 group 和 rule)
const handleDeleteRule = (group: MockGroup, rule: MockRule) => {
  ElMessageBox.confirm('确定删除该接口吗？', '提示', {
    type: 'warning',
    confirmButtonText: '删除',
    cancelButtonText: '取消'
  }).then(() => {
    const idx = group.children.findIndex(r => r.id === rule.id);
    if (idx !== -1) {
      group.children.splice(idx, 1);
      // 如果删除的是当前选中的接口，清空编辑器
      if (currentRuleId.value === rule.id) {
        currentRuleId.value = null;
        editingRule.value = {};
      }
      saveData();
      ElMessage.success('接口已删除');
    }
  }).catch(() => {});
};

// 【新增】复制当前编辑器中的接口 URL
const handleCopyCurrentUrl = () => {
  // 找到当前选中规则所属的分组
  const group = groups.value.find(g => g.children.some(r => r.id === currentRuleId.value));
  if (group && editingRule.value.url) {
    const port = group.config?.port || 3000;

    let prefix = group.config?.prefix || '';
    if (prefix && !prefix.startsWith('/')) prefix = '/' + prefix;
    if (prefix && prefix.endsWith('/')) prefix = prefix.slice(0, -1);

    let urlPath = editingRule.value.url;
    if (!urlPath.startsWith('/')) urlPath = '/' + urlPath;

    const fullUrl = `http://${localIp.value}:${port}${prefix}${urlPath}`;

    navigator.clipboard.writeText(fullUrl).then(() => {
      ElMessage.success(`已复制: ${fullUrl}`);
    }).catch(() => {
      ElMessage.error('复制失败');
    });
  }
};

const handleUpdateGroup = (updatedGroup: MockGroup) => {
  const idx = groups.value.findIndex(g => g.id === updatedGroup.id);
  if (idx !== -1) groups.value[idx] = updatedGroup;
};

// ... runTest 保持不变 ...
const handleRunTest = async () => { if (!editingRule.value.url) return; testResult.value = 'Requesting...'; try { const res = await fetch(API_BASE.value + editingRule.value.url, { method: editingRule.value.method }); const text = await res.text(); try { testResult.value = JSON.stringify(JSON.parse(text), null, 2); } catch { testResult.value = text; } } catch (e: any) { testResult.value = `Error: ${e.message}`; } };

onMounted(() => {
  // 1. 初始化 IP 和 API 地址
  if (window.services) {
    localIp.value = window.services.getLocalIP();
    API_BASE.value = window.services.getServerUrl();
  }
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
        @rule-delete="handleDeleteRule"
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
        @copy="handleCopyCurrentUrl"
        @test="handleRunTest"
    />

    <el-main v-else class="empty-container">
      <el-empty description="请选择接口或配置服务" />
    </el-main>

  </el-container>
</template>

<style scoped>
.full-height { height: 100%; overflow: hidden; }
.empty-container { display: flex; justify-content: center; align-items: center; height: 100%; background: var(--bg-card); }
</style>