import { describe, it, expect } from "vitest";
import { parse as parseSFC } from "@vue/compiler-sfc";
import { baseParse } from "@vue/compiler-core";
import type {
  ElementNode,
  RootNode,
  TemplateChildNode,
} from "@vue/compiler-core";
import { getChildText, updateChildText } from "../src/editor";

/** 数 offset 之前有几个换行符 + 1 = 1-based 行号（对齐 editor.offsetToLine） */
function offsetToLine(code: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset && i < code.length; i++) {
    if (code[i] === "\n") line++;
  }
  return line;
}

/** 在模板 AST 里按 tag 找元素节点 */
function findByTag(ast: RootNode, tag: string): ElementNode | undefined {
  const stack: (RootNode | TemplateChildNode)[] = [ast];
  while (stack.length) {
    const n = stack.pop()!;
    if (n.type === 1 && (n as ElementNode).tag === tag) {
      return n as ElementNode;
    }
    if (
      "children" in n &&
      Array.isArray((n as { children: unknown }).children)
    ) {
      stack.push(...(n as { children: TemplateChildNode[] }).children);
    }
  }
  return undefined;
}

/** 返回 tag 元素的 SFC 全文 (line, col)（1-based line / 0-based col），对齐 data-source-file 编码 */
function locateTag(sfc: string, tag: string): { line: number; col: number } {
  const { descriptor } = parseSFC(sfc, { filename: "Foo.vue" });
  const tpl = descriptor.template!;
  const ast = baseParse(tpl.content, { comments: false });
  const el = findByTag(ast, tag)!;
  const templateLine = offsetToLine(sfc, tpl.loc.start.offset);
  return {
    line: templateLine + el.loc.start.line - 1,
    col: el.loc.start.column,
  };
}

describe("getChildText / updateChildText - 跨行闭合标签", () => {
  // 闭合标签 `</a-card\n  >` 拆在两行（`>` 前有换行+缩进）。
  // 旧算术法 elementEnd-(tag.length+3) 会算短，把 `</a-c` 混进子节点内容。
  const sfc = `<template>
  <a-card title="Antd 卡片" style="width: 320px">
    <template #extra>
      <a href="#">More</a>
    </template>
    <p>
      内容
    </p>
    <a-space :style="{ width: '100%' }">
      <a-button>取消</a-button>
    </a-space></a-card
  >
</template>
`;

  it("getChildText 不把半截闭标签 `</a-c` 混进内容", () => {
    const { line, col } = locateTag(sfc, "a-card");
    const result = getChildText(sfc, "Foo.vue", line, col)!;
    expect(result).not.toBeNull();
    expect(result.content).toContain("<template #extra>");
    expect(result.content).toContain('<a href="#">More</a>');
    expect(result.content).toContain("<p>");
    expect(result.content).toContain("<a-button>取消</a-button>");
    expect(result.content).toContain("</a-space>");
    // 关键回归断言：不能出现半截 / 完整闭标签
    expect(result.content).not.toContain("</a-c");
    expect(result.content).not.toContain("</a-card");
  });

  it("updateChildText 能正确替换跨行闭合标签元素的子节点", () => {
    const { line, col } = locateTag(sfc, "a-card");
    const out = updateChildText(
      sfc,
      "Foo.vue",
      line,
      col,
      "<span>新内容</span>",
    );
    expect(out).not.toBeNull();
    // 旧子节点被替换掉
    expect(out).not.toContain("<template #extra>");
    expect(out).not.toContain("取消");
    // 新内容写入
    expect(out).toContain("<span>新内容</span>");
    // 闭合标签保持完整（跨行写法保留）
    expect(out).toContain("</a-card");
  });
});

describe("getChildText / updateChildText - 常规单行闭合标签（回归保护）", () => {
  const sfc = `<template>
  <div class="box">
    <span>子</span>
  </div>
</template>
`;

  it("getChildText 正常返回子节点内容", () => {
    const { line, col } = locateTag(sfc, "div");
    const result = getChildText(sfc, "Foo.vue", line, col)!;
    expect(result).not.toBeNull();
    expect(result.content).toContain("<span>子</span>");
    expect(result.content).not.toContain("</div");
  });

  it("updateChildText 正常替换子节点内容", () => {
    const { line, col } = locateTag(sfc, "div");
    const out = updateChildText(sfc, "Foo.vue", line, col, "<p>替换</p>");
    expect(out).not.toBeNull();
    expect(out).toContain("<p>替换</p>");
    expect(out).not.toContain("<span>子</span>");
    expect(out).toContain("</div>");
  });
});
