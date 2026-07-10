import { createRequire } from "node:module";

// ⚠ 必须在 ESM import 之前预热 CJS 缓存
// @dcloudio/vite-plugin-uni 加载时会将 @vue/shared@3.4.21（无 genCacheKey）装入 CJS 缓存。
// 这里通过 createRequire 先把 @vue/shared@3.5.38 装入缓存，确保后续 compiler-sfc
// 内部的 require('@vue/shared') 能拿到正确的 genCacheKey。
const _require = createRequire(import.meta.url);
_require("@vue/shared");
const { parse: parseSFC } = _require("@vue/compiler-sfc");

import { baseParse, NodeTypes } from "@vue/compiler-core";
import MagicString from "magic-string";
import type {
  ElementNode,
  RootNode,
  TemplateChildNode,
  AttributeNode,
  DirectiveNode,
  SimpleExpressionNode,
} from "@vue/compiler-core";
import type { ChildTextData } from "@vue-dev-inspector/shared";
import { planImports, joinImportStatements } from "./imports";

/**
 * 一条属性（保持源码书写形式）
 * - 普通属性: { key: 'class', value: 'card' }
 * - 绑定指令: { key: ':src',  value: 'user.avatar' }
 * - 事件指令: { key: '@click', value: 'onClick' }
 * - 结构指令: { key: 'v-if',  value: 'show' }
 */
export interface PropEntry {
  key: string;
  value: string;
}

export interface ElementProps {
  tag: string;
  selfClosing: boolean;
  props: PropEntry[];
}

const isSimpleExp = (n: unknown): n is SimpleExpressionNode =>
  !!n && typeof n === "object" && (n as { type?: number }).type === 4;

/** 解析 SFC，返回模板 AST、模板内容、模板在 SFC 中的字符偏移 */
function parseTemplate(sfcSource: string, filePath: string) {
  const { descriptor, errors } = parseSFC(sfcSource, { filename: filePath });
  if (errors.length || !descriptor.template) return null;
  const tpl = descriptor.template;
  return {
    ast: baseParse(tpl.content, { comments: false }),
    offset: tpl.loc.start.offset,
    /**
     * template 内容在 SFC 全文中的起始行号（1-based）。
     *
     * AST 给出的 `el.loc.start.line` 是相对 template.content 的 1-based
     * 行号，而外部传入的 `line` 来自注入属性，是 SFC 全文行号。
     * 两者差正好是 `<script>...</script>` 等头部块的行数。
     * 把这个偏移同时存进 `parseTemplate` 的返回值，让所有 `findElementAtLoc`
     * 调用方都能简单地从"传入 line"还原回"AST line"做匹配。
     */
    templateLine: offsetToLine(sfcSource, tpl.loc.start.offset),
  };
}

/** 把字节偏移转成 1-based 行号（统计 `offset` 之前的换行符 + 1）。 */
function offsetToLine(code: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset && i < code.length; i++) {
    if (code[i] === "\n") line++;
  }
  return line;
}

/** 取一个节点的可递归子节点（覆盖 ROOT/ELEMENT/IF/FOR） */
function childrenOf(node: RootNode | TemplateChildNode): TemplateChildNode[] {
  switch (node.type) {
    case NodeTypes.ROOT:
      return (node as RootNode).children;
    case NodeTypes.ELEMENT:
      return (node as ElementNode).children;
    case NodeTypes.IF:
      return (
        node as unknown as { branches: { children: TemplateChildNode[] }[] }
      ).branches.flatMap((b) => b.children);
    case NodeTypes.FOR:
      return (node as unknown as { children: TemplateChildNode[] }).children;
    default:
      return [];
  }
}

/** 在模板 AST 中查找位于 (line, col) 的元素节点（line/col 是 SFC 全文 1-based/0-based）。 */
function findElementAtLoc(
  ast: RootNode,
  line: number,
  col: number,
  templateLine: number,
): ElementNode | null {
  const stack: (RootNode | TemplateChildNode)[] = [ast];
  // 把外部传入的全文行号还原成 AST 内部相对 template.content 的行号。
  // 当 <script> 在 <template> 上方时，templateLine > 1，必须减回去再匹配。
  const astLine = line - (templateLine - 1);
  while (stack.length) {
    const node = stack.pop()!;
    if (node.type === NodeTypes.ELEMENT) {
      const el = node as ElementNode;
      if (el.loc.start.line === astLine && el.loc.start.column === col)
        return el;
    }
    stack.push(...childrenOf(node));
  }
  return null;
}

/** 从 AST 元素节点提取属性列表，还原源码书写形式 */
function extractProps(el: ElementNode): PropEntry[] {
  return el.props
    .map((p) => {
      if (p.type === 6 /* ATTRIBUTE */) {
        const a = p as AttributeNode;
        return { key: a.name, value: a.value?.content ?? "" };
      }
      if (p.type === 7 /* DIRECTIVE */) {
        const d = p as DirectiveNode;
        return { key: d.rawName ?? `v-${d.name}`, value: directiveValue(d) };
      }
      return null;
    })
    .filter((p): p is PropEntry => p !== null);
}

