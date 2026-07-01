import { describe, it, expect } from 'vitest';
import { parse as parseSFC } from '@vue/compiler-sfc';
import { baseParse } from '@vue/compiler-core';
import type { ElementNode, RootNode, TemplateChildNode } from '@vue/compiler-core';
import { getElementProps, editElementProps } from '../src/editor';

/** 用 SFC parse + baseParse 找第一个元素节点的 (line, col)（SFC 全文坐标）。 */
function locate(sfc: string): { line: number; col: number } {
  const { descriptor } = parseSFC(sfc, { filename: 'Foo.vue' });
  const ast = baseParse(descriptor.template!.content, { comments: false });
  const root = ast.children[0] as ElementNode;
  // ast 的 line 是相对 template.content 的；SFC 全文中 <template> 在第 1 行，
  // 实际 1-based 全文行 = astLine + 1 - 1 = astLine。但要确认 baseParse 内部
  // 起算行号：从行 1 开始，所以根节点的全文行 = loc.start.line。
  return { line: root.loc.start.line, col: root.loc.start.column };
}

/** 找第一个匹配 tagName 的元素节点；用于 v-slot 之类内嵌 <template> 的场景。 */
function locateByTag(
  ast: RootNode,
  tag: string,
): ElementNode | undefined {
  const stack: (RootNode | TemplateChildNode)[] = [ast];
  while (stack.length) {
    const n = stack.pop()!;
    if (n.type === 1 /* ELEMENT */ && (n as ElementNode).tag === tag) {
      return n as ElementNode;
    }
    if ('children' in n && Array.isArray((n as { children: unknown }).children)) {
      stack.push(...((n as { children: TemplateChildNode[] }).children));
    }
  }
  return undefined;
}

/** 用 buildSFC 包裹一行内容，包在 <template> 块的第 2 行。 */
function buildSFC(body: string): string {
  return `<template>\n  ${body}\n</template>`;
}

