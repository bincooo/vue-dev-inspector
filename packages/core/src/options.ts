/** 共享类型来自 shared 包（API_PREFIX / EDITOR_PROTOCOLS / 组件目录类型） */
import type { ComponentConfig } from "@vue-dev-inspector/shared";

/** DevInspector 配置选项 */
export interface DevInspectorOptions {
  /** 是否启用（仅 dev 模式生效） @default true */
  enabled?: boolean;
  /** 排除文件的正则列表 @default [/node_modules/, /\.d\.ts$/] */
  exclude?: RegExp[];
  /** 注入的属性名 @default 'data-source-file' */
  attrName?: string;
  /**
   * 需要用 span（display:contents）包裹的组件名列表。
   *
   * 列表中的组件会把审查标记挂在包装 span 上，而不是组件标签本身 ——
   * 用于修复 `inheritAttrs:false` / 多根 / Teleport 等导致 fallthrough attrs
   * 丢失的第三方组件（如 a-date-picker）。列表外的组件照旧把属性注入到组件标签上。
   * @default []
   */
  wrapComponents?: string[];
  /** 编辑器类型 @default 'vscode' */
  editor?: "vscode" | "webstorm" | "atom" | "sublime";
  /** 快捷键 @default { altKey: true, shiftKey: true, code: 'KeyI' } */
  shortcut?: {
    altKey?: boolean;
    shiftKey?: boolean;
    ctrlKey?: boolean;
    metaKey?: boolean;
    code: string;
  };
  /**
   * 是否显示右下角齿轮按钮来开启/关闭审查模式。
   * 开启审查后按钮隐藏，关闭审查后按钮显示。
   * @default true
   */
  toggleBtn?: boolean;
  /**
   * 组件面板扩展条目（来自 antdv / element-plus / 自定义插件）。
   *
   * 每个 entry 是一个独立的组件目录（antdvMaterial() 返回值即为典型 entry），
   * dev 启动时被序列化到 window.__DEV_INSPECTOR_CFG__.componentGroups，
   * 由 overlay 的「🧩 组件面板」抽屉分组渲染。
   *
   * 数组顺序决定分组渲染顺序；未配置时抽屉回退到内置 antdv 列表。
   * @default []
   */
  componentConfig?: ComponentConfig;
}

export const DEFAULT_OPTIONS: Required<DevInspectorOptions> = {
  enabled: true,
  exclude: [/node_modules/, /\.d\.ts$/],
  attrName: "data-source-file",
  wrapComponents: [],
  editor: "vscode",
  shortcut: { altKey: true, shiftKey: true, code: "KeyI" },
  toggleBtn: true,
  componentConfig: [],
};
