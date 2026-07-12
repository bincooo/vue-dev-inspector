import { createSSRApp } from "vue";
import uViewPro from "uview-pro";
import App from "./App.vue";

/**
 * uni-app Vue3 入口。`uni()` 插件会以其约定的方式接管等价于 SPA mount 的部分。
 *
 * uview-pro：注册插件挂 `$u`、初始化主题/语言；`u-*` 组件由 pages.json 的
 * easycom 自动引入，无需在此手动注册。
 */
export function createApp() {
  const app = createSSRApp(App);
  app.use(uViewPro);
  return { app };
}
