/**
 * @file ServiceConfig.vue
 * @description 服务配置面板组件
 *
 * 功能说明：
 * - 配置 Mock 服务的端口、接口前缀
 * - 启动/停止 Mock 服务，并同步服务运行状态
 * - 端口可用性检测
 * - 配置真实接口地址（协议、主机、端口、前缀）用于代理调试
 * - 实时预览真实接口的完整 URL
 */
<script setup lang="ts">
import { ref, watch, computed, onMounted } from 'vue';
import { VideoPlay, SwitchButton, CircleCheck, Warning } from '@element-plus/icons-vue';
import type { MockGroup, ServiceConfig } from '@/types/mock';
import { ElMessage } from 'element-plus';

/**
 * 组件属性
 * @property {MockGroup} group - 当前分组对象，包含分组配置信息
 */
const props = defineProps<{
  group: MockGroup;
}>();

/**
 * 组件事件
 * @event update:group - 更新分组数据（支持 v-model:group），携带更新后的分组对象
 * @event save - 通知父组件持久化保存数据
 */
const emit = defineEmits<{
  (e: 'update:group', group: MockGroup): void;
  (e: 'save'): void;
}>();

/** 本机 IP 地址，用于拼接服务访问链接 */
const localIp = ref('localhost');

/** 管理后台 API 基础地址，用于与后端服务通信 */
const ADMIN_API = ref('http://localhost:3000/_admin/service');

/**
 * 表单数据，包含 Mock 服务配置和真实接口地址配置
 * @property {number} port - Mock 服务端口
 * @property {string} prefix - Mock 接口前缀
 * @property {boolean} running - 服务是否正在运行
 * @property {string} [realProtocol] - 真实接口协议（http/https）
 * @property {string} [realHost] - 真实接口主机地址
 * @property {string} [realPort] - 真实接口端口
 * @property {string} [realPrefix] - 真实接口前缀
 */
const formData = ref<ServiceConfig>({
  port: 3000,
  prefix: '',
  running: false
});

/** 计算属性：服务是否正在运行 */
const isRunning = computed(() => formData.value.running);

/**
 * 计算属性：真实接口地址预览
 * 根据协议、主机、端口、前缀拼接完整的 URL 供用户预览
 * @returns {string} 拼接后的完整 URL 或 '未配置'
 */
// 真实地址预览
const realUrlPreview = computed(() => {
  const { realProtocol, realHost, realPort, realPrefix } = formData.value;
  if (!realHost) return '未配置';
  let url = `${realProtocol || 'http'}://${realHost}`;
  if (realPort) url += `:${realPort}`;
  if (realPrefix) url += realPrefix.startsWith('/') ? realPrefix : `/${realPrefix}`;
  return url + '/...';
});

/**
 * 组件挂载时初始化
 * 获取本机 IP 和管理 API 地址，然后同步服务状态
 */
onMounted(async () => {
  if (window.services) {
    localIp.value = window.services.getLocalIP();
    ADMIN_API.value = `${window.services.getServerUrl()}/_admin/service`;
  }

  // 【修复点】确保在 IP 和 API 地址更新后，再执行一次状态同步
  await syncStatus();
});

// 初始化数据
/**
 * 监听分组属性变化
 * 当切换分组时，用分组配置初始化表单数据并同步服务运行状态
 */
watch(() => props.group, async (newGroup) => {
  if (newGroup) {
    formData.value = {
      port: newGroup.config?.port || 3888, // 默认 3888
      prefix: newGroup.config?.prefix || '',
      running: false,
      realProtocol: newGroup.config?.realProtocol || 'http',
      realHost: newGroup.config?.realHost || '',
      realPort: newGroup.config?.realPort || '',
      realPrefix: newGroup.config?.realPrefix || '',
    };
    await syncStatus();
  }
}, { immediate: true });

/**
 * 同步服务运行状态
 * 从管理后台获取所有服务的运行状态，匹配当前分组并更新表单
 * 【修复】同步状态逻辑
 */
