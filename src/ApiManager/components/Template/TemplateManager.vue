<script setup lang="ts">
import {ref, onMounted, inject, computed} from 'vue';
import { Delete, Edit, Plus, Document, Monitor, Coin } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { MockTemplate } from '@/types/mock';
import CodeEditor from '@/ApiManager/components/CodeEditor.vue';

const API_BASE = 'http://localhost:3000';
const templates = ref<MockTemplate[]>([]);
const isDark = inject('isDark', ref(false));

// --- 弹窗相关状态 ---
const dialogVisible = ref(false);
const isEditMode = ref(false);
const editingForm = ref<Partial<MockTemplate>>({
  name: '',
  mode: 'basic',
  contentType: 'application/json',
  content: '{}'
});

// 【新增】创建一个类型安全的计算属性代理
const editingContent = computed({
  get: () => editingForm.value.content ?? '', // 如果 content 是 undefined，返回空字符串
  set: (val: string) => {
    editingForm.value.content = val;
  }
});

// 默认代码模板
const advancedTemplateCode = `/**
 * 高级模式：入口函数 main(req, Mock)
 */
function main(req, Mock) {
  return Mock.mock({
    'list|1-10': [{ 'id|+1': 1 }]
  });
}`;

const loadTemplates = async () => {
  try {
    const res = await fetch(`${API_BASE}/_admin/templates`);
    templates.value = await res.json();
  } catch (e) {
    ElMessage.error('加载模板失败');
  }
};

const handleSave = async () => {
  if (!editingForm.value.name) return ElMessage.warning('请输入模板名称');
  if (!editingForm.value.content) return ElMessage.warning('请输入模板内容');

  try {
    await fetch(`${API_BASE}/_admin/template/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editingForm.value)
    });
    ElMessage.success(isEditMode.value ? '更新成功' : '创建成功');
    dialogVisible.value = false;
    loadTemplates();
  } catch (e) {
    ElMessage.error('保存失败');
  }
};

const handleDelete = (id: number) => {
  ElMessageBox.confirm('确定删除该模板吗？', '提示', { type: 'warning' }).then(async () => {
    try {
      await fetch(`${API_BASE}/_admin/template/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      ElMessage.success('删除成功');
      loadTemplates();
    } catch (e) {
      ElMessage.error('删除失败');
    }
  });
};

// --- 交互逻辑 ---
const openCreateDialog = () => {
  isEditMode.value = false;
  editingForm.value = {
    name: '',
    mode: 'basic',
    contentType: 'application/json',
    content: '{}'
  };
  dialogVisible.value = true;
};

const openEditDialog = (tpl: MockTemplate) => {
  isEditMode.value = true;
  // 深拷贝，防止直接修改列表数据
  editingForm.value = JSON.parse(JSON.stringify(tpl));
  dialogVisible.value = true;
};

