/**
 * @file TemplateManager.vue
 * @description 数据模板管理组件
 *
 * 功能概述：
 * - 展示模板列表（卡片网格布局），每个卡片显示模板名称、模式标签、代码预览、创建时间
 * - 新建/编辑模板（弹窗表单），支持基础模式和高级模式
 * - 删除模板（二次确认）
 * - 模板内容使用 CodeEditor 编辑和预览
 * - 通过 API 与后端交互（CRUD 操作）
 * - 注入 isDark 状态用于 CodeEditor 主题切换
 */
<script setup lang="ts">
import {ref, onMounted, inject, computed} from 'vue';
import { Delete, Edit, Plus, Document, Monitor, Coin } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { MockTemplate } from '@/types/mock';
import CodeEditor from '@/ApiManager/components/CodeEditor.vue';

/** 后端 API 基础地址 */
const API_BASE = 'http://localhost:3000';

/** 模板列表数据 */
const templates = ref<MockTemplate[]>([]);

/** 注入全局暗色模式状态，用于 CodeEditor 主题切换 */
const isDark = inject('isDark', ref(false));

// --- 弹窗相关状态 ---

/** 弹窗是否可见 */
const dialogVisible = ref(false);

/** 是否为编辑模式（false 表示新建模式） */
const isEditMode = ref(false);

/** 当前正在编辑的模板表单数据 */
const editingForm = ref<Partial<MockTemplate>>({
  name: '',
  mode: 'basic',
  contentType: 'application/json',
  content: '{}'
});

// 【新增】创建一个类型安全的计算属性代理
/**
 * 编辑内容的计算属性代理
 * 用于安全地双向绑定 editingForm.content，避免 undefined 问题
 */
const editingContent = computed({
  get: () => editingForm.value.content ?? '', // 如果 content 是 undefined，返回空字符串
  set: (val: string) => {
    editingForm.value.content = val;
  }
});

// 默认代码模板
/** 高级模式的默认代码模板，包含 main 入口函数示例 */
const advancedTemplateCode = `/**
 * 高级模式：入口函数 main(req, Mock)
 */
function main(req, Mock) {
  return Mock.mock({
    'list|1-10': [{ 'id|+1': 1 }]
  });
}`;

/**
 * 从后端加载模板列表
 * 请求 /_admin/templates 接口获取所有模板数据
 */
const loadTemplates = async () => {
  try {
    const res = await fetch(`${API_BASE}/_admin/templates`);
    templates.value = await res.json();
  } catch (e) {
    ElMessage.error('加载模板失败');
  }
};

/**
 * 保存模板（新建或更新）
 * 校验表单必填项后，调用 /_admin/template/save 接口
 */
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

/**
 * 删除模板
 * 弹出二次确认框，确认后调用 /_admin/template/delete 接口
 * @param id - 要删除的模板 ID
 */
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

/**
 * 打开新建模板弹窗
 * 重置表单为默认值，设置为新建模式
 */
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

/**
 * 打开编辑模板弹窗
 * 深拷贝模板数据到表单，设置为编辑模式
 * @param tpl - 要编辑的模板对象
 */
const openEditDialog = (tpl: MockTemplate) => {
  isEditMode.value = true;
  // 深拷贝，防止直接修改列表数据
  editingForm.value = JSON.parse(JSON.stringify(tpl));
  dialogVisible.value = true;
};

/**
 * 处理模式切换（基础模式 / 高级模式）
 * 切换时自动填充对应模式的默认代码模板
 * @param val - 切换后的模式值
 */
const handleModeChange = (val: string | number | boolean | undefined) => {
  // 切换模式时，如果内容是空的或者也是默认值，则给予新的默认值
  if (val === 'advanced' && (editingForm.value.content === '{}' || !editingForm.value.content)) {
    editingForm.value.content = advancedTemplateCode;
  } else if (val === 'basic' && editingForm.value.content === advancedTemplateCode) {
    editingForm.value.content = '{}';
  }
};

/**
 * Content-Type 选项列表
 * 按「文本」「文件」「其他」分组，用于基础模式下的响应类型选择
 */
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

/**
 * 格式化时间戳为本地日期字符串
 * @param ts - 毫秒级时间戳
 * @returns 格式化后的日期字符串
 */
const formatDate = (ts: number) => new Date(ts).toLocaleString();

/** 组件挂载时加载模板列表 */
onMounted(loadTemplates);
</script>

<template>
  <!-- 模板管理器根容器 -->
  <div class="template-manager">
    <!-- 顶部标题栏：标题 + 新建按钮 -->
    <div class="header">
      <div class="header-left">
        <span class="title">响应数据模板</span>
        <span class="subtitle">共 {{ templates.length }} 个模板</span>
      </div>
      <el-button type="primary" :icon="Plus" @click="openCreateDialog">新建模板</el-button>
    </div>

    <!-- 模板列表区域 -->
    <div class="template-list">
      <!-- 空状态提示 -->
      <el-empty v-if="templates.length === 0" description="暂无模板，可以新建或从接口页保存" />

      <!-- 模板卡片网格 -->
      <div v-else class="card-grid">
        <div v-for="item in templates" :key="item.id" class="template-card">
          <!-- 卡片头部：模式标签 + 名称 + 操作按钮 -->
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

          <!-- 卡片主体：代码预览区域（只读），点击可编辑 -->
          <div class="card-body" @click="openEditDialog(item)">
            <div class="code-mask"></div>
            <CodeEditor
                :model-value="item.content"
                :language="item.mode === 'basic' ? 'json' : 'javascript'"
                :is-dark="isDark"
                readonly
            />
          </div>

          <!-- 卡片底部：创建时间 + Content-Type -->
          <div class="card-footer">
            <span class="time">{{ formatDate(item.createdAt) }}</span>
            <span v-if="item.mode === 'basic'" class="type">{{ item.contentType }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 新建/编辑模板弹窗 -->
    <el-dialog
        v-model="dialogVisible"
        :title="isEditMode ? '编辑模板' : '新建模板'"
        width="800px"
        :close-on-click-modal="false"
        class="template-dialog"
    >
      <div class="dialog-content">
        <!-- 表单行：模板名称 + 模式切换 + Content-Type 选择 -->
        <div class="form-row">
          <el-input v-model="editingForm.name" placeholder="模板名称 (例如: 通用成功响应)" style="flex: 1" />

          <el-radio-group v-model="editingForm.mode" @change="handleModeChange">
            <el-radio-button label="basic">基础模式</el-radio-button>
            <el-radio-button label="advanced">高级模式</el-radio-button>
          </el-radio-group>

          <!-- 基础模式下显示 Content-Type 选择器 -->
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

        <!-- 代码编辑器容器 -->
        <div class="editor-container">
          <CodeEditor
              v-model="editingContent"
              :language="editingForm.mode === 'basic' ? 'json' : 'javascript'"
              :is-dark="isDark"
          />
        </div>
        <!-- 高级模式提示信息 -->
        <div class="tips" v-if="editingForm.mode === 'advanced'">
          <el-icon><Monitor /></el-icon> <span>高级模式支持 Mock.js 语法及函数式编程</span>
        </div>
      </div>
      <!-- 弹窗底部按钮 -->
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
.card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }

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