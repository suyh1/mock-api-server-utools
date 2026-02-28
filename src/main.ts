import { createApp } from "vue";
import 'element-plus/theme-chalk/dark/css-vars.css'
import 'element-plus/es/components/message/style/css'
import 'element-plus/es/components/message-box/style/css'
import "./main.css";
import App from "./App.vue";

const app = createApp(App);
app.mount('#app')