/** 指令表达式取值：SimpleExpressionNode 取 content，否则空串。 */
function directiveValue(d: DirectiveNode): string {
  return isSimpleExp(d.exp) ? d.exp.content : "";
}

/**
 * 从 `from` 开始扫描开始标签，跳过引号字符串，定位 `>` 或 `/>` 的位置。
 * 避免属性值中包含 `>` 时误判。
 */
function findOpenTagEnd(source: string, from: number): number {
  for (let i = from; i < source.length; i++) {
    const ch = source[i];
    if (ch === '"' || ch === "'") {
      const close = source.indexOf(ch, i + 1);
      if (close === -1) return -1;
      i = close;
    } else if (ch === "/" && source[i + 1] === ">") {
      return i;
    } else if (ch === ">") {
      return i;
    }
  }
  return -1;
}

/** 取一行行首的缩进（空白/制表符）；offset 必须落在该行内部。 */
function lineIndent(source: string, offset: number): string {
  const lineStart = source.lastIndexOf("\n", offset) + 1;
  const match = source.slice(lineStart, offset).match(/^[ \t]*/u);
  return match ? match[0] : "";
}

/**
 * 判断 `offset` 是否是其所在行的行首 token（offset 之前到上一个换行符之间
 * 只有空白/制表符）。
 *
 * 用于 delete/move 决定删除范围是否要回溯到行首：行首 token 才连同缩进一起删；
 * 否则只删元素自身范围，避免吞掉同行前置内容（父开标签、兄弟元素等）。
 * 复现：`<a-space><span>项</span></a-space></a-card>` 删 `<span>` 时若回溯行首
 * 会把父开标签 `<a-space>` 一并删掉，留下孤悬的 `</a-space></a-card>`。
 */
function isLeadingOnLine(source: string, offset: number): boolean {
  const lineStart = source.lastIndexOf("\n", offset) + 1;
  return source.slice(lineStart, offset).trim() === "";
}

/** 解析源码中元素开标签的 tagNameEnd / openTagEnd（不可定位时返 null）。 */
function resolveTagRange(
  source: string,
  tplOffset: number,
  el: ElementNode,
): { tagNameEnd: number; openTagEnd: number } | null {
  const tagNameEnd = tplOffset + el.loc.start.offset + 1 + el.tag.length;
  const openTagEnd = findOpenTagEnd(source, tagNameEnd);
  return openTagEnd === -1 ? null : { tagNameEnd, openTagEnd };
}

/** 读取位于 (line, col) 的元素的当前属性（基于 AST 读取磁盘源码） */
export function getElementProps(
  sfcSource: string,
  filePath: string,
  line: number,
  col: number,
): ElementProps | null {
  const t = parseTemplate(sfcSource, filePath);
  if (!t) return null;
  const el = findElementAtLoc(t.ast, line, col, t.templateLine);
  return el
    ? { tag: el.tag, selfClosing: !!el.isSelfClosing, props: extractProps(el) }
    : null;
}

/** 用 AST 定位目标元素，原子替换其属性段 [tagNameEnd, openTagEnd) */
export function editElementProps(
  sfcSource: string,
  filePath: string,
  line: number,
  col: number,
  newProps: PropEntry[],
): string {
  const t = parseTemplate(sfcSource, filePath);
  if (!t) return sfcSource;
  const el = findElementAtLoc(t.ast, line, col, t.templateLine);
  if (!el) return sfcSource;

  const range = resolveTagRange(sfcSource, t.offset, el);
  if (!range) return sfcSource;
  const { tagNameEnd, openTagEnd } = range;

  const attrs = newProps
    .map((p) => ({ k: p.key.trim(), v: p.value }))
    .filter((x) => x.k !== "")
    .map((x) => (x.v === "" ? ` ${x.k}` : ` ${x.k}="${x.v}"`))
    .join("");

  const s = new MagicString(sfcSource);
  /* 1. 当 openTagEnd 紧贴 tagNameEnd（自闭合标签无任何现有属性），
        MagicString 不允许 overwrite 空区间，改用 prependRight。
     2. 当 attrs 为空（用户清空所有属性）但区间非空时，原地 remove。 */
  if (attrs) {
    if (openTagEnd === tagNameEnd) {
      s.prependRight(tagNameEnd, attrs);
    } else {
      s.overwrite(tagNameEnd, openTagEnd, attrs);
    }
  } else if (openTagEnd !== tagNameEnd) {
    s.remove(tagNameEnd, openTagEnd);
  }
  return s.toString();
}

