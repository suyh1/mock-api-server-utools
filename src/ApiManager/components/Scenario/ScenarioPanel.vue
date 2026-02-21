<script setup lang="ts">
import { ref, computed, onMounted, inject } from 'vue';
import { Plus, RefreshRight } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { MockGroup, MockRule, ResponsePreset, ResponseMode } from '@/types/mock';

const API_BASE = ref('http://localhost:3000');
const groups = ref<MockGroup[]>([]);

onMounted(() => {
  if (window.services) {
    API_BASE.value = window.services.getServerUrl();
  }
  loadData();
});

async function loadData() {
  try {
    const res = await fetch(`${API_BASE.value}/_admin/rules`);
    if (!res.ok) throw new Error();
    groups.value = await res.json();
  } catch {
    ElMessage.error('加载数据失败');
  }
}

async function saveData() {
  try {
    await fetch(`${API_BASE.value}/_admin/rules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(groups.value),
    });
  } catch {
    ElMessage.error('保存失败');
  }
}

function methodTagType(method: string) {
  const map: Record<string, string> = { GET: 'success', POST: 'warning', PUT: '', DELETE: 'danger' };
  return map[method] || 'info';
}

function getActivePresetId(rule: MockRule): number | undefined {
  return rule.activePresetId;
}

function setActivePreset(rule: MockRule, presetId: number | undefined) {
  rule.activePresetId = presetId;
  saveData();
  const label = presetId
    ? rule.responsePresets?.find(p => p.id === presetId)?.name || '预设'
    : '默认';
  ElMessage.success(`已切换到「${label}」`);
}

function resetAll() {
  ElMessageBox.confirm('确定将所有接口恢复为默认响应吗？', '提示', { type: 'warning' }).then(() => {
    groups.value.forEach(g => {
      g.children.forEach(r => {
        r.activePresetId = undefined;
      });
    });
    saveData();
    ElMessage.success('已全部恢复默认');
  }).catch(() => {});
}

// 快速创建预设
interface QuickPreset {
  name: string;
  statusCode: number;
  body: string;
}

const quickPresets: QuickPreset[] = [
  { name: '成功响应', statusCode: 200, body: '{"code":200,"msg":"success","data":{}}' },
  { name: '空数据', statusCode: 200, body: '{"code":200,"msg":"success","data":null}' },
  { name: '参数错误', statusCode: 400, body: '{"code":400,"msg":"参数错误"}' },
  { name: '未授权', statusCode: 401, body: '{"code":401,"msg":"未授权，请登录"}' },
  { name: '服务器错误', statusCode: 500, body: '{"code":500,"msg":"服务器内部错误"}' },
];

function addQuickPreset(rule: MockRule, qp: QuickPreset) {
  if (!rule.responsePresets) rule.responsePresets = [];
  const preset: ResponsePreset = {
    id: Date.now(),
    name: qp.name,
    statusCode: qp.statusCode,
    responseMode: 'basic',
    responseType: 'application/json',
    responseBasic: qp.body,
    responseAdvanced: '',
  };
  rule.responsePresets.push(preset);
  saveData();
  ElMessage.success(`已添加预设「${qp.name}」`);
}

// 自定义预设对话框
const dialogVisible = ref(false);
const editingRule = ref<MockRule | null>(null);
const presetForm = ref<Partial<ResponsePreset>>({
  name: '',
  statusCode: 200,
  responseMode: 'basic',
  responseType: 'application/json',
  responseBasic: '{}',
  responseAdvanced: '',
});

function openCustomDialog(rule: MockRule) {
  editingRule.value = rule;
  presetForm.value = {
    name: '',
    statusCode: 200,
    responseMode: 'basic',
    responseType: 'application/json',
    responseBasic: '{}',
    responseAdvanced: '',
  };
  dialogVisible.value = true;
}

function saveCustomPreset() {
  if (!editingRule.value || !presetForm.value.name) {
    ElMessage.warning('请输入预设名称');
    return;
  }
  if (!editingRule.value.responsePresets) editingRule.value.responsePresets = [];
  editingRule.value.responsePresets.push({
    id: Date.now(),
    name: presetForm.value.name!,
    statusCode: presetForm.value.statusCode || 200,
    responseMode: presetForm.value.responseMode as ResponseMode || 'basic',
    responseType: presetForm.value.responseType || 'application/json',
    responseBasic: presetForm.value.responseBasic || '{}',
    responseAdvanced: presetForm.value.responseAdvanced || '',
  });
  saveData();
  dialogVisible.value = false;
  ElMessage.success('预设已添加');
}

function deletePreset(rule: MockRule, presetId: number) {
  if (!rule.responsePresets) return;
  rule.responsePresets = rule.responsePresets.filter(p => p.id !== presetId);
  if (rule.activePresetId === presetId) rule.activePresetId = undefined;
  saveData();
}

const groupsWithRules = computed(() => groups.value.filter(g => g.children.length > 0));
</script>

<template>
  <div class="scenario-panel">
    <div class="panel-header">
      <div class="header-left">
        <span class="title">场景管理</span>
      </div>
      <div class="header-right">
        <el-button size="small" plain :icon="RefreshRight" @click="resetAll">全部恢复默认</el-button>
      </div>
    </div>

    <div class="panel-body">
      <div v-if="groupsWithRules.length === 0" class="empty-state">
        <el-empty description="暂无接口数据" />
      </div>

      <div v-for="group in groupsWithRules" :key="group.id" class="group-section">
        <div class="group-title">{{ group.name }}</div>

        <div v-for="rule in group.children" :key="rule.id" class="rule-row">
          <div class="rule-info">
            <el-tag size="small" :type="methodTagType(rule.method)">{{ rule.method }}</el-tag>
            <span class="rule-name">{{ rule.name || rule.url }}</span>
            <span v-if="rule.name" class="rule-url">{{ rule.url }}</span>
          </div>

          <div class="rule-presets">
            <el-radio-group
              :model-value="getActivePresetId(rule) ?? 0"
              size="small"
              @change="(val: number) => setActivePreset(rule, val === 0 ? undefined : val)"
            >
              <el-radio-button :value="0">默认</el-radio-button>
              <el-radio-button
                v-for="preset in (rule.responsePresets || [])"
                :key="preset.id"
                :value="preset.id"
              >
                {{ preset.name }}
                <span class="preset-status">({{ preset.statusCode }})</span>
              </el-radio-button>
            </el-radio-group>

            <el-dropdown trigger="click" @command="(cmd: string) => {
              if (cmd === 'custom') { openCustomDialog(rule); }
              else { addQuickPreset(rule, quickPresets[Number(cmd)]); }
            }">
              <el-button size="small" :icon="Plus" circle />
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item v-for="(qp, i) in quickPresets" :key="i" :command="String(i)">
                    {{ qp.name }} ({{ qp.statusCode }})
                  </el-dropdown-item>
                  <el-dropdown-item divided command="custom">自定义预设...</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>

          <!-- 已有预设的删除按钮 -->
          <div v-if="rule.responsePresets?.length" class="preset-actions">
            <el-popconfirm
              v-for="preset in rule.responsePresets"
              :key="preset.id"
              :title="`删除预设「${preset.name}」？`"
              @confirm="deletePreset(rule, preset.id)"
            >
              <template #reference>
                <el-tag size="small" closable type="info" class="preset-tag" @close.prevent>
                  {{ preset.name }}
                </el-tag>
              </template>
            </el-popconfirm>
          </div>
        </div>
      </div>
    </div>

    <!-- 自定义预设对话框 -->
    <el-dialog v-model="dialogVisible" title="自定义预设" width="500px">
      <el-form label-width="90px" size="small">
        <el-form-item label="预设名称">
          <el-input v-model="presetForm.name" placeholder="如：超时响应" />
        </el-form-item>
        <el-form-item label="状态码">
          <el-input-number v-model="presetForm.statusCode" :min="100" :max="599" />
        </el-form-item>
        <el-form-item label="响应模式">
          <el-radio-group v-model="presetForm.responseMode">
            <el-radio value="basic">基础</el-radio>
            <el-radio value="advanced">高级</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="Content-Type" v-if="presetForm.responseMode === 'basic'">
          <el-input v-model="presetForm.responseType" />
        </el-form-item>
        <el-form-item label="响应内容">
          <el-input
            v-if="presetForm.responseMode === 'basic'"
            v-model="presetForm.responseBasic"
            type="textarea"
            :rows="6"
            placeholder="响应体内容"
          />
          <el-input
            v-else
            v-model="presetForm.responseAdvanced"
            type="textarea"
            :rows="6"
            placeholder="高级模式脚本"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button size="small" @click="dialogVisible = false">取消</el-button>
        <el-button size="small" type="primary" @click="saveCustomPreset">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.scenario-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.panel-body {
  flex: 1;
  overflow: auto;
  padding: 12px 16px;
}

.empty-state {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
}

.group-section {
  margin-bottom: 20px;
}

.group-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  padding: 8px 0;
  border-bottom: 1px solid var(--border-color);
  margin-bottom: 8px;
}

.rule-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px solid var(--border-color);
}

.rule-row:last-child {
  border-bottom: none;
}

.rule-info {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 200px;
}

.rule-name {
  font-size: 13px;
  color: var(--text-primary);
  font-weight: 500;
}

.rule-url {
  font-size: 12px;
  color: var(--text-secondary);
}

.rule-presets {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.preset-status {
  font-size: 11px;
  color: var(--text-secondary);
  margin-left: 2px;
}

.preset-actions {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.preset-tag {
  cursor: pointer;
}
</style>