const syncStatus = async () => {
  try {
    const res = await fetch(`${ADMIN_API.value}/status`);
    const statusMap = await res.json();
    // 强制转 String 匹配，防止类型不一致
    const gid = String(props.group.id);

    if (statusMap[gid] && statusMap[gid].running) {
      formData.value.running = true;
      formData.value.port = statusMap[gid].port;
      formData.value.prefix = statusMap[gid].prefix;
    } else {
      formData.value.running = false;
    }
  } catch (e) {
    console.error('Failed to sync status', e);
  }
};

/**
 * 保存配置到本地
 * 将当前表单数据合并到分组对象中，通过事件通知父组件更新和持久化
 */
const saveToLocal = () => {
  const updatedGroup = {
    ...props.group,
    config: { ...formData.value }
  };
  emit('update:group', updatedGroup);
  emit('save');
};

/**
 * 检测端口是否可用
 * 向管理后台发送检测请求，提示用户端口占用情况
 */
const handleCheckPort = async () => {
  try {
    const res = await fetch(`${ADMIN_API.value}/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ port: formData.value.port })
    });
    const data = await res.json();
    if (data.available) ElMessage.success(`端口 ${formData.value.port} 可用`);
    else ElMessage.error(`端口 ${formData.value.port} 已被占用`);
  } catch (e) { ElMessage.error('检测失败'); }
};

/**
 * 启动 Mock 服务
 * 启动前先保存配置，然后向管理后台发送启动请求
 * 启动成功后更新运行状态并再次保存
 */
const handleStart = async () => {
  // 【新增】启动前先保存配置，确保其他组件（如GroupSidebar）能拿到最新端口
  saveToLocal();

  try {
    const res = await fetch(`${ADMIN_API.value}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        groupId: props.group.id,
        port: formData.value.port,
        prefix: formData.value.prefix
      })
    });
    const data = await res.json();

    if (data.success) {
      formData.value.running = true;
      // 再次保存以更新 running 状态
      saveToLocal();
      const url = `http://${localIp.value}:${formData.value.port}${formData.value.prefix}`;
      ElMessage.success(`服务已启动: ${url}`);
    } else {
      ElMessage.error('启动失败: ' + (data.error || '未知错误'));
    }
  } catch (e: any) {
    ElMessage.error('启动异常: ' + e.message);
  }
};

/**
 * 停止 Mock 服务
 * 向管理后台发送停止请求，更新运行状态并保存
 */
