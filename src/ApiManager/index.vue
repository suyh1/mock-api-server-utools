<script setup>
import { ref } from 'vue';
import ActivityBar from './components/ActivityBar.vue';
import ApiPanel from './components/Api/ApiPanel.vue';

const activeTab = ref('api');
</script>

<template>
  <div class="app-wrapper">
    <ActivityBar v-model="activeTab" />

    <div class="content-area">

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
          <p>版本 v1.1.0 (Component Refactored)</p>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
.app-wrapper { display: flex; height: 100vh; width: 100vw; background-color: #f5f7fa; overflow: hidden; }
.content-area { flex: 1; display: flex; flex-direction: column; overflow: hidden; background: #fff; }
.placeholder-module { height: 100%; display: flex; justify-content: center; align-items: center; flex-direction: column; }
.about-content { text-align: center; color: #666; }
</style>