/**
 * @vue-dev-inspector/core 顶层入口 -- 浏览器安全。
 */

import { vueDevInspector } from "./plugin";
export { vueDevInspector };
export type { DevInspectorOptions } from "./options";
export { DEFAULT_OPTIONS } from "./options";
export { createInspectorTransform } from "@vue-dev-inspector/pluginkit";
// 以下 helper 历史上只在 plugin 内部使用；为 uni 包薄封装复用而导出。
// 现已统一到 @vue-dev-inspector/pluginkit，此处仅做透传保持公共 API 不变。
export {
  offsetToLine,
  buildCfgJson,
  buildExpandScripts,
  loadOverlayScript,
} from "@vue-dev-inspector/pluginkit";
export default vueDevInspector;
