/**
 * ApiManager/index - 应用根布局组件
 *
 * 整体页面结构：
 * - 左侧 ActivityBar 导航栏（切换功能面板）
 * - 右侧主区域：顶部 Header（页面标题 + 主题切换按钮）+ 主内容区
 * - 主内容区根据 activeTab 条件渲染不同面板（接口管理 / 数据模板 / 开发工具 / 设置 / 关于）
 *
 * 职责：
 * - 定义全局 CSS 变量（浅色 / 深色主题配色）
 * - 通过 provide 向所有子组件注入 isDark 响应式状态
 * - 管理深色模式切换逻辑（同步 document.documentElement 的 class）
 */
<script setup lang="ts">
import { ref, computed, provide } from 'vue';
import { UserFilled, Moon, Sunny } from '@element-plus/icons-vue';
import ActivityBar from './components/ActivityBar.vue';
import ApiPanel from './components/Api/ApiPanel.vue';
import TemplateManager from './components/Template/TemplateManager.vue'; // 引入新组件
import ToolsPanel from './components/Tools/ToolsPanel.vue';

/** 当前激活的导航标签页，默认为 'api'（接口管理） */
const activeTab = ref('api');

/** 深色模式开关 */
const isDark = ref(false);
// 【关键】向下层组件提供 isDark 状态
provide('isDark', isDark);

/**
 * 切换深色/浅色主题
 * 同时更新 isDark 状态和 document.documentElement 的 class，
 * 以便全局 CSS（如 Element Plus 暗黑模式）能正确响应
 */
const toggleTheme = () => {
  isDark.value = !isDark.value;
  const html = document.documentElement;
  if (isDark.value) {
    html.classList.add('dark');
  } else {
    html.classList.remove('dark');
  }
};

/** 根据当前激活标签页计算页面标题文本 */
const currentTitle = computed(() => {
  const map: Record<string, string> = {
    api: '接口管理',
    template: '数据模板',
    tools: '开发工具',
    settings: '全局设置',
    about: '关于软件'
  };
  return map[activeTab.value] || '应用';
});
</script>

<template>
  <!-- 应用最外层框架，通过 dark 类名切换深色/浅色 CSS 变量 -->
  <div class="app-frame" :class="{ dark: isDark }">

    <!-- 左侧导航栏 -->
    <ActivityBar v-model="activeTab" />

    <!-- 右侧主区域（Header + 内容） -->
    <div class="main-layout">

      <!-- 顶部 Header：左侧标题 + 右侧主题切换按钮 -->
      <header class="app-header">
        <div class="header-left">
          <div class="avatar-container">
            <el-avatar :size="28" :icon="UserFilled" class="user-avatar" />
          </div>
          <span class="page-title">{{ currentTitle }}</span>
        </div>

        <!-- 主题切换按钮：深色显示月亮图标，浅色显示太阳图标 -->
        <div class="header-right">
          <button class="icon-btn" @click="toggleTheme" title="切换模式">
            <el-icon :size="18">
              <Moon v-if="isDark" />
              <Sunny v-else />
            </el-icon>
          </button>
        </div>
      </header>

      <!-- 主内容区：根据 activeTab 条件渲染对应面板 -->
      <main class="content-wrapper">
        <div class="content-card">
          <!-- 接口管理面板 -->
          <ApiPanel v-if="activeTab === 'api'" />

          <!-- 数据模板管理面板 -->
          <div v-if="activeTab === 'template'" class="full-height-module">
            <TemplateManager />
          </div>

          <!-- 开发工具面板 -->
          <div v-if="activeTab === 'tools'" class="full-height-module">
            <ToolsPanel />
          </div>

          <!-- 全局设置（占位） -->
          <div v-if="activeTab === 'settings'" class="placeholder-module">
            <el-empty description="全局设置" />
          </div>

          <!-- 关于软件 -->
          <div v-if="activeTab === 'about'" class="placeholder-module">
            <div class="about-content">
              <h2>Mock API Server</h2>
              <p class="about-version">v1.4.0</p>
              <p class="about-desc">一款集 Mock 服务与接口管理于一体的 uTools 插件。支持多分组管理、自定义响应数据、真实接口代理调试、数据模板复用，以及多种响应类型（JSON、文件等）。</p>
              <div class="about-author">
                <p>作者：suyuhao</p>
                <p>邮箱：suyhem@163.com</p>
              </div>
            </div>
          </div>
        </div>
      </main>

    </div>
  </div>
