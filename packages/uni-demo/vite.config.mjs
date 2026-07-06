/**
 * packages/uni-demo/vite.config.mjs
 *
 * uni H5 demo —— 验证 @vue-dev-inspector/uni 的端到端行为。
 *
 * ⚠ @vue/shared 别名：@dcloudio/vite-plugin-uni 内置的 uniResolveIdPlugin
 * 会把 `@vue/shared` 解析到它自带的 3.4.21（无 normalizeCssVarValue）。
 * 而 devDependencies 里的 @vue/runtime-core@3.5.38 依赖 normalizeCssVarValue，
 * 直接 build 会 rollup 报 "is not exported"。这里显式 alias 把 @vue/shared
 * 指向项目内的 3.5.38 版本，覆盖 uni 的 3.4.21 内置解析。
 */
import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { uniDevInspector } from "@vue-dev-inspector/uni";
import uni from "@dcloudio/vite-plugin-uni";

// 配置文件所在目录（= uni-demo 根），用相对路径定位 3.5.38 的 @vue/shared
const configDir = path.dirname(fileURLToPath(import.meta.url));
const vueSharedEsm = path.resolve(
  configDir,
  "node_modules/@vue/shared/dist/shared.esm-bundler.js",
);

function resolvePlugin(module, options) {
  return (module?.default || module)(options)
}

export default defineConfig({
  plugins: [
    uniDevInspector({
      enabled: true,
      attrName: "data-source-file",
      editor: "vscode",
      exclude: [/node_modules/],
      projectRoots: ["."],
      phoneShell: true,
    }),
    resolvePlugin(uni),
  ],
  resolve: {
    alias: {
      "@vue/shared": vueSharedEsm,
    },
  },
  server: { host: "0.0.0.0" },
});