/**
 * 用 AST 定位目标元素，删除其完整源码区间。
 *
 * 删除范围分两种情况：
 *   - 元素是所在行的行首 token（行首仅缩进、同行无其它内容）：
 *     删 [lineStart, end+1)，连行首缩进与尾部换行一并删掉，让下一行顶上来。
 *     行首缩进必须删，否则下一行会"继承"被删元素的缩进并在原行留下打碎的空白段，
 *     进一步让相邻兄弟元素的 src AST 重新解析时列号偏移、data-source-file 失效
 *     → HMR 边界异常（复现：先 duplicate 再 delete 原元素）。
 *   - 元素与前置内容共行（父开标签 / 兄弟元素 / 文本贴在左边）：
 *     只删 [start, end)，保留缩进与同行前置内容。回溯到 lineStart 会吞掉父开标签
 *     之类的内容，产出孤悬闭标签（复现：`<a-space><span>x</span></a-space></a-card>`
 *     删 span 会留下 `</a-space></a-card>` 触发编译错误）。
 */
export function deleteElement(
  sfcSource: string,
  filePath: string,
  line: number,
  col: number,
): string {
  const t = parseTemplate(sfcSource, filePath);
  if (!t) return sfcSource;
  const el = findElementAtLoc(t.ast, line, col, t.templateLine);
  if (!el) return sfcSource;

  const start = t.offset + el.loc.start.offset;
  const end = start + el.loc.source.length;
  const s = new MagicString(sfcSource);
  if (isLeadingOnLine(sfcSource, start)) {
    const lineStart = sfcSource.lastIndexOf("\n", start) + 1;
    const trimEnd = sfcSource[end] === "\n" ? end + 1 : end;
    s.remove(lineStart, trimEnd);
  } else {
    s.remove(start, end);
  }
  return s.toString();
}

/**
 * 组件 Schema：定义可插入的组件目录。
 *
 * 每个条目描述一个可插入模板的组件：
 * - tag:      模板标签名（如 "a-button"）
 * - label:    面板显示名（如 "Button 按钮"）
 * - group:    分组（如 "antdv"、"form"、"layout"）
 * - selfClosing: 是否为自闭合标签（默认 false，<a-button /> 自闭合 / <a-select>...</a-select> 配对）
 * - snippet:  自定义插入片段（如 '<a-button type="primary">按钮</a-button>'），
 *             不设则按 tag + selfClosing 自动生成
 * - props:    预填默认属性列表（不设 snippet 时使用）
 */
export interface ComponentSchema {
  tag: string;
  label: string;
  group: string;
  selfClosing?: boolean;
  snippet?: string;
  props?: PropEntry[];
}

/** 内置组件目录（antdv 基础组件，后续可扩展） */
export const COMPONENT_CATALOG: ComponentSchema[] = [
  // ── 通用 ──
  {
    tag: "a-button",
    label: "Button 按钮",
    group: "antdv/通用",
    snippet: '<a-button type="primary">按钮</a-button>',
  },
  {
    tag: "a-tag",
    label: "Tag 标签",
    group: "antdv/通用",
    snippet: '<a-tag color="blue">标签</a-tag>',
  },
  {
    tag: "a-badge",
    label: "Badge 徽标",
    group: "antdv/通用",
    selfClosing: false,
    snippet: "<a-badge count={5}><a-button>消息</a-button></a-badge>",
  },
  // ── 布局 ──
  {
    tag: "a-divider",
    label: "Divider 分割线",
    group: "antdv/布局",
    selfClosing: true,
    snippet: "<a-divider />",
  },
  {
    tag: "a-space",
    label: "Space 间距",
    group: "antdv/布局",
    snippet: "<a-space><span>项</span></a-space>",
  },
  // ── 表单 ──
  {
    tag: "a-input",
    label: "Input 输入框",
    group: "antdv/表单",
    selfClosing: true,
    snippet: '<a-input placeholder="请输入" />',
  },
  {
    tag: "a-input-password",
    label: "InputPassword 密码框",
    group: "antdv/表单",
    selfClosing: true,
    snippet: '<a-input-password placeholder="请输入密码" />',
  },
  {
    tag: "a-select",
    label: "Select 选择器",
    group: "antdv/表单",
    selfClosing: true,
    snippet: '<a-select placeholder="请选择" style="width:100%" />',
  },
  {
    tag: "a-date-picker",
    label: "DatePicker 日期",
    group: "antdv/表单",
    selfClosing: true,
    snippet: '<a-date-picker style="width:100%" />',
  },
  {
    tag: "a-switch",
    label: "Switch 开关",
    group: "antdv/表单",
    selfClosing: true,
    snippet: "<a-switch />",
  },
  {
    tag: "a-checkbox",
    label: "Checkbox 复选",
    group: "antdv/表单",
    snippet: "<a-checkbox>复选框</a-checkbox>",
  },
  {
    tag: "a-radio",
    label: "Radio 单选",
    group: "antdv/表单",
    snippet: '<a-radio value="a">选项</a-radio>',
  },
  // ── 反馈 ──
  {
    tag: "a-alert",
    label: "Alert 提示",
    group: "antdv/反馈",
    snippet: '<a-alert message="提示信息" type="info" show-icon />',
  },
  // ── 数据展示 ──
  {
    tag: "a-card",
    label: "Card 卡片",
    group: "antdv/数据展示",
    snippet: '<a-card title="标题"><p>内容</p></a-card>',
  },
];

