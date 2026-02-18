import{createApp}from"vue";
import ElementPlus from "element-plus";
import 'element-plus/dist/index.css';
import 'element-plus/theme-chalk/dark/css-vars.css' // 【新增】引入暗黑模式变量
import * as ElementPlusIconsVue from '@element-plus/icons-vue';
import"./main.css";
import App from"./App.vue";

const app = createApp(App);
// 注册所有图标
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
    app.component(key, component)
}

app.use(ElementPlus)
app.mount('#app')