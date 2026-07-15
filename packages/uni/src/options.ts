import type { ComponentConfig } from "@vue-dev-inspector/shared";
import type { CdnBuilder } from "@vue-dev-inspector/utils";

/**
 * DevInspector 配置选项（从 `@vue-dev-inspector/core` 内联，移除 core 依赖）。
 *
 * 与 core 的 `DevInspectorOptions` 等价 —— uni 包不再透传 core，选项类型自带。
 */
export interface DevInspectorOptions {
  /** 是否启用（仅 dev 模式生效） @default true */
  enabled?: boolean;
  /** 排除文件的正则列表 @default [/node_modules/, /\.d\.ts$/] */
  exclude?: RegExp[];
  /**
   * 项目根目录列表 — monorepo 下声明可被审查/编辑的多个 sub-project 根。
   *
   * - 默认未配置时，使用 Vite 的 `config.root`（单根，行为与之前一致）。
   * - 配置后，落在任一根下的 `.vue` 文件都会被注入审查标记，
   *   并在服务端按声明顺序匹配解析。
   * - 不在任一根下的文件：跳过注入（不会污染 `data-source-file`）。
   * - 接收绝对路径或相对于 `config.root` 的路径；插件内部统一 `path.resolve`。
   */
  projectRoots?: string[];
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
  /**
   * 模板表达式解析器插件（透传给 compileTemplate 的 expressionPlugins）。
   *
   * 用于支持模板内联表达式中的 TS/装饰器/某些现代语法。
   * 在 `vue()` 插件中我们设的 `expressionPlugins` 不会自动扩散到这里 ———
   * 本插件提前调一次 `compileTemplate` 来跑 nodeTransforms 注入属性，
   * 因此必须在这里也声明，否则会报
   *   "Error parsing JavaScript expression: Unexpected token"
   * 默认与 `@vitejs/plugin-vue` 官方示例一致：开启 typescript。
   * @default ['typescript']
   */
  expressionPlugins?: Array<"typescript" | "jsx">;
  /**
   * CDN URL 构造器 —— 用于 `loadScript('cdn:<pkg>:<version>', ...)` 模式。
   *
   * 用户自定义 CDN 时传入；例如：
   *   cdn: (pkg, ver) => `https://cdn.jsdelivr.net/npm/${pkg}@${ver}`
   *
   * 插件入口处会调用 `setCdnBuilder(this.cdn)` 注入到 utils 模块；
   * 未配置时 `loadScript` 走 cdn: scheme 抛明确错误。
   *
   * 返回值可以是字符串或 Promise<string>（支持异步构造器）。
   */
  expandCdn?: CdnBuilder;
}

export const DEFAULT_OPTIONS: Required<
  Omit<DevInspectorOptions, "projectRoots" | "expandCdn">
> = {
  enabled: true,
  exclude: [/node_modules/, /\.d\.ts$/],
  attrName: "data-source-file",
  wrapComponents: [],
  editor: "vscode",
  shortcut: { altKey: true, shiftKey: true, code: "KeyI" },
  toggleBtn: true,
  componentConfig: [],
  expressionPlugins: [],
};

/**
 * uni-app 版 inspector 选项（兼容 `DevInspectorOptions`）。
 *
 * 额外提供：
 *   - `phoneShell`：注入虚拟 Phone 外观（仅 h5/web dev 模式生效）。
 *   - `platform`：显式覆盖目标平台（默认读 `process.env.UNI_PLATFORM`）。
 *     非浏览器平台（mp-\* / app / quickapp 等）下插件整体 no-op。
 */
export type UniDevInspectorOptions = DevInspectorOptions & {
  /**
   * 开启虚拟 Phone 外观（iPhone 经典款）。
   *
   * - `true`：默认 375×812 尺寸
   * - `{ width, height }`：自定义尺寸
   * - `false` / 省略：关闭
   *
   * 仅在浏览器平台（h5/web）+ dev + enabled 时生效，不污染运行时产物。
   */
  phoneShell?: boolean | { width?: number; height?: number };
  /**
   * 显式覆盖目标平台（默认从 `process.env.UNI_PLATFORM` 读取）。
   *
   * 用于无法通过 CLI `-p` 传递、或需强制指定的场景：
   *   - `platform: 'h5'` 可在 mp 构建里强制启用 inspector（调试用）；
   *   - `platform: 'mp-weixin'` 可在 h5 构建里强制 no-op。
   *
   * 非浏览器平台下 transform / overlay 注入 / dev server 全部跳过。
   */
  platform?: string;
};