/**
 * 生成组件的模板片段。
 * 优先用 schema.snippet；否则按 tag + selfClosing 生成。
 */
function componentSnippet(schema: ComponentSchema): string {
  if (schema.snippet) return schema.snippet;
  const indent = ""; // 调用方负责缩进
  return schema.selfClosing
    ? `${indent}<${schema.tag} />`
    : `${indent}<${schema.tag}></${schema.tag}>`;
}

/**
 * 在 (line, col) 指定的元素位置插入一个组件。
 *
 * direction 决定插入语义：
 *   'inside' (默认): 作为最后一个子元素插入到目标元素内部
 *   'before':        插入到目标元素同级、紧随其前
 *   'after':         插入到目标元素同级、紧随其后
 *
 * 找到目标元素的开始标签结束位置 (> 或 />)：
 *   inside + 配对标签: 在 > 后插入 snippet + 换行（新组件作为最后一个子元素）
 *   inside + 自闭合:   把 "/>" 改写为 ">"（开标签不再闭合），再在后面补
 *                     snippet + 目标元素的闭合标签，使 snippet 落在目标元素内部。
 *   before / after:    不论自闭合与否，在元素完整源码区间之前/之后插入 snippet，
 *                     继承目标元素的行缩进。
 *
 * 例：选中 `<a-alert />`，inside 插入 `<a-button />`：
 *   `<a-alert />` → `<a-alert>\n    <a-button />\n  </a-alert>`
 */
export function insertComponent(
  sfcSource: string,
  filePath: string,
  line: number,
  col: number,
  componentTag: string,
  direction: "inside" | "before" | "after" = "inside",
  /**
   * 调用方（组件面板）显式指定的 snippet，原样写入 .vue。
   * 非空时优先于 COMPONENT_CATALOG 查找；未传/空串则回退到 catalog
   * 或 `<tag />`，保持对 antdv 等老调用方的向后兼容。
   */
  snippetOverride?: string,
): string | null {
  const t = parseTemplate(sfcSource, filePath);
  if (!t) return null;
  const el = findElementAtLoc(t.ast, line, col, t.templateLine);
  if (!el) return null;

  // 查组件 schema；没有则按 tag 生成默认片段
  const schema = COMPONENT_CATALOG.find((c) => c.tag === componentTag);
  const snippet =
    snippetOverride ||
    (schema ? componentSnippet(schema) : `<${componentTag} />`);

  const s = new MagicString(sfcSource);

  // 同级插入：在元素完整源码区间前/后插入，继承缩进
  if (direction === "before" || direction === "after") {
    const start = t.offset + el.loc.start.offset;
    const end = start + el.loc.source.length;
    const indent = lineIndent(sfcSource, start);
    const insertion = indent + snippet;
    if (direction === "before") {
      // 插到行首缩进之前，使新组件独占一行并保留原行缩进
      s.appendLeft(sfcSource.lastIndexOf("\n", start) + 1, insertion + "\n");
    } else {
      s.appendRight(end, "\n" + insertion);
    }
    return s.toString();
  }

  // 内部插入
  const range = resolveTagRange(sfcSource, t.offset, el);
  if (!range) return null;
  const { openTagEnd } = range;

  if (el.isSelfClosing) {
    // 自闭合目标：`.../>` → `...>`（开标签转为未闭合），其后补 snippet + 目标注入闭合标签
    s.overwrite(openTagEnd, openTagEnd + 2, ">");
    s.appendLeft(openTagEnd + 2, `\n    ${snippet}\n  </${el.tag}>`);
  } else {
    // 配对标签：在 > 后插入 snippet
    s.appendLeft(openTagEnd + 1, `\n    ${snippet}`);
  }

  return s.toString();
}

/**
 * 确保一组 import 语句存在于 SFC 的 `<script>`(setup) 中（幂等合并同模块绑定）。
 *
 * 纯解析与合并规划抽到 ./imports（零第三方依赖，只产 ImportEdit 列表）；
 * 本函数负责 SFC 读写：用 parseSFC 取 <script> 块、用 MagicString 应用编辑、
 * 无 <script> 时用 createSfcBlock 新建。接口见 planImports，实现细节不外泄。
 *
 * 返回改写后的 SFC 源码；无 imports、解析失败或全部已满足时原样返回。
 */
