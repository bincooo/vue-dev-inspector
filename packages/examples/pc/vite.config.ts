/**
 * packages/demo/vite.config.ts
 *
 * Demo 项目的 Vite 配置 — 展示 @vue-dev-inspector/core 的实际接入。
 *
 * 使用方式：
 *   cd packages/demo
 *   npx vite          # 启动 dev server
 *   # 浏览器中按 Alt+Shift+I 开启审查模式
 */
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
// 在 monorepo 中直接引用本地插件源码
import vueDevInspector from "@vue-dev-inspector/core";
import antdv from "@vue-dev-inspector/antdv";

export default defineConfig({
  plugins: [
    // ⚠️ vueDevInspector 必须放在 vue() 之前
    vueDevInspector({
      // 提供expandCdn属性实现定制化cdn
      // expendCdn: (pkg: string, version: string) => {
      //   return `https://cdn.jsdelivr.net/npm/${pkg}@${version}/expend.iife.js`
      // },
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

      // 经 Teleport/Portal 动态挂到 body 的组件：data-source-file 会在挂载过程
      // 中丢失，改把位置信息编码进 class（class 能透传到挂载后的根元素），
      // overlay 运行时解码 class 后重新写回 data-source-file
      portalComponents: ["*modal"],

      // 编辑器类型
      editor: "vscode",

      // 默认启用齿轮按钮
      toggleBtn: true,

      // 组件面板拓展 ——
      // 通过 plugin 形式注入；将来支持 element-plus / 自定义组件目录，
      // 只需新增对应包并在此处 append 工厂调用。
      componentConfig: [antdv()],

      projectRoots: ["."],
    }),

    vue(),
  ],
  server: {
    host: "0.0.0.0",
  },
});
