import { describe, it, expect } from "vitest";
import { parse as parseSFC } from "@vue/compiler-sfc";
import { baseParse } from "@vue/compiler-core";
import type {
  ElementNode,
  RootNode,
  TemplateChildNode,
} from "@vue/compiler-core";
import { deleteElement, moveElement } from "../src/editor";

/**
 * 用 SFC parse + baseParse 在模板 AST 中递归查找第一个匹配 tagName 的元素节点，
 * 返回它的 (line, col)（SFC 全文 1-based 行 / 0-based 列），与 overlay 注入属性一致。
 */
function locateByTag(sfc: string, tag: string): { line: number; col: number } {
  const { descriptor } = parseSFC(sfc, { filename: "Foo.vue" });
  const ast = baseParse(descriptor.template!.content, { comments: false });
  const stack: (RootNode | TemplateChildNode)[] = [ast];
  while (stack.length) {
    const n = stack.pop()!;
    if (n.type === 1 /* ELEMENT */ && (n as ElementNode).tag === tag) {
      const el = n as ElementNode;
      return { line: el.loc.start.line, col: el.loc.start.column };
    }
    if (
      "children" in n &&
      Array.isArray((n as { children: unknown }).children)
    ) {
      stack.push(...(n as { children: TemplateChildNode[] }).children);
    }
  }
  throw new Error(`tag <${tag}> not found in template`);
}

/** 解析 SFC 模板，断言无语法错（无 "Element is missing end tag" / "Invalid end tag" 之类）。 */
function expectTemplateParses(sfc: string): void {
  const { descriptor, errors } = parseSFC(sfc, { filename: "Foo.vue" });
  expect(errors, "parseSFC errors").toEqual([]);
  expect(descriptor.template, "template block present").toBeDefined();
  // baseParse 在缺闭标签 / 孤悬闭标签时会抛 SyntaxError
  expect(() =>
    baseParse(descriptor.template!.content, { comments: false }),
  ).not.toThrow();
}

// ─── deleteElement ──────────────────────────────────────────────

describe("deleteElement - 元素与前置内容共行", () => {
  it("删除与父开标签同行的子元素，不吞父开标签（本次 bug 复现）", () => {
    // 行 2：`  <a-card><a-space><span>项</span></a-space></a-card>`
    // <span> 与父开标签 <a-space> 共行；删除 span 后行内只剩 <a-card><a-space></a-space></a-card>
    const sfc = `<template>\n  <a-card><a-space><span>项</span></a-space></a-card>\n</template>`;
    const loc = locateByTag(sfc, "span");
    const out = deleteElement(sfc, "Foo.vue", loc.line, loc.col);
    expectTemplateParses(out);
    expect(out).toContain("<a-space></a-space>");
    expect(out).not.toContain("<span>项</span>");
    // 没有把 <a-space> 开标签吞掉 -> 不出现孤悬 </a-space>
    expect(out).not.toMatch(/<\/a-space>[^<]*<\/a-space>/);
  });

  it("删除与兄弟同行的元素，保留兄弟", () => {
    // 行 2：`  <div><a><b/></a><c/></div>`
    const sfc = `<template>\n  <div><a><b/></a><c/></div>\n</template>`;
    const loc = locateByTag(sfc, "b");
    const out = deleteElement(sfc, "Foo.vue", loc.line, loc.col);
    expectTemplateParses(out);
    expect(out.split("\n")[1]).toBe("  <div><a></a><c/></div>");
  });

  it("删除行首独占元素，连缩进与换行一并删（happy path 回归）", () => {
    // 行 3：`    <p>x</p>` 独占一行
    const sfc = `<template>\n  <a-card>\n    <p>x</p>\n  </a-card>\n</template>`;
    const loc = locateByTag(sfc, "p");
    const out = deleteElement(sfc, "Foo.vue", loc.line, loc.col);
    expectTemplateParses(out);
    // <p> 整行（含缩进与换行）被删，下一行  </a-card> 顶上，无空行
    expect(out).toBe(`<template>\n  <a-card>\n  </a-card>\n</template>`);
  });
});

// ─── moveElement ────────────────────────────────────────────────

describe("moveElement - 源与前置内容共行", () => {
  it("把与父开标签同行的源 move 走，源行不留孤悬闭标签", () => {
    // 行 2：`  <a-card><a-space><span>项</span></a-space></a-card>`（源 span 与父开标签共行）
    // 行 3：`  <b-target/>`（目标）
    const sfc = `<template>\n  <a-card><a-space><span>项</span></a-space></a-card>\n  <b-target/>\n</template>`;
    const src = locateByTag(sfc, "span");
    const target = locateByTag(sfc, "b-target");
    const out = moveElement(
      sfc,
      "Foo.vue",
      src.line,
      src.col,
      target.line,
      target.col,
      "before",
    );
    expect(out).not.toBeNull();
    expectTemplateParses(out!);
    // 源行：span 被搬走，父结构完整 -> <a-space></a-space>，无孤悬 </a-space>
    expect(out!).toContain("<a-space></a-space>");
    expect(out!).not.toMatch(/<\/a-space>[^<]*<\/a-space>/);
    // span 源码出现在目标位置之前
    expect(out!).toContain("<span>项</span>");
  });

  it("move 行首独占源元素，源行整行消失不留残留缩进（happy path 回归）", () => {
    // 行 3：`    <p>x</p>`（源，行首独占）；行 4：`    <b-target/>`（目标）
    const sfc = `<template>\n  <a-card>\n    <p>x</p>\n    <b-target/>\n  </a-card>\n</template>`;
    const src = locateByTag(sfc, "p");
    const target = locateByTag(sfc, "b-target");
    const out = moveElement(
      sfc,
      "Foo.vue",
      src.line,
      src.col,
      target.line,
      target.col,
      "before",
    );
    expect(out).not.toBeNull();
    expectTemplateParses(out!);
    // <p> 整行被删，无残留空行 / 残留缩进（不出现连续换行夹空白）
    expect(out!).not.toMatch(/\n[ \t]*\n/);
    // span 源码出现在目标之前
    expect(out!).toContain("<p>x</p>");
    expect(out!).toContain("<b-target/>");
  });
});
