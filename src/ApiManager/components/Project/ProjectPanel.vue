/**
 * ProjectPanel.vue - 项目管理面板
 *
 * 功能：项目的 CRUD、成员管理、归档/激活、标签管理
 */
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Delete, Edit, Star, StarFilled, ArrowRight } from '@element-plus/icons-vue';
import type { Project, ProjectMember, MemberRole, MockGroup } from '@/types/mock';

const API_BASE = ref('http://localhost:3000');
const projects = ref<Project[]>([]);
const groups = ref<MockGroup[]>([]);
const showDialog = ref(false);
const isEditing = ref(false);

const form = ref<Partial<Project>>({});
const tagInput = ref('');
const memberForm = ref<Partial<ProjectMember>>({});
const showMemberDialog = ref(false);
const editingProjectId = ref<number | null>(null);

/** 展开成员详情的项目 ID */
const expandedMemberId = ref<number | null>(null);

const showArchived = ref(false);

const roleLabels: Record<MemberRole, string> = {
  owner: '负责人',
  admin: '管理员',
  developer: '开发者',
  viewer: '观察者',
};

const roleOptions: { value: MemberRole; label: string }[] = [
  { value: 'owner', label: '负责人' },
  { value: 'admin', label: '管理员' },
  { value: 'developer', label: '开发者' },
  { value: 'viewer', label: '观察者' },
];

const iconOptions = ['📦', '🚀', '🔧', '💡', '🎯', '📱', '🖥️', '🌐', '⚡', '🎨', '📊', '🔒'];

const filteredProjects = computed(() => {
  if (showArchived.value) return projects.value;
  return projects.value.filter(p => p.status === 'active');
});

/** 获取项目下的分组数和接口数 */
const getProjectStats = (projectId: number) => {
  const projectGroups = groups.value.filter(g => g.projectId === projectId);
  const apiCount = projectGroups.reduce((sum, g) => sum + g.children.length, 0);
  return { groupCount: projectGroups.length, apiCount };
};

// --- 数据加载与保存 ---

const loadProjects = async () => {
  try {
    const res = await fetch(`${API_BASE.value}/_admin/projects`);
    if (!res.ok) throw new Error();
    projects.value = await res.json();
  } catch {
    ElMessage.error('加载项目失败');
  }
};

const loadGroups = async () => {
  try {
    const res = await fetch(`${API_BASE.value}/_admin/rules`);
    if (!res.ok) throw new Error();
    groups.value = await res.json();
  } catch {}
};

