import type { NodeTransform, ElementNode } from "@vue/compiler-core";
import { NodeTypes, ElementTypes } from "@vue/compiler-core";
import type MagicString from "magic-string";

/** 不注入属性的 Vue 内置/特殊标签 */
const SKIP_TAGS = new Set([
  "template",
  "slot",
  "component",
  "transition",
  "transition-group",
  "keep-alive",
  "teleport",
  "suspense",
]);

/**
 * 创建 AST 节点转换器：为每个普通元素/组件的开始标签
 * 注入 `${attrName}="filePath:line:col"`。
 *
 * 列在 `wrapComponents` 中的组件名会改用 `display:contents` 的 span
 * 包裹整个组件标签，标记只挂在 span 上（不注入到组件标签本身）。
 * 这样可修复 `inheritAttrs:false` / 多根 / Teleport 等
 * 导致 fallthrough attrs 丢失审查标记的第三方组件。
 */
export function createInspectorTransform(
  s: MagicString,
  template: { content: string; loc: { start: { offset: number } } },
  filePath: string,
  attrName: string,
  wrapComponents: string[],
): NodeTransform {
  const wrapSet = wrapComponents.length ? new Set(wrapComponents) : null;

  return (node) => {
    if (node.type !== NodeTypes.ELEMENT) return;
    const el = node as ElementNode;
    if (SKIP_TAGS.has(el.tag)) return;
    if (
      el.tagType !== ElementTypes.ELEMENT &&
      el.tagType !== ElementTypes.COMPONENT
    )
      return;

    const { line, column } = el.loc.start;
    const start = template.loc.start.offset + el.loc.start.offset;

    // 列在 wrapComponents 中的组件：用 span 包裹，标记挂 span
    if (
      el.tagType === ElementTypes.COMPONENT &&
      wrapSet &&
      wrapSet.has(el.tag)
    ) {
      const end = start + el.loc.source.length;
      s.appendLeft(
        start,
        `<span ${attrName}="${filePath}:${line}:${column}" data-inspector-tag="${el.tag}" data-inspector-wrap style="display:contents">`,
      );
      s.appendRight(end, "</span>");
      return;
    }

    // 原生元素及非 wrap 组件：在开始标签的 `>` 前注入属性
    const closeSeq = el.isSelfClosing ? "/>" : ">";
    const insertPos = start + el.loc.source.indexOf(closeSeq);
    const tagAttr =
      el.tagType === ElementTypes.COMPONENT
        ? ` data-inspector-tag="${el.tag}"`
        : "";
    s.appendLeft(
      insertPos,
      ` ${attrName}="${filePath}:${line}:${column}"${tagAttr}`,
    );
  };
}