export function ensureImports(
  sfcSource: string,
  filePath: string,
  importStmts: string[],
): string {
  if (!importStmts || importStmts.length === 0) return sfcSource;
  const body = joinImportStatements(importStmts);
  if (!body) return sfcSource;

  const { descriptor, errors } = parseSFC(sfcSource, { filename: filePath });
  const scriptBlock = descriptor.scriptSetup ?? descriptor.script;
  if (errors.length && !scriptBlock) return sfcSource;

  // 无 <script>：parseSFC 不注册空块；优先写入已存在的空 <script> 标签，否则新建
  if (!scriptBlock) {
    const tagStart = sfcSource.indexOf("<script");
    if (tagStart !== -1) {
      const gt = sfcSource.indexOf(">", tagStart);
      if (gt !== -1) {
        const s = new MagicString(sfcSource);
        s.appendLeft(gt + 1, "\n" + body + "\n");
        return s.toString();
      }
    }
    return createSfcBlock(sfcSource, "script", body);
  }

  const edits = planImports(scriptBlock.content, importStmts);
  if (edits.length === 0) return sfcSource;
  const innerStart = scriptBlock.loc.start.offset;
  const s = new MagicString(sfcSource);
  for (const edit of edits) {
    if (edit.remove)
      s.remove(innerStart + edit.remove[0], innerStart + edit.remove[1]);
    s.appendLeft(innerStart + edit.at, edit.insert);
  }
  return s.toString();
}

/**
 * 复制 (line, col) 指定的元素并在其同级（紧随其后）插入一份副本。
 *
 * 自闭合与配对标签都适用：取元素完整源码（el.loc.source），
 * 按其原行缩进补一份，插入到元素结束之后。
 * 例：`<a-card title="...">...</a-card>` → 同一份再接一份。
 */
export function duplicateElement(
  sfcSource: string,
  filePath: string,
  line: number,
  col: number,
): string | null {
  const t = parseTemplate(sfcSource, filePath);
  if (!t) return null;
  const el = findElementAtLoc(t.ast, line, col, t.templateLine);
  if (!el) return null;

  const start = t.offset + el.loc.start.offset;
  const end = start + el.loc.source.length;
  const indent = lineIndent(sfcSource, start);

  const s = new MagicString(sfcSource);
  s.appendRight(end, "\n" + indent + el.loc.source);
  return s.toString();
}

/** 方向：被移动元素相对于目标元素的位置 */
export type MoveDirection = "before" | "inside" | "after";

/**
 * 判断 `target` 是否是 `source` 的后代（含自身）。
 * 用于防止把元素拖到自己的后代中导致源被截断后丢失。
 *
 * 用 AST 节点引用做相等性比较（loc.start.offset 唯一）。
 */
function isDescendantOrSelf(source: ElementNode, target: ElementNode): boolean {
  if (source === target) return true;
  const stack: (RootNode | TemplateChildNode)[] = [source];
  while (stack.length) {
    const node = stack.pop()!;
    if (node === target) return true;
    stack.push(...childrenOf(node));
  }
  return false;
}

/** 移动 (srcLine, srcCol) 元素到 (targetLine, targetCol) 处。
 *
 * direction 决定与目标元素的相对位置（语义同 insertComponent）：
 *   'before' / 'after' — 同级插入（按目标行缩进重写源码每行前缀）
 *   'inside'           — 作为目标元素的最后一个子元素插入（再深一级缩进）
 *
 * 实现：在同一份 sfcSource 上先用 MagicString 删源元素完整区间，
 * 再在目标位置 appendLeft/appendRight 插入重缩进后的源元素源码。
 * 同文件、源 ≠ 目标、目标不是源的后代 — 任一校验失败返回 null。
 */
export function moveElement(
  sfcSource: string,
  _filePath: string,
  srcLine: number,
  srcCol: number,
  targetLine: number,
  targetCol: number,
  direction: MoveDirection,
): string | null {
  const t = parseTemplate(sfcSource, _filePath);
  if (!t) return null;
  const source = findElementAtLoc(t.ast, srcLine, srcCol, t.templateLine);
  if (!source) return null;
  const target = findElementAtLoc(t.ast, targetLine, targetCol, t.templateLine);
  if (!target) return null;
  if (isDescendantOrSelf(source, target)) return null;

  // 源元素完整区间（含尾部换行，与 deleteElement 一致）
  const sourceStart = t.offset + source.loc.start.offset;
  const sourceEnd = sourceStart + source.loc.source.length;
  const sourceIndent = lineIndent(sfcSource, sourceStart);

  const targetStart = t.offset + target.loc.start.offset;
  const targetEnd = targetStart + target.loc.source.length;
  const targetIndent = lineIndent(sfcSource, targetStart);

  /** 把 source 源码的每行去掉 source 缩进后加上 newIndent */
  function reindent(sourceCode: string, newIndent: string): string {
    return sourceCode
      .split("\n")
      .map(function (line) {
        const stripped = line.startsWith(sourceIndent)
          ? line.slice(sourceIndent.length)
          : line;
        return newIndent + stripped;
      })
      .join("\n");
  }

  const s = new MagicString(sfcSource);

  // 1. 删源：源是行首 token 时连缩进与尾部换行一并删（让下一行顶上来，
  //    否则下行的缩进会和残留合并造成双重缩进）；与前言共行时只删自身范围，
  //    避免吞同行前置内容（语义同 deleteElement）。
  if (isLeadingOnLine(sfcSource, sourceStart)) {
    s.remove(
      sfcSource.lastIndexOf("\n", sourceStart) + 1,
      sfcSource[sourceEnd] === "\n" ? sourceEnd + 1 : sourceEnd,
    );
  } else {
    s.remove(sourceStart, sourceEnd);
  }

  // 2. 在目标位置插入（用原始偏移，appendLeft/appendRight 不被前面的 remove 影响）
  if (direction === "before" || direction === "after") {
    const rewritten = reindent(source.loc.source, targetIndent);
    if (direction === "before") {
      s.appendLeft(
        sfcSource.lastIndexOf("\n", targetStart) + 1,
        rewritten + "\n",
      );
    } else {
      s.appendRight(targetEnd, "\n" + rewritten);
    }
    return s.toString();
  }

  // inside: 子元素比目标缩进多 2 空格（与 insertComponent 自闭合路径约定一致）
  const insideIndent = targetIndent + "  ";
  const rewritten = reindent(source.loc.source, insideIndent);
  const range = resolveTagRange(sfcSource, t.offset, target);
  if (!range) return null;
  const { openTagEnd } = range;
  if (target.isSelfClosing) {
    s.overwrite(openTagEnd, openTagEnd + 2, ">");
    s.appendLeft(
      openTagEnd + 2,
      "\n" + rewritten + "\n" + targetIndent + "</" + target.tag + ">",
    );
  } else {
    s.appendLeft(openTagEnd + 1, "\n" + rewritten);
  }

  return s.toString();
}

