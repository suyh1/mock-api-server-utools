<script setup lang="ts">
import { ref, watch, computed } from 'vue';
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

// 后端管理地址
const ADMIN_API = 'http://localhost:3000/_admin/service';

const formData = ref<ServiceConfig>({
  port: 3000,
  prefix: '',
  running: false
});

const isRunning = computed(() => formData.value.running);

// 监听 group 变化，初始化数据
watch(() => props.group, async (newGroup) => {
  if (newGroup) {
    // 尝试从本地状态恢复，或者使用默认值
    formData.value = {
      port: newGroup.config?.port || 3888,
      prefix: newGroup.config?.prefix || '',
      running: false // 默认为 false，通过下方 fetchStatus 同步真实状态
    };
    await syncStatus();
  }
}, { immediate: true });

// 从后端同步真实运行状态
const syncStatus = async () => {
  try {
    const res = await fetch(`${ADMIN_API}/status`);
    const statusMap = await res.json();
    if (statusMap[props.group.id]) {
      formData.value.running = true;
      // 如果后端正在运行，强制使用后端的端口和前缀显示，防止不一致
      formData.value.port = statusMap[props.group.id].port;
      formData.value.prefix = statusMap[props.group.id].prefix;
    } else {
      formData.value.running = false;
    }
  } catch (e) {
    console.error('Failed to sync status', e);
  }
};

// 保存配置到 JSON (不影响运行状态)
const saveToLocal = () => {
  const updatedGroup = {
    ...props.group,
    config: { ...formData.value } // 注意：这里会把 running 状态也存进去，但后端重启后会重置
  };
  emit('update:group', updatedGroup);
  emit('save');
};

// 检测端口
const handleCheckPort = async () => {
  try {
    const res = await fetch(`${ADMIN_API}/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ port: formData.value.port })
    });
    const data = await res.json();
    if (data.available) {
      ElMessage.success(`端口 ${formData.value.port} 可用`);
    } else {
      ElMessage.error(`端口 ${formData.value.port} 已被占用`);
    }
  } catch (e) {
    ElMessage.error('检测失败');
  }
};

// 启动服务
const handleStart = async () => {
  try {
    const res = await fetch(`${ADMIN_API}/start`, {
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
      saveToLocal(); // 保存配置
      ElMessage.success(`服务已启动 http://localhost:${formData.value.port}${formData.value.prefix}`);
    } else {
      ElMessage.error('启动失败: ' + (data.error || '未知错误'));
    }
  } catch (e: any) {
    ElMessage.error('启动异常: ' + e.message);
  }
};

// 关闭服务
const handleStop = async () => {
  try {
    const res = await fetch(`${ADMIN_API}/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupId: props.group.id })
    });
    formData.value.running = false;
    saveToLocal();
    ElMessage.success('服务已关闭');
  } catch (e) {
    ElMessage.error('停止失败');
  }
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
          服务配置成功后，启动服务，将自动配置当前目录下所有子接口接口前缀；如需重新配置，请先关闭服务
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
.config-container {
  padding: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
}
.config-header {
  padding: 20px 24px;
  border-bottom: 1px solid var(--border-color);
  font-size: 16px;
  font-weight: 600;
  color: #409EFF; /* 蓝色标题 */
}
.config-card {
  padding: 40px;
  max-width: 600px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.form-row {
  display: flex;
  align-items: center;
}
.form-row label {
  width: 100px;
  color: var(--text-primary);
  font-size: 14px;
}
.status-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: 4px;
  background-color: #FDE2E2; /* 浅红 */
  color: #F56C6C; /* 红色 */
  font-size: 14px;
  font-weight: 500;
}
.status-tag.running {
  background-color: #E1F3D8; /* 浅绿 */
  color: #67C23A; /* 绿色 */
}
.port-group {
  display: flex;
  gap: 10px;
  flex: 1;
}
.port-input {
  flex: 1;
}
.check-btn {
  background-color: #FDF6EC;
  color: #E6A23C;
  border-color: #FDF6EC;
}
.check-btn:hover {
  background-color: #FAECD8;
}

.warning-box {
  background-color: #F4F4F5;
  border-radius: 6px;
  padding: 12px 16px;
  display: flex;
  gap: 10px;
  color: #E6A23C;
  font-size: 13px;
  line-height: 1.5;
  align-items: flex-start;
}
.warn-icon {
  font-size: 16px;
  margin-top: 2px;
}

.footer-actions {
  margin-top: 20px;
  display: flex;
  justify-content: center;
  gap: 20px;
}
.action-btn {
  width: 140px;
  border-radius: 6px;
}
.start-btn {
  background-color: #D1F2D9; /* 极浅绿背景 */
  color: #67C23A;
  border: none;
}
.start-btn:hover {
  background-color: #C2E7B0;
}
.stop-btn {
  background-color: #FDE2E2;
  color: #F56C6C;
  border: none;
}
.stop-btn:hover {
  background-color: #FAB6B6;
}
</style>