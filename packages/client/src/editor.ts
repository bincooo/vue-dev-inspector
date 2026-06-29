import { parse as parseSFC } from "@vue/compiler-sfc";
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

/** 指令名 → 源码前缀（bind/on 需再拼接参数名） */
const DIRECTIVE_PREFIX: Record<string, string> = {
  bind: ":",
  on: "@",
  model: "v-model",
  for: "v-for",
  if: "v-if",
  "else-if": "v-else-if",
  else: "v-else",
  html: "v-html",
  text: "v-text",
  show: "v-show",
};

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
  };
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

/** 在模板 AST 中查找位于 (line, col) 的元素节点（line 1-based，column 0-based） */
function findElementAtLoc(
  ast: RootNode,
  line: number,
  col: number,
): ElementNode | null {
  const stack: (RootNode | TemplateChildNode)[] = [ast];
  while (stack.length) {
    const node = stack.pop()!;
    if (node.type === NodeTypes.ELEMENT) {
      const el = node as ElementNode;
      if (el.loc.start.line === line && el.loc.start.column === col) return el;
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
        const prefix = DIRECTIVE_PREFIX[d.name] ?? `v-${d.name}`;
        const exp = isSimpleExp(d.exp) ? d.exp.content : "";
        if (d.name === "bind" || d.name === "on") {
          return {
            key: prefix + (isSimpleExp(d.arg) ? d.arg.content : ""),
            value: exp,
          };
        }
        return { key: prefix, value: d.name === "else" ? "" : exp };
      }
      return null;
    })
    .filter((p): p is PropEntry => p !== null);
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
  const el = findElementAtLoc(t.ast, line, col);
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
  const el = findElementAtLoc(t.ast, line, col);
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
 * 用 AST 定位目标元素，删除其完整源码区间（含行首缩进与尾部换行）。
 *
 * 删除范围 = `[lineStart, end+1)`：
 *   - 行首缩进必须一并删掉，否则下一行会"继承"被删元素的缩进
 *     并在原行留下"打碎的空白段"。这种残留进一步会让相邻兄弟元素
 *     的 src AST 重新解析时列号偏移，data-source-file 失效 → HMR 边界异常。
 *     复现路径：先 duplicate 再 delete 原元素即可触发。
 *   - 末尾换行一并删，让下一行顶上来（与 moveElement 的 remove 语义一致）。
 */
export function deleteElement(
  sfcSource: string,
  filePath: string,
  line: number,
  col: number,
): string {
  const t = parseTemplate(sfcSource, filePath);
  if (!t) return sfcSource;
  const el = findElementAtLoc(t.ast, line, col);
  if (!el) return sfcSource;

  const start = t.offset + el.loc.start.offset;
  const end = start + el.loc.source.length;
  const lineStart = sfcSource.lastIndexOf("\n", start) + 1;
  const trimEnd = sfcSource[end] === "\n" ? end + 1 : end;
  const s = new MagicString(sfcSource);
  s.remove(lineStart, trimEnd);
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
): string | null {
  const t = parseTemplate(sfcSource, filePath);
  if (!t) return null;
  const el = findElementAtLoc(t.ast, line, col);
  if (!el) return null;

  // 查组件 schema；没有则按 tag 生成默认片段
  const schema = COMPONENT_CATALOG.find((c) => c.tag === componentTag);
  const snippet = schema ? componentSnippet(schema) : `<${componentTag} />`;

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
  const el = findElementAtLoc(t.ast, line, col);
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
function isDescendantOrSelf(
  source: ElementNode,
  target: ElementNode,
): boolean {
  if (source === target) return true;
  const stack: (RootNode | TemplateChildNode)[] = [source];
  while (stack.length) {
    const node = stack.pop()!;
    if (node === target) return true;
    stack.push(...childrenOf(node));
  }
  return false;
}

/**
 * 移动 (srcLine, srcCol) 元素到 (targetLine, targetCol) 处。
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
  const source = findElementAtLoc(t.ast, srcLine, srcCol);
  if (!source) return null;
  const target = findElementAtLoc(t.ast, targetLine, targetCol);
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

  // 1. 删源：从源所在行的行首（含缩进）到源元素末尾 + 尾部换行
  //    必须包含缩进，否则下一行的缩进会和它合并，造成双重缩进。
  s.remove(
    sfcSource.lastIndexOf("\n", sourceStart) + 1,
    sfcSource[sourceEnd] === "\n" ? sourceEnd + 1 : sourceEnd,
  );

  // 2. 在目标位置插入（用原始偏移，appendLeft/appendRight 不被前面的 remove 影响）
  if (direction === "before" || direction === "after") {
    const rewritten = reindent(source.loc.source, targetIndent);
    if (direction === "before") {
      s.appendLeft(sfcSource.lastIndexOf("\n", targetStart) + 1, rewritten + "\n");
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