const saveProject = async (project: Partial<Project>) => {
  try {
    const res = await fetch(`${API_BASE.value}/_admin/project/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(project),
    });
    const data = await res.json();
    if (data.success) {
      projects.value = data.data;
      ElMessage.success(isEditing.value ? '项目已更新' : '项目已创建');
      showDialog.value = false;
    }
  } catch {
    ElMessage.error('保存失败');
  }
};

const deleteProject = async (id: number) => {
  try {
    await ElMessageBox.confirm('删除项目后，关联的接口分组将变为"未分类"。确定删除？', '警告', { type: 'warning' });
    const res = await fetch(`${API_BASE.value}/_admin/project/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    const data = await res.json();
    if (data.success) {
      projects.value = data.data;
      await loadGroups();
      ElMessage.success('项目已删除');
    }
  } catch {}
};

// --- 表单操作 ---

const openCreateDialog = () => {
  isEditing.value = false;
  form.value = { name: '', description: '', icon: '📦', status: 'active', members: [], tags: [] };
  showDialog.value = true;
};

const openEditDialog = (project: Project) => {
  isEditing.value = true;
  form.value = JSON.parse(JSON.stringify(project));
  showDialog.value = true;
};

const handleSubmit = () => {
  if (!form.value.name?.trim()) {
    ElMessage.warning('请输入项目名称');
    return;
  }
  saveProject(form.value);
};

const toggleArchive = async (project: Project) => {
  const newStatus = project.status === 'active' ? 'archived' : 'active';
  await saveProject({ ...project, status: newStatus });
};

// --- 标签管理 ---

const addTag = () => {
  const tag = tagInput.value.trim();
  if (!tag) return;
  if (!form.value.tags) form.value.tags = [];
  if (!form.value.tags.includes(tag)) {
    form.value.tags.push(tag);
  }
  tagInput.value = '';
};

const removeTag = (idx: number) => {
  form.value.tags?.splice(idx, 1);
};

// --- 成员管理 ---

const toggleMemberDetail = (projectId: number) => {
  expandedMemberId.value = expandedMemberId.value === projectId ? null : projectId;
};

const openMemberDialog = (projectId: number) => {
  editingProjectId.value = projectId;
  memberForm.value = { name: '', role: 'developer' };
  showMemberDialog.value = true;
};

const addMember = () => {
  if (!memberForm.value.name?.trim()) {
    ElMessage.warning('请输入成员名称');
    return;
  }
  const project = projects.value.find(p => p.id === editingProjectId.value);
  if (!project) return;
  if (!project.members) project.members = [];
  project.members.push({
    id: Date.now(),
    name: memberForm.value.name!,
    role: memberForm.value.role as MemberRole || 'developer',
    joinedAt: Date.now(),
  });
  saveProject(project);
  showMemberDialog.value = false;
};

const removeMember = (project: Project, memberId: number) => {
  project.members = project.members.filter(m => m.id !== memberId);
  saveProject(project);
};

const updateMemberRole = (project: Project, memberId: number, role: MemberRole) => {
  const member = project.members.find(m => m.id === memberId);
  if (member) {
    member.role = role;
    saveProject(project);
  }
};

const formatDate = (ts: number) => {
  return new Date(ts).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
};

onMounted(() => {
  if (window.services) {
    API_BASE.value = window.services.getServerUrl();
  }
  loadProjects();
  loadGroups();
});
</script>

<template>
  <div class="project-panel">
    <!-- 顶部操作栏 -->
    <div class="panel-header">
      <div class="header-left">
        <span class="title">项目管理</span>
        <el-tag size="small" type="info">{{ filteredProjects.length }} 个项目</el-tag>
      </div>
      <div class="header-right">
        <el-checkbox v-model="showArchived" label="显示已归档" size="small" />
        <el-button type="primary" size="small" :icon="Plus" @click="openCreateDialog">新建项目</el-button>
      </div>
    </div>

    <!-- 项目卡片列表 -->
    <el-scrollbar class="project-list">
      <div class="card-grid">
        <div
          v-for="project in filteredProjects"
          :key="project.id"
          class="project-card"
          :class="{ archived: project.status === 'archived' }"
        >
          <div class="card-header">
            <div class="card-title-row">
              <span class="card-icon">{{ project.icon || '📦' }}</span>
              <span class="card-name">{{ project.name }}</span>
              <el-tag v-if="project.status === 'archived'" size="small" type="info">已归档</el-tag>
            </div>
            <div class="card-actions">
              <el-button link :icon="project.status === 'archived' ? StarFilled : Star" @click="toggleArchive(project)" :title="project.status === 'archived' ? '激活' : '归档'" />
              <el-button link :icon="Edit" @click="openEditDialog(project)" title="编辑" />
              <el-button link :icon="Delete" type="danger" @click="deleteProject(project.id)" title="删除" />
            </div>
          </div>

          <p class="card-desc">{{ project.description || '暂无介绍' }}</p>

          <!-- 项目统计 -->
          <div class="card-stats">
            <span class="stat-item">📁 {{ getProjectStats(project.id).groupCount }} 个分组</span>
            <span class="stat-item">🔗 {{ getProjectStats(project.id).apiCount }} 个接口</span>
          </div>

          <div v-if="project.tags?.length" class="card-tags">
            <el-tag v-for="tag in project.tags" :key="tag" size="small" effect="plain" class="tag-item">{{ tag }}</el-tag>
          </div>

          <div class="card-footer">
            <div class="member-section">
              <span class="member-count" @click="toggleMemberDetail(project.id)">
                👥 {{ project.members?.length || 0 }} 人
                <el-icon class="expand-icon" :class="{ expanded: expandedMemberId === project.id }"><ArrowRight /></el-icon>
              </span>
              <div v-if="project.members?.length" class="member-list">
                <el-tooltip v-for="m in project.members.slice(0, 5)" :key="m.id" :content="`${m.name} (${roleLabels[m.role]})`">
                  <span class="member-avatar">{{ m.name[0] }}</span>
                </el-tooltip>
                <span v-if="project.members.length > 5" class="member-more">+{{ project.members.length - 5 }}</span>
              </div>
            </div>
            <span class="card-date">{{ formatDate(project.createdAt) }}</span>
          </div>

          <!-- 成员详情（可折叠） -->
          <div v-if="expandedMemberId === project.id" class="member-detail">
            <div v-for="m in project.members" :key="m.id" class="member-row">
              <span class="member-avatar sm">{{ m.name[0] }}</span>
              <span class="member-name">{{ m.name }}</span>
              <el-select v-model="m.role" size="small" class="role-select" @change="updateMemberRole(project, m.id, $event as MemberRole)">
                <el-option v-for="r in roleOptions" :key="r.value" :label="r.label" :value="r.value" />
              </el-select>
              <el-button link type="danger" size="small" @click="removeMember(project, m.id)">移除</el-button>
            </div>
            <el-button size="small" :icon="Plus" @click="openMemberDialog(project.id)" class="add-member-btn">添加成员</el-button>
          </div>
        </div>
      </div>

      <el-empty v-if="!filteredProjects.length" description="暂无项目，点击上方按钮创建" />
    </el-scrollbar>

    <!-- 新建/编辑项目对话框 -->
    <el-dialog v-model="showDialog" :title="isEditing ? '编辑项目' : '新建项目'" width="520px" destroy-on-close>
      <el-form :model="form" label-width="80px" label-position="left">
        <el-form-item label="图标">
          <div class="icon-picker">
            <span
              v-for="icon in iconOptions"
              :key="icon"
              class="icon-option"
              :class="{ active: form.icon === icon }"
              @click="form.icon = icon"
            >{{ icon }}</span>
          </div>
        </el-form-item>
        <el-form-item label="名称" required>
          <el-input v-model="form.name" placeholder="项目名称" maxlength="50" />
        </el-form-item>
        <el-form-item label="介绍">
          <el-input v-model="form.description" type="textarea" :rows="3" placeholder="项目介绍（可选）" maxlength="200" show-word-limit />
        </el-form-item>
        <el-form-item label="标签">
          <div class="tag-editor">
            <el-tag v-for="(tag, idx) in form.tags" :key="tag" closable size="small" @close="removeTag(idx)" class="tag-item">{{ tag }}</el-tag>
            <el-input v-model="tagInput" size="small" placeholder="输入后回车" class="tag-input" @keyup.enter="addTag" />
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showDialog = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit">{{ isEditing ? '保存' : '创建' }}</el-button>
      </template>
    </el-dialog>

    <!-- 添加成员对话框 -->
    <el-dialog v-model="showMemberDialog" title="添加成员" width="400px" destroy-on-close>
      <el-form :model="memberForm" label-width="60px">
        <el-form-item label="姓名" required>
          <el-input v-model="memberForm.name" placeholder="成员姓名" />
        </el-form-item>
        <el-form-item label="角色">
          <el-select v-model="memberForm.role" style="width: 100%">
            <el-option v-for="r in roleOptions" :key="r.value" :label="r.label" :value="r.value" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showMemberDialog = false">取消</el-button>
        <el-button type="primary" @click="addMember">添加</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.project-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-card);
}
.panel-header {
  height: 42px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}
