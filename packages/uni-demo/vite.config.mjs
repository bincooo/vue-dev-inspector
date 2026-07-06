/**
 * packages/uni-demo/vite.config.mjs
 *
 * uni H5 demo —— 验证 @vue-dev-inspector/uni 的端到端行为。
 *
 * ⚠ Vue 版本对齐：@dcloudio/vite-plugin-uni（及其 @vitejs/plugin-vue@5.2.4
 * 与 uni-cli-shared）写死 @vue/compiler-*@3.4.21，编译 SFC 用 3.4.21。
 * 因此本 demo 的 vue 运行时也必须用 3.4.21 —— 若用 3.5.x 运行时，
 * 编译期(3.4)与运行期(3.5)版本错配，HMR rerender 会抛 "_" is read-only
 * （3.4 编译的 _hoisted/_withCtx 产物与 3.5 运行时的 _cache 契约不符；
 * 全量刷新能容忍，热更新不能）。inspector 自身的 @vue-dev-inspector/uni
 * 内部用自带 @vue/compiler-sfc@3.5.38 仅做源码定位注入，与运行时无关。
 */
import { defineConfig } from "vite";
import { uniDevInspector } from "@vue-dev-inspector/uni";
import uview from "@vue-dev-inspector/uview";
import uni from "@dcloudio/vite-plugin-uni";

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
      // 组件面板 —— uview-pro 物料描述（tag/label/icon/snippet）
      componentConfig: [uview()],
    }),
    resolvePlugin(uni),
  ],
  server: { host: "0.0.0.0" },
});
