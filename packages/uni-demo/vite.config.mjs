/**
 * packages/uni-demo/vite.config.mjs
 *
 * uni H5 demo —— 验证 @vue-dev-inspector/uni 的端到端行为。
 */
import { defineConfig } from "vite";
import { createRequire } from "node:module";
import { uniDevInspector } from "@vue-dev-inspector/uni";
import uni from "@dcloudio/vite-plugin-uni";
import { isH5 } from '@uni-helper/uni-env'

function resolvePlugin(module, options) {
  return (module?.default || module)(options)
}

export default defineConfig({
  plugins: [
    uniDevInspector({
      enabled: isH5,
      attrName: "data-source-file",
      editor: "vscode",
      exclude: [/node_modules/],
      projectRoots: ["."],
      phoneShell: true,
    }),
    resolvePlugin(uni),
  ],
  server: { host: "0.0.0.0" },
});