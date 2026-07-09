/**
 * 组件面板配置类型（共享给 core 与 overlay）。
 *
 * 每个组件扩展包导出一个工厂函数，返回 ComponentConfigEntry。
 * 多个 entry 通过 vueDevInspector({ componentConfig: [...] }) 注入，
 * 在 dev 模式下被序列化到 window.__DEV_INSPECTOR_CFG__.componentGroups，
 * 最终由 overlay 的组件抽屉消费。
 */

/** 单个可插入的组件项 */
export interface ComponentItem {
  /** 组件标签名，会作为 componentTag 传给 /insert-component */
  tag: string;
  /** 抽屉列表里展示的标题（含中文名） */
  label: string;
  /** 整段模板字符串（被 AST 原样写入 .vue） */
  snippet: string;
  /**
   * 可选图标 —— 在抽屉右侧列表的「item-icon」方块中渲染。
   *
   * 支持两种格式：
   *   - 纯文本/emoji：如 "🧩" "🅰" "ABC"
   *   - iconify 短串：如 "i-ant-design:button" "i-mdi:apple"
   *     （runtime 由 overlay 内部集成的 iconify 解析为 SVG）
   *
   * 缺省时回退到 tag 前 2 字符（保持向后兼容）。
   */
  icon?: string;
  /**
   * 可选导入声明 -- 插入该组件时由服务端按需写入 `<script>`。
   *
   * 每条是完整的 import 语句字符串，例如：
   *   'import { Button } from "antdv-next"'
   *   'import { Input, InputPassword } from "antdv-next"'
   *   'import type { PropType } from "vue"'
   *
   * 服务端解析每条语句的「模块说明符 + 具名 / 默认 / 命名空间绑定」，
   * 先扫描目标 `<script>` 现有 import 再决定写法（详见 client 的 `ensureImports`）：
   *   - 模块未导入              -> 追加整条原始语句
   *   - 模块已导入、缺具名        -> 并入现有具名子句（`{ A, B }` 的 `}` 前）
   *   - 模块已导入、缺默认/命名空间 或无具名子句 -> 追加仅含缺失绑定的新语句
   *   - 全部已存在              -> 跳过（幂等）
   *
   * 缺省（不声明）则插入组件时不动 `<script>`，保持向后兼容。
   */
  imports?: string[];
}

/** 一个分组（抽屉里的二级分组） */
export interface ComponentGroup {
  /** 分组标题，例如 "antdv/通用" */
  group: string;
  items: ComponentItem[];
}

/** 一个扩展包的整体目录 */
export interface ComponentConfigEntry {
  /** 扩展包名（日志/调试用，不影响运行时） */
  name: string;
  /**
   * 可选图标 —— 在抽屉左侧物料 tab 上渲染。
   * 缺省时回退到 name 的首字符（保持向后兼容）。
   */
  icon?: string;
  /**
   * 可选浏览器侧拓展脚本 —— 由 core 插件在 dev 模式下追加到 HTML。
   *
   * 典型场景：物料库自带一段 demo/事件订阅代码（例如 antdv 的 demo 按钮注册、
   * 事件埋点），通过 `addToolBtn` / `onInspect` / `onSelect` 接入 overlay。
   *
   * 内容由物料库构建时通过 `loadScript(...)` 读出 / 算出：
   *   - `loadScript('pkg:...', './<out-name>')` 返回已构建的 JS 文件文本
   *     （IIFE / ESM），core 插件会以内联 `<script type="module">…</script>`
   *     形式注入。
   *   - `loadScript('cdn:<pkg>:<ver>', './<relPath>')` 返回 CDN 上的 URL
   *     字符串，core 插件会以 `<script type="module" src="…">` 形式注入，
   *     **不下载**。
   *
   * 字段类型为 `string`：URL 字符串或内联脚本体都按 string 传，core 在
   * `transformIndexHtml` 阶段根据"是否以 http(s):// 或 // 开头"决定用
   * `<script src=...>` 还是内联 `<script>...</script>`。
   *
   * 不填则不注入拓展脚本。
   */
  expand?: string;
  groups: ComponentGroup[];
}

/** vueDevInspector 选项 componentConfig 的取值类型 */
export type ComponentConfig = ComponentConfigEntry[];
