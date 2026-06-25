/** DevInspector 配置选项 */
export interface DevInspectorOptions {
  /** 是否启用（仅 dev 模式生效） @default true */
  enabled?: boolean
  /** 排除文件的正则列表 @default [/node_modules/, /\.d\.ts$/] */
  exclude?: RegExp[]
  /** 注入的属性名 @default 'data-source-file' */
  attrName?: string
  /**
   * 需要用 span（display:contents）包裹的组件名列表。
   *
   * 列表中的组件会把审查标记挂在包装 span 上，而不是组件标签本身 ——
   * 用于修复 `inheritAttrs:false` / 多根 / Teleport 等导致 fallthrough attrs
   * 丢失的第三方组件（如 a-date-picker）。列表外的组件照旧把属性注入到组件标签上。
   * @default []
   */
  wrapComponents?: string[]
  /** 编辑器类型 @default 'vscode' */
  editor?: 'vscode' | 'webstorm' | 'atom' | 'sublime'
  /** 快捷键 @default { altKey: true, shiftKey: true, code: 'KeyI' } */
  shortcut?: {
    altKey?: boolean
    shiftKey?: boolean
    ctrlKey?: boolean
    metaKey?: boolean
    code: string
  }
  /**
   * 是否显示右下角齿轮按钮来开启/关闭审查模式。
   * 开启审查后按钮隐藏，关闭审查后按钮显示。
   * @default true
   */
  toggleBtn?: boolean
}

export const DEFAULT_OPTIONS: Required<DevInspectorOptions> = {
  enabled: true,
  exclude: [/node_modules/, /\.d\.ts$/],
  attrName: 'data-source-file',
  wrapComponents: [],
  editor: 'vscode',
  shortcut: { altKey: true, shiftKey: true, code: 'KeyI' },
  toggleBtn: true,
}

/** 编辑器 URL Protocol 映射 */
export const EDITOR_PROTOCOLS: Record<string, string> = {
  vscode: 'vscode://file/',
  webstorm: 'webstorm://open?file=',
  atom: 'atom://open?url=file://',
  sublime: 'subl://open?url=file://',
}

/** API 路径前缀 */
export const API_PREFIX = '/__dev-inspector-api__'