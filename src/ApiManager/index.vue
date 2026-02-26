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
import { ref, computed, provide, markRaw, defineAsyncComponent, type Ref, type Component } from 'vue';
import { UserFilled, Moon, Sunny } from '@element-plus/icons-vue';
import ActivityBar from './components/ActivityBar.vue';
import ProjectPanel from './components/Project/ProjectPanel.vue';
import ServicePanel from './components/Service/ServicePanel.vue';
import ApiPanel from './components/Api/ApiPanel.vue';
import GuideDialog from './components/GuideDialog.vue';

const TemplateManager = defineAsyncComponent(() => import('./components/Template/TemplateManager.vue'));
const ToolsPanel = defineAsyncComponent(() => import('./components/Tools/ToolsPanel.vue'));
const SettingsPanel = defineAsyncComponent(() => import('./components/Settings/SettingsPanel.vue'));
const LogPanel = defineAsyncComponent(() => import('./components/Log/LogPanel.vue'));
const ScenarioPanel = defineAsyncComponent(() => import('./components/Scenario/ScenarioPanel.vue'));
const WsPanel = defineAsyncComponent(() => import('./components/WebSocket/WsPanel.vue'));
const DashboardPanel = defineAsyncComponent(() => import('./components/Dashboard/DashboardPanel.vue'));
const EnvironmentPanel = defineAsyncComponent(() => import('./components/Environment/EnvironmentPanel.vue'));
const DocPanel = defineAsyncComponent(() => import('./components/Doc/DocPanel.vue'));
const TestRunnerPanel = defineAsyncComponent(() => import('./components/TestRunner/TestRunnerPanel.vue'));
import { useSettings, settingsKey } from '@/composables/useSettings';
import { useEnvironments, environmentsKey } from '@/composables/useEnvironments';

/** 需要显示使用指南的 tab */
const guideTabs = new Set(['dashboard', 'project', 'service', 'api', 'template', 'scenario', 'environment', 'doc', 'log', 'websocket', 'tools', 'testrunner']);

/** 全局设置（持久化到 localStorage） */
const settings = useSettings();
provide(settingsKey, settings);

/** 环境变量管理 */
const envManager = useEnvironments();
provide(environmentsKey, envManager);

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

const userFilledIcon = markRaw(UserFilled) as Component;

