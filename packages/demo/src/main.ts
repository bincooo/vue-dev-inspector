import { createApp } from 'vue'
import Antd from 'antdv-next'
import 'antdv-next/dist/reset.css'
import App from './App.vue'

const app = createApp(App)
app.use(Antd)
app.mount('#app')

// 在控制台中提示用户如何使用 DevInspector
console.log(
  '%c[Demo App]%c vite-plugin-vue-dev-inspector 已集成\n' +
  '按 Alt+Shift+I 开启审查模式，鼠标悬停高亮元素，点击跳转到编辑器。',
  'color:#10b981;font-weight:bold',
  'color:inherit'
)