describe('getElementProps / directive key extraction', () => {
  it('preserves :src arg on v-bind', () => {
    const sfc = buildSFC('<img :src="url" />');
    const { line, col } = locate(sfc);
    const result = getElementProps(sfc, 'Foo.vue', line, col)!;
    expect(result.props).toEqual([{ key: ':src', value: 'url' }]);
  });

  it('preserves v-bind:src long form (no canonicalization to :src)', () => {
    const sfc = buildSFC('<img v-bind:src="url" />');
    const { line, col } = locate(sfc);
    const result = getElementProps(sfc, 'Foo.vue', line, col)!;
    expect(result.props).toEqual([{ key: 'v-bind:src', value: 'url' }]);
  });

  it('preserves v-on:click long form (no canonicalization to @click)', () => {
    const sfc = buildSFC('<button v-on:click="onClick" />');
    const { line, col } = locate(sfc);
    const result = getElementProps(sfc, 'Foo.vue', line, col)!;
    expect(result.props).toEqual([{ key: 'v-on:click', value: 'onClick' }]);
  });

  it('preserves @click arg on v-on', () => {
    const sfc = buildSFC('<button @click="onClick" />');
    const { line, col } = locate(sfc);
    const result = getElementProps(sfc, 'Foo.vue', line, col)!;
    expect(result.props).toEqual([{ key: '@click', value: 'onClick' }]);
  });

  it('preserves :code arg on custom v-access:code directive (the bug)', () => {
    const sfc = buildSFC('<div v-access:code="value" />');
    const { line, col } = locate(sfc);
    const result = getElementProps(sfc, 'Foo.vue', line, col)!;
    expect(result.props).toEqual([{ key: 'v-access:code', value: 'value' }]);
  });

  it('preserves modifier on v-on', () => {
    const sfc = buildSFC('<button @click.prevent="onClick" />');
    const { line, col } = locate(sfc);
    const result = getElementProps(sfc, 'Foo.vue', line, col)!;
    expect(result.props).toEqual([{ key: '@click.prevent', value: 'onClick' }]);
  });

  it('preserves modifier on v-bind', () => {
    const sfc = buildSFC('<input :value.sync="name" />');
    const { line, col } = locate(sfc);
    const result = getElementProps(sfc, 'Foo.vue', line, col)!;
    expect(result.props).toEqual([{ key: ':value.sync', value: 'name' }]);
  });

  it('preserves dynamic arg with brackets on v-bind', () => {
    const sfc = buildSFC('<div :[key]="value" />');
    const { line, col } = locate(sfc);
    const result = getElementProps(sfc, 'Foo.vue', line, col)!;
    expect(result.props).toEqual([{ key: ':[key]', value: 'value' }]);
  });

  it('preserves dynamic arg + modifier on v-on', () => {
    const sfc = buildSFC('<div @[event].once="onEvent" />');
    const { line, col } = locate(sfc);
    const result = getElementProps(sfc, 'Foo.vue', line, col)!;
    expect(result.props).toEqual([{ key: '@[event].once', value: 'onEvent' }]);
  });

  it('preserves modifier on custom directive', () => {
    const sfc = buildSFC('<div v-access:code.readonly="value" />');
    const { line, col } = locate(sfc);
    const result = getElementProps(sfc, 'Foo.vue', line, col)!;
    expect(result.props).toEqual([
      { key: 'v-access:code.readonly', value: 'value' },
    ]);
  });

  it('preserves named slot v-slot:foo', () => {
    const sfc = buildSFC('<Comp><template v-slot:foo="props" /></Comp>');
    const { descriptor } = parseSFC(sfc, { filename: 'Foo.vue' });
    const ast = baseParse(descriptor.template!.content, { comments: false });
    const tplNode = locateByTag(ast, 'template')!;
    const tplLine = tplNode.loc.start.line;
    const tplCol = tplNode.loc.start.column;
    const result = getElementProps(sfc, 'Foo.vue', tplLine, tplCol)!;
    expect(result.props).toEqual([{ key: 'v-slot:foo', value: 'props' }]);
  });

  it('preserves #foo shorthand as #foo (raw form)', () => {
    const sfc = buildSFC('<Comp><template #foo="props" /></Comp>');
    const { descriptor } = parseSFC(sfc, { filename: 'Foo.vue' });
    const ast = baseParse(descriptor.template!.content, { comments: false });
    const tplNode = locateByTag(ast, 'template')!;
    const tplLine = tplNode.loc.start.line;
    const tplCol = tplNode.loc.start.column;
    const result = getElementProps(sfc, 'Foo.vue', tplLine, tplCol)!;
    expect(result.props).toEqual([{ key: '#foo', value: 'props' }]);
  });

  it('preserves plain custom directive with no arg', () => {
    const sfc = buildSFC('<div v-my-dir="value" />');
    const { line, col } = locate(sfc);
    const result = getElementProps(sfc, 'Foo.vue', line, col)!;
    expect(result.props).toEqual([{ key: 'v-my-dir', value: 'value' }]);
  });

  it('preserves v-bind (no arg) as long form v-bind', () => {
    const sfc = buildSFC('<a-button v-bind="gridOptions" />');
    const { line, col } = locate(sfc);
    const result = getElementProps(sfc, 'Foo.vue', line, col)!;
    expect(result.props).toEqual([{ key: 'v-bind', value: 'gridOptions' }]);
  });

  it('preserves v-on (no arg) as long form v-on', () => {
    const sfc = buildSFC('<a-button v-on="gridEvents" />');
    const { line, col } = locate(sfc);
    const result = getElementProps(sfc, 'Foo.vue', line, col)!;
    expect(result.props).toEqual([{ key: 'v-on', value: 'gridEvents' }]);
  });

  it('mixes v-bind/v-on long form with :src shorthand on same element', () => {
    const sfc = buildSFC(
      '<a-button v-bind="opts" v-on="events" :src="url" @click="onClick">x</a-button>',
    );
    const { line, col } = locate(sfc);
    const result = getElementProps(sfc, 'Foo.vue', line, col)!;
    expect(result.props).toEqual([
      { key: 'v-bind', value: 'opts' },
      { key: 'v-on', value: 'events' },
      { key: ':src', value: 'url' },
      { key: '@click', value: 'onClick' },
    ]);
  });

  it('preserves v-if expression', () => {
    const sfc = buildSFC('<div v-if="show" />');
    const { line, col } = locate(sfc);
    const result = getElementProps(sfc, 'Foo.vue', line, col)!;
    expect(result.props).toEqual([{ key: 'v-if', value: 'show' }]);
  });

  it('preserves v-else (no value)', () => {
    const sfc = buildSFC('<div v-if="a" /><div v-else />');
    const { descriptor } = parseSFC(sfc, { filename: 'Foo.vue' });
    const ast = baseParse(descriptor.template!.content, { comments: false });
    // baseParse 会把 v-if 转为 IF node，v-else 是同级 ELEMENT。
    // ast.children: [IF(...), ELEMENT(div v-else)]
    const lastChild = ast.children[ast.children.length - 1] as ElementNode;
    const line = lastChild.loc.start.line;
    const col = lastChild.loc.start.column;
    const result = getElementProps(sfc, 'Foo.vue', line, col)!;
    expect(result.props).toEqual([{ key: 'v-else', value: '' }]);
  });
});

describe('editElementProps round-trip preserves directive key', () => {
  it('round-trip v-access:code unchanged', () => {
    const sfc = buildSFC('<div v-access:code="value" />');
    const { line, col } = locate(sfc);
    const props = getElementProps(sfc, 'Foo.vue', line, col)!.props;
    const out = editElementProps(sfc, 'Foo.vue', line, col, props);
    const props2 = getElementProps(out, 'Foo.vue', line, col)!.props;
    expect(props2).toEqual([{ key: 'v-access:code', value: 'value' }]);
  });

  it('round-trip :[key].sync unchanged', () => {
    const sfc = buildSFC('<div :[key].sync="value" />');
    const { line, col } = locate(sfc);
    const props = getElementProps(sfc, 'Foo.vue', line, col)!.props;
    const out = editElementProps(sfc, 'Foo.vue', line, col, props);
    const props2 = getElementProps(out, 'Foo.vue', line, col)!.props;
    expect(props2).toEqual([{ key: ':[key].sync', value: 'value' }]);
  });

  it('round-trip @click.prevent unchanged', () => {
    const sfc = buildSFC('<button @click.prevent="onClick" />');
    const { line, col } = locate(sfc);
    const props = getElementProps(sfc, 'Foo.vue', line, col)!.props;
    const out = editElementProps(sfc, 'Foo.vue', line, col, props);
    const props2 = getElementProps(out, 'Foo.vue', line, col)!.props;
    expect(props2).toEqual([{ key: '@click.prevent', value: 'onClick' }]);
  });
});