.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}
.header-left .title {
  font-weight: 600;
  color: var(--text-primary);
}
.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}
.project-list {
  flex: 1;
  overflow: hidden;
}
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 16px;
  padding: 16px;
}
.project-card {
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 16px;
  background: var(--bg-card);
  transition: box-shadow 0.2s;
}
.project-card:hover {
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}
.project-card.archived {
  opacity: 0.6;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}
.card-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}
.card-icon {
  font-size: 20px;
  flex-shrink: 0;
}
.card-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.card-actions {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.2s;
}
.project-card:hover .card-actions {
  opacity: 1;
}
.card-desc {
  margin: 8px 0;
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.card-stats {
  display: flex;
  gap: 16px;
  margin-bottom: 8px;
  font-size: 12px;
  color: var(--text-secondary);
}
.stat-item {
  display: flex;
  align-items: center;
  gap: 2px;
}
.card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 8px;
}
.tag-item {
  border-radius: 4px;
}
.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 8px;
  border-top: 1px solid var(--border-color);
}
.member-section {
  display: flex;
  align-items: center;
  gap: 8px;
}
.member-count {
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 2px;
}
.member-count:hover {
  color: var(--primary-color);
}
.expand-icon {
  font-size: 12px;
  transition: transform 0.2s;
}
.expand-icon.expanded {
  transform: rotate(90deg);
}
.member-list {
  display: flex;
  align-items: center;
  gap: 2px;
}
.member-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--primary-color);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 600;
}
.member-avatar.sm {
  width: 20px;
  height: 20px;
  font-size: 10px;
}
.member-more {
  font-size: 11px;
  color: var(--text-secondary);
  margin-left: 2px;
}
.card-date {
  font-size: 11px;
  color: var(--text-secondary);
}
.member-detail {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed var(--border-color);
}
.member-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
}
.member-name {
  font-size: 13px;
  color: var(--text-primary);
  flex: 1;
}
.role-select {
  width: 90px;
}
.add-member-btn {
  margin-top: 6px;
}

/* 对话框内样式 */
.icon-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.icon-option {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  cursor: pointer;
  font-size: 18px;
  border: 2px solid transparent;
  transition: all 0.15s;
}
.icon-option:hover {
  background: var(--bg-hover);
}
.icon-option.active {
  border-color: var(--primary-color);
  background: var(--primary-bg);
}
.tag-editor {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}
.tag-input {
  width: 120px;
}
</style>