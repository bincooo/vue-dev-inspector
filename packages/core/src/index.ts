/**
 * @vue-dev-inspector/core 顶层入口 —— 浏览器安全。
 */

import { vueDevInspector } from "./plugin";
export { vueDevInspector };
export type { DevInspectorOptions } from "./options";
export { DEFAULT_OPTIONS } from "./options";
export { createInspectorTransform } from "./transform";
// 以下 helper 历史上只在 plugin 内部使用；为 uni 包薄封装复用而导出。
// 都是纯函数 / 懒读盘单例，对 PC 行为零影响。
export {
  offsetToLine,
  buildCfgJson,
  buildExpandScripts,
  loadOverlayScript,
} from "./plugin";
export default vueDevInspector;
