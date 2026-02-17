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
  server: {
    port: 5173
  }
})