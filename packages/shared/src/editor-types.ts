/**
 * 跨 client / overlay 共享的 AST 编辑器数据类型。
 *
 * 仅类型导出，无运行时副作用。放在 shared 是为了打断 client↔overlay
 * 在「子节点源码」编辑数据形状上的耦合（client 输出 → overlay 消费）。
 */

/**
 * 选中元素的「子节点源码」区间。
 *
 * - `content` 是开标签 `>` 与闭标签 `</tag>` 之间的原始模板串
 *   （含文本 / 子元素 / 插值 / 注释，未做任何改写）。
 *   例：`<div>1<span>2</span>3</div>` → `content = "1<span>2</span>3"`。
 * - `start` / `end` 是 SFC 全文字节偏移，对应 `content` 在 SFC 中的源码区间。
 *   自闭合元素（`<a-input />`）区间为零长度（`start === end`），content 为 ""。
 *   服务端 update 用这两个值做 MagicString overwrite / prependRight。
 */
export interface ChildTextData {
  content: string;
  start: number;
  end: number;
}
