<script setup lang="ts">
import { ref, computed, provide } from 'vue';
import { UserFilled, Moon, Sunny } from '@element-plus/icons-vue';
import ActivityBar from './components/ActivityBar.vue';
import ApiPanel from './components/Api/ApiPanel.vue';

const activeTab = ref('api');
const isDark = ref(false);
// 【关键】向下层组件提供 isDark 状态
provide('isDark', isDark);

const toggleTheme = () => {
  isDark.value = !isDark.value;
  const html = document.documentElement;
  if (isDark.value) {
    html.classList.add('dark');
  } else {
    html.classList.remove('dark');
  }
};

const currentTitle = computed(() => {
  const map: Record<string, string> = {
    api: '接口管理',
    template: '数据模板',
    settings: '全局设置',
    about: '关于软件'
  };
  return map[activeTab.value] || '应用';
});
</script>

<template>
  <div class="app-frame" :class="{ dark: isDark }">

    <ActivityBar v-model="activeTab" />

    <div class="main-layout">

      <header class="app-header">
        <div class="header-left">
          <div class="avatar-container">
            <el-avatar :size="28" :icon="UserFilled" class="user-avatar" />
          </div>
          <span class="page-title">{{ currentTitle }}</span>
        </div>

        <div class="header-right">
          <button class="icon-btn" @click="toggleTheme" title="切换模式">
            <el-icon :size="18">
              <Moon v-if="isDark" />
              <Sunny v-else />
            </el-icon>
          </button>
        </div>
      </header>

      <main class="content-wrapper">
        <div class="content-card">
          <ApiPanel v-if="activeTab === 'api'" />

          <div v-if="activeTab === 'template'" class="placeholder-module">
            <el-empty description="模板功能开发中..." />
          </div>

          <div v-if="activeTab === 'settings'" class="placeholder-module">
            <el-empty description="全局设置" />
          </div>

          <div v-if="activeTab === 'about'" class="placeholder-module">
            <div class="about-content">
              <h2>Local Mock Server</h2>
              <p>v1.3.0 - Elegant UI</p>
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
</style>