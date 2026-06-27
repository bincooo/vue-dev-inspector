/**
 * packages/demo/vite.config.ts
 *
 * Demo 项目的 Vite 配置 — 展示 vite-plugin-vue-dev-inspector 的实际接入。
 *
 * 使用方式：
 *   cd packages/demo
 *   npx vite          # 启动 dev server
 *   # 浏览器中按 Alt+Shift+I 开启审查模式
 */
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
// 在 monorepo 中直接引用本地插件源码
// 发布后用户只需: import vueDevInspector from 'vite-plugin-vue-dev-inspector'
import { vueDevInspector } from "@vue-dev-inspector/core";

export default defineConfig({
  plugins: [
    // ⚠️ vueDevInspector 必须放在 vue() 之前
    vueDevInspector({
      // 仅在 dev 模式下启用（默认 true）
      enabled: true,

      // 排除不需要标记的文件
      exclude: [/node_modules/],

      // 注入的属性名
      // 格式: data-source-file="src/components/Card.vue:3:5"
      attrName: "data-source-file",

      // 这些组件因 inheritAttrs:false / Teleport 等导致 fallthrough attrs
      // 丢失审查标记，改用 display:contents 的 span 包裹，标记挂 span
      wrapComponents: ["a-date-picker", "a-input-password"],

      // 编辑器类型
      editor: "vscode",

      // 默认启用齿轮按钮
      toggleBtn: true,
    }),

    vue(),
  ],
});