// ─── SFC 顶层块（<script> / <style>）读写 ──────────────────────
// 用于「编辑代码」抽屉：服务端提供 /get-block 与 /update-block。

/** v1 支持的块类型。多 <style scoped> 与 <script> + <script setup> 共存留作 v2。 */
export type SfcBlockKind = "script" | "style";

/**
 * 单个块的定位信息。
 *
 * - `content` 是标签内的源码（不含 `<script>` / `</script>`）。
 * - `start` / `end` 是 SFC 全文字节偏移，**完整覆盖 `<script>...</script>`**
 *   （含开闭标签）；服务端 update 用这两个值做 MagicString overwrite。
 */
export interface SfcBlock {
  kind: SfcBlockKind;
  content: string;
  start: number;
  end: number;
}

/**
 * 把 `attrs` 对象渲染成 `<script lang="ts" setup>` 这段开标签串。
 * attrs 内布尔 true 表示无值属性（如 `setup`）；
 * 字符串值属性需渲染成 `key="value"`。
 *
 * 输出顺序与 attrs 对象的 key 枚举顺序一致；keys 在大多数现代 JS 引擎
 * 中保持字面量定义顺序，与 SFC 原始书写顺序近似（v1 不要求严格一致）。
 */
function renderOpenTag(attrs: Record<string, string | true>): string {
  const parts = Object.keys(attrs).map((k) => {
    const v = attrs[k];
    return v === true ? ` ${k}` : ` ${k}="${v}"`;
  });
  return parts.join("");
}

/**
 * 在 `innerStart`（块内首字符 offset）之前向左扫描，定位 `<script` /
 * `<style` 开标签的 `<` 位置，并把 `innerStart` 前最近一个 `>` 作为开标签结束。
 *
 * 跳过 `<script setup lang="ts">` 这种含字符串值的属性：用 `>` 跳过整段
 * 开标签内容。HTML 中的引号转义在 .vue 文件里极少出现，v1 简单按字面
 * 处理；最坏情况是 `>` 出现在属性值里时被误判为开标签结尾——遇到时
 * `<script setup lang=">` 这种非法 SFC 本来就会被 parseSFC 拒绝，所以
 * 这里没必要再做防御性跳过。
 */
function resolveOuterTagStart(
  source: string,
  tag: "script" | "style",
  innerStart: number,
): number {
  const needle = `<${tag}`;
  // 从 innerStart 之前往左找 <script / <style，必须出现在行首或空白之后
  for (let i = innerStart; i >= 0; i--) {
    if (source.startsWith(needle, i)) return i;
  }
  return -1;
}

/**
 * 在 `innerEnd`（块内末字符 offset 之后）向右扫描，定位 `</script>` / `</style>`
 * 的 `>` 位置（exclusive end）。`<` 必定与 innerEnd 之间只有空白与注释，
 * 取首个 `<` 即可。
 */
function resolveOuterTagEnd(
  source: string,
  tag: "script" | "style",
  innerEnd: number,
): number {
  const needle = `</${tag}>`;
  const idx = source.indexOf(needle, innerEnd);
  return idx === -1 ? -1 : idx + needle.length;
}

/**
 * 读出 SFC 中所有可编辑块。
 *
 * - descriptor 缺失或解析报错 → 返回空对象（任一块都视作缺失）。
 * - 单 <script> 和 <script setup>：v1 优先取 `scriptSetup`，缺则取 `script`。
 *   多块共存场景在 v1 直接以 `scriptSetup` 覆盖 `script`，让 UI 编辑到
 *   当前生效的那段；风险与后续改进空间已在 plan 的「已知限制」中标明。
 * - <style>：v1 只取 `descriptor.styles[0]`；多块（scoped / module）暂不支持。
 */
