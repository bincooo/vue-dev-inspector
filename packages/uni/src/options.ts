import type { DevInspectorOptions } from "@vue-dev-inspector/core";

/**
 * uni-app H5 版 inspector 选项（兼容 `DevInspectorOptions`）。
 *
 * 额外提供 `phoneShell` 开关注入虚拟手机外观。
 */
export type UniDevInspectorOptions = DevInspectorOptions & {
  /**
   * 开启虚拟 Phone 外观（iPhone 经典款）。
   *
   * - `true`：默认 375×812 尺寸
   * - `{ width, height }`：自定义尺寸
   * - `false` / 省略：关闭
   *
   * 仅在 dev 模式 + enabled 时生效，不污染运行时产物。
   */
  phoneShell?: boolean | { width?: number; height?: number };
};