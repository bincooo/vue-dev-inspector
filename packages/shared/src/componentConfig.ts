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
  groups: ComponentGroup[];
}

/** vueDevInspector 选项 componentConfig 的取值类型 */
export type ComponentConfig = ComponentConfigEntry[];