export function getSfcBlocks(
  sfcSource: string,
  filePath: string,
): { script?: SfcBlock; style?: SfcBlock } {
  const { descriptor, errors } = parseSFC(sfcSource, { filename: filePath });
  // parseSFC 在缺 <template> 且缺 <script> 时会塞一条错误，但已有的
  // <style> 仍然可正确解析（描述符照样填充）。v1 宽容处理：只在所有
  // 块都拿不到（顶层语法都坏了）时才返回空。
  const hasAnyBlock =
    descriptor.scriptSetup || descriptor.script || descriptor.styles.length > 0;
  if (errors.length && !hasAnyBlock) return {};
  const blocks: { script?: SfcBlock; style?: SfcBlock } = {};

  // script / scriptSetup 互斥：先看 scriptSetup（runtime + compile-time 优先级）
  const scriptSrc = descriptor.scriptSetup ?? descriptor.script;
  if (scriptSrc && scriptSrc.content.length > 0) {
    const outerStart = resolveOuterTagStart(
      sfcSource,
      "script",
      scriptSrc.loc.start.offset,
    );
    const outerEnd = resolveOuterTagEnd(
      sfcSource,
      "script",
      scriptSrc.loc.end.offset,
    );
    if (outerStart !== -1 && outerEnd !== -1 && outerEnd > outerStart) {
      blocks.script = {
        kind: "script",
        content: scriptSrc.content,
        start: outerStart,
        end: outerEnd,
      };
    }
  }

  if (descriptor.styles.length > 0) {
    const st = descriptor.styles[0];
    const outerStart = resolveOuterTagStart(
      sfcSource,
      "style",
      st.loc.start.offset,
    );
    const outerEnd = resolveOuterTagEnd(sfcSource, "style", st.loc.end.offset);
    if (outerStart !== -1 && outerEnd !== -1 && outerEnd > outerStart) {
      blocks.style = {
        kind: "style",
        content: st.content,
        start: outerStart,
        end: outerEnd,
      };
    }
  }

  return blocks;
}

/**
 * 把 SFC 中指定块整段替换为 `newContent`（不含 <script> / </script> 标签）。
 *
 * - 块存在时：用 descriptor 读出的 attrs 重组 `<script lang="ts" setup>` 开标签与
 *   `<style scoped>` 开标签，保证 lang / setup / scoped 等元属性不丢。
 * - 块**缺失**时（v2 新增）：不再返回原源码触发 404，而是**新建并追加到 SFC 末尾**——
 *   script → `<script setup lang="ts">`，style → `<style${scoped ? " scoped" : ""}>`。
 *   `createOpts.scoped` 仅对 style 新建生效；script 固定 `setup lang="ts"`（Vue3+TS 约定）。
 *   追加前自动补换行，避免与既有末尾粘连。
 * - 用 getSfcBlocks 先算出 outer range，再 MagicString overwrite；
 *   保证完整覆盖 `<script>...</script>`，包括开闭标签。
 */
export function updateSfcBlock(
  sfcSource: string,
  filePath: string,
  kind: SfcBlockKind,
  newContent: string,
  /**
   * 仅在块缺失、需要新建时生效。
   * - `scoped`：style 块新建时是否带 `scoped`（默认 false）。
   */
  createOpts?: { scoped?: boolean },
): string {
  const blocks = getSfcBlocks(sfcSource, filePath);
  const target = blocks[kind];
  if (!target) return createSfcBlock(sfcSource, kind, newContent, createOpts);

  // 重新解析一次取 attrs（getSfcBlocks 没把它们暴露出来）。
  // 与 getSfcBlocks 一样宽容：缺 <template> 等结构性错误但已解析出对应块
  // 时，仍可拿到 attrs 完成替换。
  const { descriptor, errors } = parseSFC(sfcSource, { filename: filePath });
  const hasAnyBlock =
    descriptor.scriptSetup || descriptor.script || descriptor.styles.length > 0;
  if (errors.length && !hasAnyBlock) return sfcSource;
  let attrs: Record<string, string | true>;
  if (kind === "script") {
    const sb = descriptor.scriptSetup ?? descriptor.script;
    if (!sb) return sfcSource;
    attrs = sb.attrs;
  } else {
    if (descriptor.styles.length === 0) return sfcSource;
    attrs = descriptor.styles[0].attrs;
  }

  const openTag = `${kind}${renderOpenTag(attrs)}`;
  const replacement = `<${openTag}>${newContent}</${kind}>`;
  const s = new MagicString(sfcSource);
  s.overwrite(target.start, target.end, replacement);
  return s.toString();
}

/**
 * 在 SFC 末尾新建一个 `<script setup lang="ts">` 或 `<style>` 块。
 *
 * 由 `updateSfcBlock` 在目标块缺失时调用，使「编辑代码」抽屉对无 `<script>` /
 * 无 `<style>` 的文件也能通过保存新增块。
 *
 * - script：固定 `<script setup lang="ts">`（Vue3 + TS 约定，与 demo 一致）。
 * - style：`<style>` 或 `<style scoped>`，由 `createOpts.scoped` 决定。
 * - 追加到 SFC 末尾；若源码未以换行结尾则先补一个 `\n`，避免与既有内容粘连。
 *   末尾再补一个 `\n`，符合多数 .vue 文件以换行结尾的惯例。
 */
