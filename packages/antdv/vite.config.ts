/**
 * @vue-dev-inspector/antdv 浏览器侧拓展脚本构建配置。
 *
 * 与 src/index.ts（Node 平台 ESM 插件）并行，单独输出
 * `dist/expand.iife.js`，供 antdv 工厂函数在
 * `ComponentConfigEntry.expand` 字段注入给 core 插件。
 *
 * IIFE 形式与 @vue-dev-inspector/overlay 保持一致——IIFE 体内可直接调用顶层语句，
 * 无需 module wrapper；core 插件在 transformIndexHtml 末尾以
 * <script type="module"> 包裹。
 *
 * 不开 vite-plugin-singlefile：本入口没有 CSS 资源，输出仅一个 JS。
 */
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: "src/expand.ts",
      formats: ["iife"],
      // IIFE 格式必须给一个全局变量名；本产物不挂全局，仅为通过 Vite 配置校验。
      name: "VdiAntdvExpand",
      fileName: () => "expand.iife.js",
    },
    outDir: "dist",
    minify: false,
    emptyOutDir: false,
    rollupOptions: {
      output: {
        globals: {},
      },
    },
  },
});
