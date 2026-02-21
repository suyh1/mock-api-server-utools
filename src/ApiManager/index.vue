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
import { ref, computed, provide, type Ref, type Component } from 'vue';
import { UserFilled, Moon, Sunny } from '@element-plus/icons-vue';
import ActivityBar from './components/ActivityBar.vue';
import ProjectPanel from './components/Project/ProjectPanel.vue';
import ApiPanel from './components/Api/ApiPanel.vue';
import TemplateManager from './components/Template/TemplateManager.vue';
import ToolsPanel from './components/Tools/ToolsPanel.vue';
import SettingsPanel from './components/Settings/SettingsPanel.vue';
import LogPanel from './components/Log/LogPanel.vue';
import ScenarioPanel from './components/Scenario/ScenarioPanel.vue';
import WsPanel from './components/WebSocket/WsPanel.vue';
import { useSettings, settingsKey } from '@/composables/useSettings';

/** 全局设置（持久化到 localStorage） */
const settings = useSettings();
provide(settingsKey, settings);

/** 当前激活的导航标签页，默认为 'api'（接口管理） */
const activeTab = ref('api');

const DARK_STORAGE_KEY = 'mock-api-dark-mode';

/** 深色模式开关，从 localStorage 恢复 */
const isDark = ref((() => {
  try {
    const raw = localStorage.getItem(DARK_STORAGE_KEY);
    if (raw !== null) return JSON.parse(raw);
  } catch {}
  return false;
})());
provide<Ref<boolean>>('isDark', isDark);

// 初始化时同步 HTML class
if (isDark.value) {
  document.documentElement.classList.add('dark');
}

/**
 * 应用深色模式状态到 DOM
 */
const applyDark = (dark: boolean) => {
  isDark.value = dark;
  const html = document.documentElement;
  if (dark) {
    html.classList.add('dark');
  } else {
    html.classList.remove('dark');
  }
};

/**
 * 切换深色/浅色主题
 */
const toggleTheme = () => {
  const newVal = !isDark.value;
  applyDark(newVal);
  localStorage.setItem(DARK_STORAGE_KEY, JSON.stringify(newVal));
};

/** SettingsPanel 通知主题变更 */
const handleThemeChange = (dark: boolean) => {
  applyDark(dark);
};

const userFilledIcon: Component = UserFilled;

/** 根据当前激活标签页计算页面标题文本 */
const currentTitle = computed(() => {
  const map: Record<string, string> = {
    project: '项目管理',
    api: '接口管理',
    template: '数据模板',
    tools: '开发工具',
    log: '请求日志',
    scenario: '场景管理',
    websocket: 'WebSocket 管理',
    settings: '全局设置',
    about: '关于软件'
  };
  return map[activeTab.value] || '应用';
});
/** 用默认浏览器打开 GitHub 仓库 */
const openGithub = () => {
  const url = 'https://github.com/suyh1/mock-api-server-utools';
  if ((window as any).utools?.shellOpenExternal) {
    (window as any).utools.shellOpenExternal(url);
  } else {
    window.open(url, '_blank');
  }
};
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
            <el-avatar :size="24" :icon="userFilledIcon" class="user-avatar" />
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
          <!-- 项目管理面板 -->
          <ProjectPanel v-if="activeTab === 'project'" />

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

          <!-- 请求日志面板 -->
          <div v-if="activeTab === 'log'" class="full-height-module">
            <LogPanel />
          </div>

          <!-- 场景管理面板 -->
          <div v-if="activeTab === 'scenario'" class="full-height-module">
            <ScenarioPanel />
          </div>

          <!-- WebSocket 管理面板 -->
          <div v-if="activeTab === 'websocket'" class="full-height-module">
            <WsPanel />
          </div>

          <!-- 全局设置 -->
          <div v-if="activeTab === 'settings'" class="full-height-module">
            <SettingsPanel @theme-change="handleThemeChange" />
          </div>

          <!-- 关于软件 -->
          <div v-if="activeTab === 'about'" class="placeholder-module">
            <div class="about-content">
              <h2>Mock API Server</h2>
              <p class="about-version">v1.6.2</p>
              <p class="about-desc">一款集 Mock 服务与接口管理于一体的 uTools 插件。支持多项目多分组管理、基础/高级双模式响应、Mock.js 数据模板与智能生成、真实接口代理调试、WebSocket Mock、场景切换、请求日志、数据模板复用，以及 30+ 内置开发工具。</p>
              <div class="about-author">
                <p>作者：subeipo</p>
                <p>邮箱：suyhem@163.com</p>
                <p class="about-github">
                  <a href="javascript:void(0)" @click="openGithub" title="GitHub">
                    <svg class="github-icon" viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
                      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
                    </svg>
                    <span>GitHub</span>
                  </a>
                </p>
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
  height: 42px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
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
  padding: 0 10px 10px 4px;
  overflow: hidden;
  display: flex;
}

/* 悬浮卡片核心样式 */
.content-card {
  flex: 1;
  background-color: var(--bg-card);
  border-radius: 10px;
  box-shadow: var(--shadow-card);
  border: 1px solid var(--border-color);
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

.about-github a {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--text-secondary);
  text-decoration: none;
  transition: color 0.2s;
}
.about-github a:hover { color: var(--text-primary); }
.github-icon { vertical-align: middle; }

.full-height-module {
  height: 100%;
  overflow: hidden;
}
</style>