function createSfcBlock(
  sfcSource: string,
  kind: SfcBlockKind,
  newContent: string,
  createOpts?: { scoped?: boolean },
): string {
  const attrs: Record<string, string | true> =
    kind === "script"
      ? { setup: true, lang: "ts" }
      : createOpts?.scoped
        ? { scoped: true }
        : {};
  const openTag = `${kind}${renderOpenTag(attrs)}`;
  const block = `<${openTag}>\n${newContent}\n</${kind}>`;
  const prefix = sfcSource.endsWith("\n") ? "" : "\n";
  const s = new MagicString(sfcSource);
  s.appendLeft(sfcSource.length, prefix + block + "\n");
  return s.toString();
}

// ─── 选中元素的子节点源码读写 ──────────────────────────────
// 用于「编辑代码」抽屉的「子节点文本」列：服务端提供 /get-child-text 与 /update-child-text。

/**
 * 取 (line, col) 元素开标签 `>` 与闭标签 `</tag>` 之间的全部子节点源码。
 *
 * - 配对元素：`content = sfcSource.slice(openTagEnd+1, closeTagStart)`，
 *   start/end 对应该区间（用于 update 的 MagicString overwrite）。
 * - 自闭合元素：无子节点，返回零长度区间 `{ content: "", start: openTagEnd+1, end: openTagEnd+1 }`。
 * - 元素未找到 / 开标签定位失败返回 null，handler 据此 404。
 *
 * 例：`<div>1<span>2</span>3</div>` → content = `1<span>2</span>3`。
 */
export function getChildText(
  sfcSource: string,
  filePath: string,
  line: number,
  col: number,
): ChildTextData | null {
  const t = parseTemplate(sfcSource, filePath);
  if (!t) return null;
  const el = findElementAtLoc(t.ast, line, col, t.templateLine);
  if (!el) return null;

  const range = resolveTagRange(sfcSource, t.offset, el);
  if (!range) return null;
  const innerStart = range.openTagEnd + 1;

  if (el.isSelfClosing) {
    return { content: "", start: innerStart, end: innerStart };
  }

  // 元素完整源码区间末尾即 `</tag>` 之后；`</tag>` 长度 = `</` + tag + `>` = tag.length + 3。
  const elementEnd = t.offset + el.loc.start.offset + el.loc.source.length;
  const closeTagLen = el.tag.length + 3;
  const closeTagStart = elementEnd - closeTagLen;
  if (closeTagStart < innerStart) {
    // 防御：闭标签起点早于开标签之后（理论上不应发生），按空区间处理。
    return { content: "", start: innerStart, end: innerStart };
  }
  return {
    content: sfcSource.slice(innerStart, closeTagStart),
    start: innerStart,
    end: closeTagStart,
  };
}

/**
 * 用 `newContent` 整体替换 (line, col) 元素的全部子节点源码区间。
 *
 * - 配对元素：`[innerStart, closeTagStart)` 非零长度用 `overwrite`；
 *   零长度（原无子节点，如 `<div></div>`）用 `prependRight`（MagicString
 *   不允许 overwrite 零长度区间，沿用 editElementProps 的约束）。
 * - 自闭合元素 + newContent 非空：`/>` → `>`，再 appendLeft `newContent + </tag>`，
 *   与 insertComponent 的自闭合路径语义一致；newContent 为空则原样返回（无改动）。
 * - 元素未找到 / 开标签定位失败返回 null，handler 据此 404。
 */
export function updateChildText(
  sfcSource: string,
  filePath: string,
  line: number,
  col: number,
  newContent: string,
): string | null {
  const t = parseTemplate(sfcSource, filePath);
  if (!t) return null;
  const el = findElementAtLoc(t.ast, line, col, t.templateLine);
  if (!el) return null;

  const range = resolveTagRange(sfcSource, t.offset, el);
  if (!range) return null;
  const innerStart = range.openTagEnd + 1;
  const s = new MagicString(sfcSource);

  if (el.isSelfClosing) {
    if (!newContent) return s.toString();
    // `<tag .../>` → `<tag ...>` + newContent + `</tag>`
    s.overwrite(range.openTagEnd, range.openTagEnd + 2, ">");
    s.appendLeft(range.openTagEnd + 2, newContent + "</" + el.tag + ">");
    return s.toString();
  }

  const elementEnd = t.offset + el.loc.start.offset + el.loc.source.length;
  const closeTagLen = el.tag.length + 3;
  const closeTagStart = elementEnd - closeTagLen;
  if (innerStart === closeTagStart) {
    // 零长度区间：用 prependRight 插入，避免 overwrite 抛错。
    s.prependRight(innerStart, newContent);
  } else {
    s.overwrite(innerStart, closeTagStart, newContent);
  }
  return s.toString();
}
