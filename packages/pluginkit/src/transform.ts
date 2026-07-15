import type {
  NodeTransform,
  ElementNode,
  AttributeNode,
} from "@vue/compiler-core";
import { NodeTypes, ElementTypes } from "@vue/compiler-core";
import type MagicString from "magic-string";
import { encodeSourceClass } from "@vue-dev-inspector/shared";

/**
 * 把用户配置的条目编译成一张匹配器表：精确串走 Set 直查，含 `*` 的 glob 走 RegExp。
 *
 * 支持 `*` 通配符（任意长度、不含 `*` 的段）：
 *   `'a-modal'`（精确）、`'*-modal'`、`'a-*'`、`'a-*dal'`
 * 均可模糊匹配。`*` 之外的字符按字面匹配；同一里表内精确串与 glob 共存无妨。
 */
class ComponentMatcher {
  private readonly exacts: Set<string>;
  private readonly globs: RegExp[];

  constructor(patterns: string[]) {
    this.exacts = new Set();
    this.globs = [];
    for (const p of patterns) {
      if (p.includes("*")) {
        // 转义除 `*` 外的正则元字符；`*` -> `.*`，锚定整段
        this.globs.push(
          new RegExp(
            "^" +
              p.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") +
              "$",
          ),
        );
      } else {
        this.exacts.add(p);
      }
    }
  }

