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
 * 在元素源码里定位开标签的 `>` 或 `/>` 的索引（跳过引号包裹的属性值）。
 *
 * - 自闭合：返回 `/>` 中 `>` 的索引；
 * - 非自闭合：返回开始标签结束 `>` 的索引（开标签本身通常紧接着 `<tag …>`）。
 *
 * 这是必要的，因为属性值里完全可能含字面 `>`，例如
 *   @click="() => onClick('x')"
 * 用朴素的 indexOf('>') 会先撞到表达式里的 `>`，把后续插入的属性怼到表达式中段。
 */
function findOpenTagEnd(source: string, isSelfClosing: boolean = false): number {
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (c === '"' || c === "'" || c === "`") {
      // 跳过整个引号串；不支持引号转义（HTML 属性里也没有这回事）。
      const quote = c;
      i++;
      while (i < source.length && source[i] !== quote) i++;
    } else if (
      (isSelfClosing && c === "/" && source[i + 1] === ">") ||
      (!isSelfClosing && c === ">")
    ) {
      return i;
    }
  }
  return source.length;
}

/** 注入到 `data-source-file` 属性的源码位置编码：`r<N>:<relativePath>:<line>:<col>`。 */
function formatSourceRef(
  rootIndex: number,
  relativePath: string,
  line: number,
  column: number,
): string {
  return `r${rootIndex}:${relativePath}:${line}:${column}`;
}

/**
 * 创建 AST 节点转换器：为每个普通元素/组件的开始标签
 * 注入 `${attrName}="rN:relativePath:line:col"`。
 *
 * 列在 `wrapComponents` 中的组件名会改用 `display:contents` 的 span
 * 包裹整个组件标签，标记只挂在 span 上（不注入到组件标签本身）。
 * 这样可修复 `inheritAttrs:false` / 多根 / Teleport 等
 * 导致 fallthrough attrs 丢失审查标记的第三方组件。
 *
 * @param s                 MagicString 实例，作用在整个 SFC 源码上
 * @param template          SFC 的 template 块描述（含 content 和 loc.start.offset）
 * @param sourceRef         { rootIndex, relativePath } — 注入到属性值
 * @param attrName          要注入的属性名，默认 data-source-file
 * @param wrapComponents    需要用 span 包裹的组件名列表
 * @param templateLine      template 内容在 SFC 文件中的**起始行号**（1-based）。
 *                          AST 给出的 `el.loc.start.line` 是相对 template.content
 *                          的 1-based 行号；当 `<script>` 在 `<template>` 上方时，
 *                          必须加上 SFC 全文里的偏移，否则点击跳转会落到
 *                          template 块内偏前的位置（典型差 N 行，N = script 行数）。
 *                          template 内容通常从行首开始（`<template>\n` 之后），
 *                          所以列号不需要调整。
 */
export function createInspectorTransform(
  s: MagicString,
  template: { content: string; loc: { start: { offset: number } } },
  sourceRef: { rootIndex: number; relativePath: string },
  attrName: string,
  wrapComponents: string[],
  templateLine: number,
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

    // AST 行号是相对 template.content 的 1-based；
    // 转成 SFC 全文行号要加 template 内容在文件里的起始行。
    const { line, column } = el.loc.start;
    const fileLine = templateLine + line - 1;
    const start = template.loc.start.offset + el.loc.start.offset;
    const ref = formatSourceRef(sourceRef.rootIndex, sourceRef.relativePath, fileLine, column);

    // 列在 wrapComponents 中的组件：用 span 包裹，标记挂 span
    if (
      el.tagType === ElementTypes.COMPONENT &&
      wrapSet &&
      wrapSet.has(el.tag)
    ) {
      const end = start + el.loc.source.length;
      s.appendLeft(
        start,
        `<span ${attrName}="${ref}" data-inspector-tag="${el.tag}" data-inspector-wrap style="display:contents">`,
      );
      s.appendRight(end, "</span>");
      return;
    }

    // 原生元素及非 wrap 组件：在开始标签的 `>` 前注入属性
    // （自闭合元素找 `/>`），那就是开标签结束符的位置。
    const insertPos = start + findOpenTagEnd(el.loc.source, el.isSelfClosing);
    const tagAttr =
      el.tagType === ElementTypes.COMPONENT
        ? ` data-inspector-tag="${el.tag}"`
        : "";
    s.appendLeft(
      insertPos,
      ` ${attrName}="${ref}"${tagAttr}`,
    );
  };
}