const handleStop = async () => {
  try {
    await fetch(`${ADMIN_API.value}/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupId: props.group.id })
    });
    formData.value.running = false;
    saveToLocal();
    ElMessage.success('服务已关闭');
  } catch (e) { ElMessage.error('停止失败'); }
};
</script>

<template>
  <!-- 服务配置主容器 -->
  <el-main class="config-container">
    <!-- Mock 服务配置区域标题 -->
    <div class="config-header">
      <span class="title">服务配置</span>
    </div>

    <!-- Mock 服务配置表单卡片 -->
    <div class="config-card">
      <!-- 服务运行状态指示 -->
      <div class="form-row">
        <label>服务状态</label>
        <div class="status-tag" :class="{ running: isRunning }">
          <el-icon v-if="isRunning"><CircleCheck /></el-icon>
          <el-icon v-else><SwitchButton /></el-icon>
          <span>{{ isRunning ? '运行中' : '已关闭' }}</span>
        </div>
      </div>

      <!-- 接口前缀配置 -->
      <div class="form-row">
        <label>接口前缀</label>
        <el-input
            v-model="formData.prefix"
            placeholder="/api"
            :disabled="isRunning"
            @change="saveToLocal"
        />
      </div>

      <!-- 服务端口配置 + 端口检测 -->
      <div class="form-row">
        <label>服务端口</label>
        <div class="port-group">
          <el-input-number
              v-model="formData.port"
              :min="1" :max="65535"
              controls-position="right"
              :disabled="isRunning"
              class="port-input"
              @change="saveToLocal"
          />
          <el-button class="check-btn" @click="handleCheckPort" :disabled="isRunning">检测端口</el-button>
        </div>
      </div>

      <!-- 操作提示信息 -->
      <div class="warning-box">
        <el-icon class="warn-icon"><Warning /></el-icon>
        <div class="warn-content">
          提示：请先保存配置再启动服务。启动后，可通过 <a :href="`http://${localIp}:${formData.port}`" target="_blank">http://{{localIp}}:{{formData.port}}</a> 访问根路径检查服务状态。
        </div>
      </div>

      <!-- 启动/停止服务按钮 -->
      <div class="footer-actions">
        <el-button
            v-if="!isRunning"
            type="success"
            size="large"
            class="action-btn start-btn"
            :icon="VideoPlay"
            @click="handleStart"
        >
          启动服务
        </el-button>
        <el-button
            v-else
            type="danger"
            size="large"
            class="action-btn stop-btn"
            :icon="SwitchButton"
            plain
            @click="handleStop"
        >
          关闭服务
        </el-button>
      </div>
    </div>

    <!-- 真实接口地址配置 -->
    <div class="config-header" style="margin-top: 12px">
      <span class="title">真实接口地址</span>
    </div>
    <!-- 真实接口地址配置表单卡片 -->
    <div class="config-card">
      <!-- 协议选择：HTTP / HTTPS -->
      <div class="form-row">
        <label>协议</label>
        <el-radio-group v-model="formData.realProtocol" @change="saveToLocal">
          <el-radio-button label="http">HTTP</el-radio-button>
          <el-radio-button label="https">HTTPS</el-radio-button>
        </el-radio-group>
      </div>

      <!-- 主机地址输入 -->
      <div class="form-row">
        <label>主机地址</label>
        <el-input
            v-model="formData.realHost"
            placeholder="如 192.168.1.100 或 api.example.com"
            @change="saveToLocal"
        />
      </div>

      <!-- 端口输入 -->
      <div class="form-row">
        <label>端口</label>
        <el-input
            v-model="formData.realPort"
            placeholder="如 8080（留空则使用默认端口）"
            style="width: 200px"
            @change="saveToLocal"
        />
      </div>

      <!-- 接口前缀输入 -->
      <div class="form-row">
        <label>接口前缀</label>
        <el-input
            v-model="formData.realPrefix"
            placeholder="如 /api/v1"
            @change="saveToLocal"
        />
      </div>

      <!-- 真实接口地址预览 -->
      <div class="warning-box" style="background-color: #f0f9eb">
        <el-icon class="warn-icon" style="color: #67C23A"><CircleCheck /></el-icon>
        <div class="warn-content" style="color: #67C23A">
          预览地址：{{ realUrlPreview }}
        </div>
      </div>
    </div>
  </el-main>
</template>

<style scoped>
/* 保持原有样式，此处省略 */
.config-container { padding: 0; height: 100%; display: flex; flex-direction: column; overflow-y: auto; }
.config-header { padding: 20px 24px; border-bottom: 1px solid var(--border-color); font-size: 16px; font-weight: 600; color: #409EFF; }
.config-card { padding: 40px; max-width: 600px; display: flex; flex-direction: column; gap: 24px; }
.form-row { display: flex; align-items: center; }
.form-row label { width: 100px; color: var(--text-primary); font-size: 14px; }
.status-tag { display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 4px; background-color: #FDE2E2; color: #F56C6C; font-size: 14px; font-weight: 500; }
.status-tag.running { background-color: #E1F3D8; color: #67C23A; }
.port-group { display: flex; gap: 10px; flex: 1; }
.port-input { flex: 1; }
.check-btn { background-color: #FDF6EC; color: #E6A23C; border-color: #FDF6EC; }
.warning-box { background-color: #F4F4F5; border-radius: 6px; padding: 12px 16px; display: flex; gap: 10px; color: #E6A23C; font-size: 13px; line-height: 1.5; align-items: flex-start; }
.footer-actions { margin-top: 20px; display: flex; justify-content: center; gap: 20px; }
.action-btn { width: 140px; border-radius: 6px; }
.start-btn { background-color: #D1F2D9; color: #67C23A; border: none; }
.stop-btn { background-color: #FDE2E2; color: #F56C6C; border: none; }
</style>