</template>

<style scoped>
/* --- 🎨 现代化配色系统 --- */
.app-frame {
  /* ☀️ 浅色模式 - 冷淡风 */
  --bg-frame: #F2F4F7;         /* 整体框架背景（Sidebar + Header） */
  --bg-card: #FFFFFF;          /* 内容卡片背景 */
  --text-primary: #1D2129;     /* 主要文字 */
  --text-secondary: #86909C;   /* 次要文字 */
  --border-color: #E5E6EB;     /* 边框颜色 */
  --bg-hover: rgba(0, 0, 0, 0.04); /* 鼠标悬浮 */
  --primary-color: #409EFF;
  --primary-bg: #E6F7FF;       /* 激活项背景 */
  --shadow-card: 0 4px 16px rgba(0, 0, 0, 0.04); /* 卡片阴影 */

  display: flex;
  height: 100vh;
  width: 100vw;
  background-color: var(--bg-frame);
  color: var(--text-primary);
  transition: background-color 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* 🌙 深色模式 - 深邃高级灰 */
.app-frame.dark {
  --bg-frame: #141414;         /* 框架背景（极深灰，不是纯黑） */
  --bg-card: #1F1F1F;          /* 内容卡片（稍亮一点） */
  --text-primary: #E5EAF3;
  --text-secondary: #6B7280;
  --border-color: #303030;     /* 深色边框 */
  --bg-hover: rgba(255, 255, 255, 0.08);
  --primary-color: #409EFF;
  --primary-bg: rgba(64, 158, 255, 0.2);
  --shadow-card: 0 4px 24px rgba(0, 0, 0, 0.4);
}

/* --- 布局实现 --- */

.main-layout {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Header 样式 */
.app-header {
  height: 56px; /* 稍微调低一点，更精致 */
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px; /* 增加两边留白 */
  flex-shrink: 0;
  /* 关键：不需要背景色，透出 app-frame 的背景 */
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-avatar {
  background-color: var(--primary-color);
  border: 2px solid var(--bg-card); /* 给头像加个小边框增加层次 */
}

.page-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  letter-spacing: 0.5px;
}

/* 自定义图标按钮（比 el-button 更轻量） */
.icon-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 8px;
  border-radius: 8px;
  color: var(--text-secondary);
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}
.icon-btn:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

/* 内容包装器 */
.content-wrapper {
  flex: 1;
  padding: 0 16px 16px 4px; /* 右下留白，左侧稍微留点缝隙 */
  overflow: hidden;
  display: flex;
}

/* 悬浮卡片核心样式 */
.content-card {
  flex: 1;
  background-color: var(--bg-card);
  border-radius: 12px; /* 优雅的圆角 */
  box-shadow: var(--shadow-card);
  border: 1px solid var(--border-color); /* 极细边框增加精致感 */
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: all 0.3s;
}

/* 占位符样式 */
.placeholder-module {
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
}
.about-content {
  text-align: center;
  color: var(--text-secondary);
}
.about-content h2 { color: var(--text-primary); margin-bottom: 4px; }
.about-version { font-size: 13px; margin-bottom: 16px; }
.about-desc { font-size: 13px; line-height: 1.8; max-width: 360px; margin: 0 auto 20px; }
.about-author { font-size: 13px; padding-top: 16px; border-top: 1px solid var(--border-color); }
.about-author p { margin: 4px 0; }

.full-height-module {
  height: 100%;
  overflow: hidden;
}
</style>