/** 根据当前激活标签页计算页面标题文本 */
const currentTitle = computed(() => {
  const map: Record<string, string> = {
    dashboard: '数据看板',
    project: '项目管理',
    service: '服务管理',
    api: '接口管理',
    template: '数据模板',
    tools: '开发工具',
    log: '请求日志',
    scenario: '场景管理',
    websocket: 'WebSocket 管理',
    environment: '环境配置',
    doc: '接口文档',
    testrunner: '测试运行器',
    settings: '全局设置',
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
            <el-avatar :size="24" :icon="userFilledIcon" class="user-avatar" />
          </div>
          <span class="page-title">{{ currentTitle }}</span>
          <GuideDialog v-if="guideTabs.has(activeTab)" :title="currentTitle + ' — 使用指南'">
            <!-- 看板 -->
            <template v-if="activeTab === 'dashboard'">
              <h4>🚀 快速开始</h4>
              <ol>
                <li>在「接口」模块中创建分组，添加 Mock 接口规则</li>
                <li>在「环境配置」模块中配置端口并启动 Mock 服务</li>
                <li>在接口编辑器中点击「测试」发送请求，验证 Mock 响应</li>
                <li>前端项目中将请求地址指向 Mock 服务即可使用</li>
              </ol>
              <h4>📊 看板说明</h4>
              <ul>
                <li><b>统计卡片</b> — 点击可快速跳转到对应模块</li>
                <li><b>方法分布</b> — 展示所有接口的 HTTP 方法占比</li>
                <li><b>服务状态</b> — 显示当前运行中的 Mock 服务及端口</li>
                <li><b>最近请求</b> — 最近 10 条请求日志摘要</li>
              </ul>
              <h4>💡 功能概览</h4>
              <table>
                <thead><tr><th>模块</th><th>功能</th></tr></thead>
                <tbody>
                  <tr><td>接口管理</td><td>创建分组和接口规则，配置请求/响应，支持 Mock 和真实接口两种测试模式</td></tr>
                  <tr><td>数据模板</td><td>创建可复用的响应模板，支持 Mock.js 语法生成随机数据</td></tr>
                  <tr><td>场景管理</td><td>为接口配置多个响应预设（成功/失败/超时等），一键切换测试场景</td></tr>
                  <tr><td>环境配置</td><td>管理多环境配置（服务端口、变量、覆盖），统一的环境配置中心，顶部下拉框快速切换</td></tr>
                  <tr><td>接口文档</td><td>从 Mock 规则自动生成可视化 API 文档，支持导出 Markdown / HTML</td></tr>
                  <tr><td>开发工具</td><td>30+ 内置工具：JSON 格式化、编解码、正则测试、代码生成、cURL 解析等</td></tr>
                  <tr><td>请求日志</td><td>记录所有测试请求，支持筛选、搜索、展开详情、一键重放对比</td></tr>
                  <tr><td>WebSocket</td><td>创建 WS Mock 服务，支持消息匹配规则、脚本响应、实时日志</td></tr>
                </tbody>
              </table>
            </template>
            <!-- 项目 -->
            <template v-if="activeTab === 'project'">
              <h4>📖 项目管理说明</h4>
              <p>项目是接口分组的上级组织单元，用于将多个接口分组归类到不同的业务项目中，便于管理和协作。</p>
              <h4>🚀 使用步骤</h4>
              <ol>
                <li>点击右上角「新建项目」按钮，填写项目名称、介绍、图标和标签</li>
                <li>创建项目后，在「接口」模块中创建分组时可以选择归属项目</li>
                <li>项目卡片会自动统计关联的分组数和接口数</li>
                <li>点击成员人数可展开成员列表，支持添加成员和分配角色</li>
              </ol>
              <h4>👥 成员角色</h4>
              <table>
                <thead><tr><th>角色</th><th>说明</th></tr></thead>
                <tbody>
                  <tr><td>负责人</td><td>项目负责人，拥有全部权限</td></tr>
                  <tr><td>管理员</td><td>可管理项目设置和成员</td></tr>
                  <tr><td>开发者</td><td>可编辑接口和分组</td></tr>
                  <tr><td>观察者</td><td>只读权限，查看项目信息</td></tr>
                </tbody>
              </table>
              <p class="guide-tip">💡 删除项目后，关联的接口分组将变为"未分类"，接口数据不会丢失。</p>
            </template>
            <!-- 服务 -->
            <template v-if="activeTab === 'service'">
              <h4>📖 服务管理说明</h4>
              <p>服务是 Mock API 的核心运行单元。一个项目下可以有多个后端服务（如用户服务、订单服务），每个服务有独立的端口和前缀，服务内部通过分组组织接口。</p>
              <h4>🚀 使用步骤</h4>
              <ol>
                <li>先在「项目」模块中创建项目</li>
                <li>点击右上角「新建服务」按钮，选择归属项目</li>
                <li>在「基础配置」Tab 中设置服务名称、端口和前缀</li>
                <li>在「分组管理」Tab 中创建接口分组，设置子前缀</li>
                <li>点击「启动服务」按钮启动 Mock 服务</li>
                <li>在「接口」模块中为分组添加具体的接口规则</li>
              </ol>
              <h4>🔗 层级关系</h4>
              <p>项目 → 服务 → 分组 → 接口。服务是启动的最小单位，一个服务下所有分组共享端口和服务前缀。</p>
              <p class="guide-tip">💡 URL 匹配规则：http://ip:端口/服务前缀/分组子前缀/接口路径</p>
            </template>
            <!-- 接口 -->
            <template v-if="activeTab === 'api'">
              <h4>📖 接口管理说明</h4>
              <p>接口管理是核心模块，用于创建和管理 Mock 接口规则，配置请求/响应，启动 Mock 服务并进行调试测试。</p>
              <h4>🚀 使用步骤</h4>
              <ol>
                <li>点击左侧 <b>+</b> 按钮创建分组，分组是接口的容器</li>
                <li>在分组下点击 <b>+</b> 添加接口规则，填写 URL、请求方法</li>
                <li>在右侧编辑器中配置请求头、参数、请求体和响应内容</li>
                <li>在「环境配置」模块中配置端口，选择目标分组并启动 Mock 服务</li>
                <li>点击「Mock 测试」或「真实请求」按钮进行调试</li>
              </ol>
              <h4>📝 响应模式</h4>
              <table>
                <thead><tr><th>模式</th><th>说明</th><th>适用场景</th></tr></thead>
                <tbody>
                  <tr><td>基础模式</td><td>直接编写 JSON / XML 等静态响应</td><td>固定格式的响应数据</td></tr>
                  <tr><td>高级模式</td><td>使用 Mock.js + 函数式编程动态生成</td><td>随机数据、分页、条件响应</td></tr>
                </tbody>
              </table>
              <h4>🔧 功能说明</h4>
              <ul>
                <li><b>Mock 测试</b> — 向本地 Mock 服务发送请求，验证响应是否符合预期</li>
                <li><b>真实请求</b> — 向真实后端发送请求，用于对比 Mock 和真实接口</li>
                <li><b>复制 URL</b> — 复制接口完整地址，方便在前端项目中使用</li>
                <li><b>拖拽排序</b> — 拖拽接口调整顺序，拖拽分隔条调整侧边栏宽度</li>
                <li><b>接口开关</b> — 禁用/启用接口，禁用后 Mock 服务不再响应该接口</li>
              </ul>
              <p class="guide-tip">💡 使用环境变量 <code v-pre>{{变量名}}</code> 可以在不同环境间快速切换请求地址和参数。</p>
            </template>
            <!-- 模板 -->
            <template v-if="activeTab === 'template'">
              <h4>📖 数据模板说明</h4>
              <p>数据模板用于创建可复用的响应数据，在多个接口中引用同一模板，避免重复编写响应内容。</p>
              <h4>🚀 使用步骤</h4>
              <ol>
                <li>点击右上角「新建模板」按钮创建模板</li>
                <li>输入模板名称，选择基础模式或高级模式</li>
                <li>在编辑器中编写响应内容，点击「保存」</li>
                <li>在接口管理中，可以引用已创建的模板作为响应数据</li>
              </ol>
              <h4>📝 两种模式</h4>
              <table>
                <thead><tr><th>模式</th><th>说明</th><th>适用场景</th></tr></thead>
                <tbody>
                  <tr><td>基础模式</td><td>直接编写 JSON / XML / HTML 等静态响应内容</td><td>固定格式的响应数据</td></tr>
                  <tr><td>高级模式</td><td>使用 Mock.js 语法和函数式编程，动态生成数据</td><td>需要随机数据、列表、分页等场景</td></tr>
                </tbody>
              </table>
              <h4>💡 高级模式示例</h4>
              <pre>function main(req, Mock) {
  return Mock.mock({
    'list|5-10': [{
      'id|+1': 1,
      'name': '@cname',
      'email': '@email'
    }]
  });
}</pre>
              <p class="guide-tip">💡 高级模式的 main 函数接收 req（请求对象）和 Mock（Mock.js 实例），可根据请求参数动态生成不同数据。</p>
            </template>
            <!-- 场景 -->
            <template v-if="activeTab === 'scenario'">
              <h4>📖 场景管理说明</h4>
              <p>场景管理用于为同一个接口配置多种响应预设（如成功、失败、超时等），一键切换测试场景，无需反复修改接口响应。</p>
              <h4>🚀 使用步骤</h4>
              <ol>
                <li>先在「接口」模块中创建分组和接口规则</li>
                <li>回到本页面，每个接口会显示一行，默认使用「默认」响应</li>
                <li>点击接口行右侧的 <b>+</b> 按钮，从快捷预设中选择或自定义</li>
                <li>添加预设后，点击对应的单选按钮即可切换该接口的响应</li>
                <li>点击顶部「全部恢复默认」可一键将所有接口恢复为默认响应</li>
              </ol>
              <h4>💡 内置快捷预设</h4>
              <table>
                <thead><tr><th>预设名称</th><th>状态码</th><th>用途</th></tr></thead>
                <tbody>
                  <tr><td>成功响应</td><td>200</td><td>模拟正常返回</td></tr>
                  <tr><td>空数据</td><td>200</td><td>模拟无数据场景</td></tr>
                  <tr><td>参数错误</td><td>400</td><td>模拟前端传参异常</td></tr>
                  <tr><td>未授权</td><td>401</td><td>模拟登录过期</td></tr>
                  <tr><td>服务器错误</td><td>500</td><td>模拟后端异常</td></tr>
                </tbody>
              </table>
              <p class="guide-tip">💡 自定义预设支持基础模式和高级模式，可以设置任意状态码和响应内容。</p>
            </template>
            <!-- 工具 -->
            <template v-if="activeTab === 'tools'">
              <h4>📖 开发工具说明</h4>
              <p>内置 30+ 常用开发工具，涵盖编码解码、格式化、生成器、网络调试等，无需离开插件即可完成日常开发辅助操作。</p>
              <h4>🔧 工具分类</h4>
              <table>
                <thead><tr><th>分类</th><th>包含工具</th></tr></thead>
                <tbody>
                  <tr><td>编码/解码</td><td>Base64、URL 编码、HTML 实体、Unicode、JWT 解析等</td></tr>
                  <tr><td>格式化</td><td>JSON 格式化、XML 格式化、SQL 格式化等</td></tr>
                  <tr><td>生成器</td><td>UUID、随机密码、时间戳转换、正则测试等</td></tr>
                  <tr><td>网络</td><td>cURL 解析、代码生成、HTTP 状态码参考等</td></tr>
                </tbody>
              </table>
              <p class="guide-tip">💡 左侧选择工具分类和具体工具，右侧即可使用。所有工具均在本地运行，数据不会上传。</p>
            </template>
            <!-- 环境 -->
            <template v-if="activeTab === 'environment'">
              <h4>📖 什么是环境配置</h4>
              <p>环境配置是统一的配置中心，整合了服务配置（端口、前缀、真实接口地址、代理录制）和环境变量管理。通过三层继承机制（全局 → 项目覆盖 → 分组覆盖），灵活管理不同部署环境下的差异。</p>

              <h4>🚀 完整使用步骤</h4>
              <ol>
                <li><b>创建环境：</b>点击右上角「新建环境」按钮，输入环境名称（如"开发环境"、"测试环境"）</li>
                <li><b>配置服务：</b>在「服务配置」Tab 中设置端口、前缀、真实接口地址和代理录制</li>
                <li><b>添加变量：</b>在「环境变量」Tab 中添加键值对变量，通过 <code v-pre>{{变量名}}</code> 在接口中引用</li>
                <li><b>覆盖配置：</b>在「覆盖配置」Tab 中为特定项目或分组设置覆盖值（只填写需要覆盖的字段）</li>
                <li><b>激活环境：</b>在左侧环境卡片上点击「激活」按钮，该环境变为当前生效环境</li>
                <li><b>启动服务：</b>在「服务配置」Tab 中选择目标分组，点击「启动服务」即可</li>
                <li><b>快速切换：</b>页面右上角的下拉框可以快速切换激活环境</li>
              </ol>

              <h4>🔗 三层继承机制</h4>
              <p>配置解析优先级：<b>分组覆盖 > 项目覆盖 > 全局配置</b>。只有填写了值的字段才会覆盖上层，留空则自动继承。</p>

              <h4>📝 变量语法规则</h4>
              <ul>
                <li>语法格式：<code v-pre>{{变量名}}</code>，变量名仅支持字母、数字和下划线</li>
                <li>替换范围：接口 URL、请求头的 key 和 value、JSON 请求体</li>
                <li>如果变量名在当前环境中不存在或已禁用，<code v-pre>{{变量名}}</code> 原样保留不替换</li>
                <li>未激活任何环境时，所有变量引用保持原样不替换</li>
              </ul>

              <h4>📦 导入/导出</h4>
              <p>点击「导出」可将所有环境配置保存为 JSON 文件，方便备份或分享给同事。点击「导入」加载 JSON 文件，导入时会自动生成新 ID 避免冲突。</p>
            </template>
            <!-- 文档 -->
            <template v-if="activeTab === 'doc'">
              <h4>📖 接口文档说明</h4>
              <p>本模块从已有的 Mock 接口规则自动生成可视化 API 文档，无需手动编写。</p>
              <h4>🚀 使用步骤</h4>
              <ol>
                <li>在「接口」模块中创建分组和接口规则，填写请求头、参数、请求体、响应等信息</li>
                <li>切换到本页面，左侧目录树自动列出所有分组和接口</li>
                <li>点击目录项可快速定位到对应接口的详细文档</li>
                <li>使用顶部筛选器按项目或分组过滤，勾选「显示禁用」可查看已禁用接口</li>
                <li>点击「导出 MD」或「导出 HTML」将文档保存为文件</li>
              </ol>
              <p class="guide-tip">💡 接口信息越完整（名称、参数描述、响应示例），生成的文档质量越高。</p>
            </template>
            <!-- 日志 -->
            <template v-if="activeTab === 'log'">
              <h4>📖 请求日志说明</h4>
              <p>本模块自动记录所有通过接口管理「测试」按钮发起的请求，包括 Mock 和真实接口两种模式。</p>
              <h4>🚀 如何产生日志</h4>
              <ol>
                <li>进入「接口」模块，选择一个接口规则</li>
                <li>在编辑器右侧点击「Mock 测试」或「真实请求」按钮</li>
                <li>请求完成后，日志会自动出现在本页面</li>
              </ol>
              <h4>🔧 功能说明</h4>
              <ul>
                <li><b>筛选</b> — 按请求方法或状态码过滤</li>
                <li><b>搜索</b> — 输入关键词搜索 URL</li>
                <li><b>展开详情</b> — 点击行首箭头查看完整请求/响应</li>
                <li><b>请求重放</b> — 点击「重放」按钮重新发起请求并对比响应差异</li>
              </ul>
              <p class="guide-tip">💡 日志最多保留 200 条，超出后自动移除最早的记录。</p>
            </template>
            <!-- 测试运行器 -->
            <template v-if="activeTab === 'testrunner'">
              <h4>使用步骤</h4>
              <ol>
                <li>在「接口」模块中编辑接口，点击「保存为用例」将当前配置保存为测试用例</li>
                <li>在本页面创建测试套件，将测试用例添加到套件中</li>
                <li>点击「运行套件」顺序执行所有用例</li>
                <li>查看结果汇总：通过/失败数量、每个用例的断言详情</li>
              </ol>
              <h4>断言说明</h4>
              <table>
                <thead><tr><th>目标</th><th>说明</th></tr></thead>
                <tbody>
                  <tr><td>状态码</td><td>验证 HTTP 响应状态码</td></tr>
                  <tr><td>响应体</td><td>通过 JSON path 验证响应体内容</td></tr>
                  <tr><td>响应头</td><td>验证指定响应头的值</td></tr>
                  <tr><td>响应时间</td><td>验证请求耗时（毫秒）</td></tr>
                </tbody>
              </table>
              <p class="guide-tip">测试结果仅保存在内存中，不会持久化到数据库。</p>
            </template>
            <!-- WebSocket -->
            <template v-if="activeTab === 'websocket'">
              <h4>🚀 快速开始</h4>
              <ol>
                <li>在左侧选择内置的「💬 示例聊天服务」</li>
                <li>在「配置」Tab 中点击「启动服务」按钮</li>
                <li>打开浏览器 DevTools → Console，粘贴以下代码连接：</li>
              </ol>
              <pre>const ws = new WebSocket('ws://localhost:8088/ws');
ws.onopen = () => console.log('已连接');
ws.onmessage = (e) => console.log('收到:', e.data);
ws.send('ping');  // → 收到: pong</pre>
              <h4>⚙️ 四种匹配类型</h4>
              <ul>
                <li><code>精确匹配</code> — 消息必须完全一致</li>
                <li><code>包含匹配</code> — 消息中包含关键词即可</li>
                <li><code>正则匹配</code> — 使用正则表达式匹配</li>
                <li><code>任意匹配</code> — 匹配所有消息，作为兜底规则</li>
              </ul>
              <p class="guide-tip">💡 规则按列表顺序从上到下匹配，第一个命中的规则生效。建议将精确匹配放在前面，任意匹配放在最后。</p>
            </template>
          </GuideDialog>
        </div>

        <!-- 主题切换按钮：深色显示月亮图标，浅色显示太阳图标 -->
        <div class="header-right">
          <el-select
            v-if="envManager.environments.value.length > 0"
            :model-value="envManager.activeEnvId.value"
            @update:model-value="envManager.setActiveEnv($event)"
            size="small"
            clearable
            placeholder="无环境"
            style="width: 120px"
          >
            <el-option
              v-for="env in envManager.environments.value"
              :key="env.id"
              :label="env.name"
              :value="env.id"
            />
          </el-select>
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
          <!-- 数据看板面板 -->
          <DashboardPanel v-if="activeTab === 'dashboard'" @navigate="(tab) => activeTab = tab" />

          <!-- 项目管理面板 -->
          <ProjectPanel v-if="activeTab === 'project'" />

          <!-- 服务管理面板 -->
          <ServicePanel v-if="activeTab === 'service'" />

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

          <!-- 环境变量面板 -->
          <div v-if="activeTab === 'environment'" class="full-height-module">
            <EnvironmentPanel />
          </div>

          <!-- 接口文档面板 -->
          <div v-if="activeTab === 'doc'" class="full-height-module">
            <DocPanel />
          </div>

          <!-- 测试运行器面板 -->
          <div v-if="activeTab === 'testrunner'" class="full-height-module">
            <TestRunnerPanel />
          </div>

          <!-- 全局设置 -->
          <div v-if="activeTab === 'settings'" class="full-height-module">
            <SettingsPanel @theme-change="handleThemeChange" />
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

.header-right {
  display: flex;
  align-items: center;
  gap: 4px;
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
.full-height-module {
  height: 100%;
  overflow: hidden;
}
</style>