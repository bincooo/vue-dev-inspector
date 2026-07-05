import { createSSRApp } from "vue";
import App from "./App.vue";

/**
 * uni-app Vue3 入口。`uni()` 插件会以其约定的方式接管等价于 SPA mount 的部分。
 */
export function createApp() {
  const app = createSSRApp(App);
  return { app };
}