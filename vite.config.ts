import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from "node:path";

export default defineConfig({
  plugins: [vue()],
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src') // 关键配置：将 @ 映射到 src 目录
    }
  },
  build: {
    // 1. 禁止生成 .map 调试文件 (解决 .map 报错)
    sourcemap: false,

    // 2. 确保输出目录干净 (可选，Vite默认会清空)
    emptyOutDir: true,

    // 3. 这里的配置通常不需要动，保持原样即可
    outDir: 'dist',
  },
  server: {
    port: 5173
  }
})