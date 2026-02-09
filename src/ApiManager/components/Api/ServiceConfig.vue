<script setup lang="ts">
import { ref, watch, computed, onMounted } from 'vue';
import { VideoPlay, SwitchButton, CircleCheck, Warning } from '@element-plus/icons-vue';
import type { MockGroup, ServiceConfig } from '@/types/mock';
import { ElMessage } from 'element-plus';

const props = defineProps<{
  group: MockGroup;
}>();

const emit = defineEmits<{
  (e: 'update:group', group: MockGroup): void;
  (e: 'save'): void;
}>();

const localIp = ref('localhost');
const ADMIN_API = ref('http://localhost:3000/_admin/service');

const formData = ref<ServiceConfig>({
  port: 3000,
  prefix: '',
  running: false
});

const isRunning = computed(() => formData.value.running);

onMounted(async () => {
  if (window.services) {
    localIp.value = window.services.getLocalIP();
    ADMIN_API.value = `${window.services.getServerUrl()}/_admin/service`;
  }

  // 【修复点】确保在 IP 和 API 地址更新后，再执行一次状态同步
  await syncStatus();
});

// 初始化数据
watch(() => props.group, async (newGroup) => {
  if (newGroup) {
    formData.value = {
      port: newGroup.config?.port || 3888, // 默认 3888
      prefix: newGroup.config?.prefix || '',
      running: false
    };
    await syncStatus();
  }
}, { immediate: true });

// 【修复】同步状态逻辑
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

const saveToLocal = () => {
  const updatedGroup = {
    ...props.group,
    config: { ...formData.value }
  };
  emit('update:group', updatedGroup);
  emit('save');
};

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
  <el-main class="config-container">
    <div class="config-header">
      <span class="title">服务配置</span>
    </div>

    <div class="config-card">
      <div class="form-row">
        <label>服务状态</label>
        <div class="status-tag" :class="{ running: isRunning }">
          <el-icon v-if="isRunning"><CircleCheck /></el-icon>
          <el-icon v-else><SwitchButton /></el-icon>
          <span>{{ isRunning ? '运行中' : '已关闭' }}</span>
        </div>
      </div>

      <div class="form-row">
        <label>接口前缀</label>
        <el-input
            v-model="formData.prefix"
            placeholder="/api"
            :disabled="isRunning"
            @change="saveToLocal"
        />
      </div>

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

      <div class="warning-box">
        <el-icon class="warn-icon"><Warning /></el-icon>
        <div class="warn-content">
          提示：请先保存配置再启动服务。启动后，可通过 <a :href="`http://${localIp}:${formData.port}`" target="_blank">http://{{localIp}}:{{formData.port}}</a> 访问根路径检查服务状态。
        </div>
      </div>

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
  </el-main>
</template>

<style scoped>
/* 保持原有样式，此处省略 */
.config-container { padding: 0; height: 100%; display: flex; flex-direction: column; }
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