  /** 判定 `tag` 是否命中精确串或任一 glob。 */
  test(tag: string): boolean {
    if (this.exacts.has(tag)) return true;
    for (const re of this.globs) if (re.test(tag)) return true;
    return false;
  }
}

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
function findOpenTagEnd(
  source: string,
  isSelfClosing: boolean = false,
): number {
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

/**
 * 把 `token` 注入元素开始标签的 `class` 属性（用于动态挂载组件的位置编码通道）：
 *
 * - 已有静态 `class` 且带引号：在闭引号前追加 ` token`，保留原始空白与其它 token；
 * - 已有静态 `class` 但无引号（罕见）：整体改写为 `"原值 token"`，避免追加的空格被
 *   当成属性分隔符截断；
 * - 无静态 `class`：在开标签 `>`/`/>` 前注入 `class="token"`。
 *
 * 只匹配静态 `class`（`AttributeNode`），不碰 `:class`（`DirectiveNode`）--
 * 后者由 Vue 运行时与静态 class 合并，token 仍会落到最终元素上。
 *
 * @param s            MagicString 实例（作用在整个 SFC 源码上）
 * @param templateStart template 内容在 SFC 全文中的起始偏移（AST loc 均相对 template.content）
 * @param el           当前元素节点
 * @param token        要注入的 class token（已含前缀，class 名安全）
 */
function injectClassToken(
  s: MagicString,
  templateStart: number,
  el: ElementNode,
  token: string,
): void {
  const classProp = el.props.find(
    (p): p is AttributeNode =>
      p.type === NodeTypes.ATTRIBUTE && p.name === "class" && p.value != null,
  );
  if (classProp) {
    const v = classProp.value!;
    // 编译器对引号属性：value.loc.source 含首尾引号，闭引号在 end.offset - 1。
    // 详见 compiler-core parseAttribute 的 onattribend：双/单引号走 else 分支
    // 用 `getLoc(start - 1, end + 1)` 包含引号；无引号才用纯内容区间。
    if (v.loc.source.startsWith('"') || v.loc.source.startsWith("'")) {
      s.appendLeft(templateStart + v.loc.end.offset - 1, " " + token);
    } else {
      // 无引号值无法承载含空格的多 token，整体改写成带引号形式
      s.overwrite(
        templateStart + v.loc.start.offset,
        templateStart + v.loc.end.offset,
        `"${v.content} ${token}"`,
      );
    }
    return;
  }
  // 无 class 属性：在开标签结束符前注入 class="token"
  const insertPos =
    templateStart +
    el.loc.start.offset +
    findOpenTagEnd(el.loc.source, el.isSelfClosing);
  s.appendLeft(insertPos, ` class="${token}"`);
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
 * @param wrapComponents    需要用 span 包裹的组件名列表，支持 `*` 通配（见 ComponentMatcher）
 * @param portalComponents  经 Teleport/Portal 动态挂到 body 的组件名列表（如 a-modal），
 *                          这类组件的 `data-source-file` 会在挂载过程中丢失，改把位置
 *                          信息编码进 `class`（class 能透传到挂载后的根元素），由 overlay
 *                          运行时解码回填。与 wrapComponents 互斥（portal 优先）。
 * @param templateLine      template 内容在 SFC 文件中的**起始行号**（1-based）。
 *                          AST 给出的 `el.loc.start.line` 是相对 template.content
 *                          的 1-based 行号；当 `<script>` 在 `<template>` 上方时，
 *                          必须加上 SFC 全文里的偏移，否则点击跳转会落到
 *                          template 块内偏前的位置（典型差 N 行，N = script 行数）。
 *                          template 内容通常从行首开始（`<template>\n` 之后），
 *                          所以列号不需要调整。
 * @param diskLineMap       内存 template.content → 磁盘 template.content 的逐行映射
 *                          （0-based，注入行=-1）。前置插件(如 @uni-ku/root 包
 *                          <global-ku-root>)在模板内部注入行后，compileTemplate
 *                          给的 el.loc.start.line 是"内存行"而非"磁盘行"；editor 读
 *                          磁盘文件，必须换算成磁盘行。null 表示无映射（读盘失败或未
 *                          注入），退化为直接用内存行（core/PC 场景恒传 null）。
 */
export function createInspectorTransform(
  s: MagicString,
  template: { content: string; loc: { start: { offset: number } } },
  sourceRef: { rootIndex: number; relativePath: string },
  attrName: string,
  wrapComponents: string[],
  portalComponents: string[],
  templateLine: number,
  diskLineMap: number[] | null,
): NodeTransform {
  const wrapMatcher = wrapComponents.length
    ? new ComponentMatcher(wrapComponents)
    : null;
  const portalMatcher = portalComponents.length
    ? new ComponentMatcher(portalComponents)
    : null;

  return (node) => {
    if (node.type !== NodeTypes.ELEMENT) return;
    const el = node as ElementNode;
    if (SKIP_TAGS.has(el.tag)) return;
    if (
      el.tagType !== ElementTypes.ELEMENT &&
      el.tagType !== ElementTypes.COMPONENT
    )
      return;

    // AST 行号是相对 template.content(内存) 的 1-based；先减成 0-based 内存行，
    // 再经 diskLineMap 换算成 0-based 磁盘行，最后 +templateLine 得磁盘全文行号。
    // 注入行(=映射 -1，理论上不会是真实元素行)退化为内存行。
    const { line, column } = el.loc.start;
    const memLine0 = line - 1;
    const mapped = diskLineMap ? diskLineMap[memLine0] : memLine0;
    // mapped < 0：该元素落在前置插件注入的行上（如 <global-ku-root> 包裹层），
    // 磁盘文件里不存在 → 不注入 data-source-file，否则点击会 404。
    if (mapped < 0) return;
    const fileLine = templateLine + mapped;
    const start = template.loc.start.offset + el.loc.start.offset;
    const ref = formatSourceRef(
      sourceRef.rootIndex,
      sourceRef.relativePath,
      fileLine,
      column,
    );

    // 列在 portalComponents 中的组件：经 Teleport/Portal 动态挂到 body，
    // data-source-file 会在挂载过程中丢失。改把位置信息编码进 class（class 能
    // 透传到挂载后的根元素，如 .ant-modal），由 overlay 运行时解码后回填
    // data-source-file + data-inspector-tag。与 wrapComponents 互斥，优先匹配。
    if (
      el.tagType === ElementTypes.COMPONENT &&
      portalMatcher &&
      portalMatcher.test(el.tag)
    ) {
      injectClassToken(
        s,
        template.loc.start.offset,
        el,
        encodeSourceClass(el.tag, ref),
      );
      return;
    }

    // 列在 wrapComponents 中的组件：用 span 包裹，标记挂 span
    if (
      el.tagType === ElementTypes.COMPONENT &&
      wrapMatcher &&
      wrapMatcher.test(el.tag)
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
    s.appendLeft(insertPos, ` ${attrName}="${ref}"${tagAttr}`);
  };
}