const handleModeChange = (val: string | number | boolean | undefined) => {
  // 切换模式时，如果内容是空的或者也是默认值，则给予新的默认值
  if (val === 'advanced' && (editingForm.value.content === '{}' || !editingForm.value.content)) {
    editingForm.value.content = advancedTemplateCode;
  } else if (val === 'basic' && editingForm.value.content === advancedTemplateCode) {
    editingForm.value.content = '{}';
  }
};
const contentTypes = [
  { label: 'application/json', value: 'application/json', group: '文本' },
  { label: 'text/plain', value: 'text/plain', group: '文本' },
  { label: 'text/html', value: 'text/html', group: '文本' },
  { label: 'application/xml', value: 'application/xml', group: '文本' },
  { label: 'application/javascript', value: 'application/javascript', group: '文本' },
  { label: 'text/css', value: 'text/css', group: '文本' },
  { label: 'text/csv', value: 'text/csv', group: '文本' },
  { label: 'multipart/form-data', value: 'multipart/form-data', group: '其他' },
  { label: 'application/pdf', value: 'application/pdf', group: '文件' },
  { label: 'application/msword (Word)', value: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', group: '文件' },
  { label: 'application/zip', value: 'application/zip', group: '文件' },
  { label: 'application/octet-stream', value: 'application/octet-stream', group: '文件' },
  { label: 'video/mp4', value: 'video/mp4', group: '文件' },
];

const formatDate = (ts: number) => new Date(ts).toLocaleString();

onMounted(loadTemplates);
</script>

<template>
  <div class="template-manager">
    <div class="header">
      <div class="header-left">
        <span class="title">响应数据模板</span>
        <span class="subtitle">共 {{ templates.length }} 个模板</span>
      </div>
      <el-button type="primary" :icon="Plus" @click="openCreateDialog">新建模板</el-button>
    </div>

    <div class="template-list">
      <el-empty v-if="templates.length === 0" description="暂无模板，可以新建或从接口页保存" />

      <div v-else class="card-grid">
        <div v-for="item in templates" :key="item.id" class="template-card">
          <div class="card-header">
            <div class="meta">
              <el-tag size="small" :type="item.mode === 'basic' ? 'info' : 'warning'">
                {{ item.mode === 'basic' ? '基础' : '高级' }}
              </el-tag>
              <span class="name" :title="item.name">{{ item.name }}</span>
            </div>
            <div class="actions">
              <el-button link type="primary" :icon="Edit" @click="openEditDialog(item)" />
              <el-button link type="danger" :icon="Delete" @click="handleDelete(item.id)" />
            </div>
          </div>

          <div class="card-body" @click="openEditDialog(item)">
            <div class="code-mask"></div>
            <CodeEditor
                :model-value="item.content"
                :language="item.mode === 'basic' ? 'json' : 'javascript'"
                :is-dark="isDark"
                readonly
            />
          </div>

          <div class="card-footer">
            <span class="time">{{ formatDate(item.createdAt) }}</span>
            <span v-if="item.mode === 'basic'" class="type">{{ item.contentType }}</span>
          </div>
        </div>
      </div>
    </div>

    <el-dialog
        v-model="dialogVisible"
        :title="isEditMode ? '编辑模板' : '新建模板'"
        width="800px"
        :close-on-click-modal="false"
        class="template-dialog"
    >
      <div class="dialog-content">
        <div class="form-row">
          <el-input v-model="editingForm.name" placeholder="模板名称 (例如: 通用成功响应)" style="flex: 1" />

          <el-radio-group v-model="editingForm.mode" @change="handleModeChange">
            <el-radio-button label="basic">基础模式</el-radio-button>
            <el-radio-button label="advanced">高级模式</el-radio-button>
          </el-radio-group>

          <el-select
              v-if="editingForm.mode === 'basic'"
              v-model="editingForm.contentType"
              placeholder="类型"
              style="width: 220px"
              filterable
          >
            <el-option-group v-for="group in ['文本', '文件', '其他']" :key="group" :label="group">
              <el-option v-for="t in contentTypes.filter(c => c.group === group)" :key="t.value" :label="t.label" :value="t.value" />
            </el-option-group>
          </el-select>
        </div>

        <div class="editor-container">
          <CodeEditor
              v-model="editingContent"
              :language="editingForm.mode === 'basic' ? 'json' : 'javascript'"
              :is-dark="isDark"
          />
        </div>
        <div class="tips" v-if="editingForm.mode === 'advanced'">
          <el-icon><Monitor /></el-icon> <span>高级模式支持 Mock.js 语法及函数式编程</span>
        </div>
      </div>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" @click="handleSave">保存</el-button>
        </span>
      </template>
    </el-dialog>

  </div>
</template>

<style scoped>
.template-manager { height: 100%; display: flex; flex-direction: column; background: var(--bg-frame); }
.header {
  padding: 16px 24px; display: flex; justify-content: space-between; align-items: center;
  background: var(--bg-card); border-bottom: 1px solid var(--border-color);
}
.header-left { display: flex; flex-direction: column; gap: 4px; }
.title { font-size: 18px; font-weight: 600; color: var(--text-primary); }
.subtitle { font-size: 12px; color: var(--text-secondary); }

.template-list { flex: 1; overflow-y: auto; padding: 20px; }
.card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; }

.template-card {
  background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 8px;
  display: flex; flex-direction: column; overflow: hidden; height: 260px;
  transition: all 0.2s; position: relative;
}
.template-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.08); border-color: var(--primary-color); }

.card-header {
  padding: 10px 12px; border-bottom: 1px solid var(--border-color); display: flex;
  justify-content: space-between; align-items: center; background: var(--bg-hover);
}
.meta { display: flex; align-items: center; gap: 8px; overflow: hidden; }
.name { font-weight: 600; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text-primary); }

.card-body { flex: 1; overflow: hidden; position: relative; cursor: pointer; }
.code-mask { position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 10; background: transparent; }

.card-footer {
  padding: 8px 12px; border-top: 1px solid var(--border-color); display: flex;
  justify-content: space-between; font-size: 12px; color: var(--text-secondary); background: var(--bg-card);
}

/* 弹窗样式 */
.dialog-content { display: flex; flex-direction: column; gap: 16px; height: 500px; }
.form-row { display: flex; gap: 12px; }
.editor-container { flex: 1; border: 1px solid var(--border-color); overflow: hidden; border-radius: 4px; }
.tips { font-size: 12px; color: var(--text-secondary); display: flex; align-items: center; gap: 6px; }
</style>