/**
 * @vue-dev-inspector/pluginkit -- core 与 uni 共享的插件公共逻辑。
 *
 * 抽出原因：core 与 uni 的 Vite 插件曾各自内联一份几乎相同的 AST transform
 * 与配置序列化 helper。本包统一这些纯逻辑，消除重复。
 *
 * **编译环境隔离**：本包不 import `@vue/compiler-sfc`（core 用 ESM import，
 * uni 必须走 createRequire + priming 预热）；需要 `parse` 的工具由调用方注入
 * `SfcParser`。tsup 构建把 `@vue/compiler-sfc` 标记 external，保证不打包。
 */
export {
  createInspectorTransform,
} from "./transform";

export {
  offsetToLine,
  getDiskTemplateLine,
  getDiskTemplate,
  buildDiskLineMap,
  loadOverlayScript,
  type SfcParser,
} from "./template";

export {
  buildCfgJson,
  buildExpandScripts,
  type ResolvedInspectorOptions,
} from "./config";
