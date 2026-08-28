import { describe, it, expect } from 'vitest';
import { ensureImports } from '../src/editor';
import { parseImportStatement, joinImportStatements } from '../src/imports';

describe('parseImportStatement', () => {
  it('parses named imports', () => {
    const r = parseImportStatement('import { Button } from "antdv-next"');
    expect(r?.module).toBe('antdv-next');
    expect(r?.named).toEqual([{ imported: 'Button', local: 'Button' }]);
    expect(r?.defaultName).toBeUndefined();
    expect(r?.namespaceName).toBeUndefined();
  });

  it('parses named imports with alias', () => {
    const r = parseImportStatement(
      'import { Button as Btn } from "antdv-next"',
    );
    expect(r?.named).toEqual([{ imported: 'Button', local: 'Btn' }]);
  });

  it('parses multiple named imports', () => {
    const r = parseImportStatement(
      'import { Input, InputPassword } from "antdv-next"',
    );
    expect(r?.named).toEqual([
      { imported: 'Input', local: 'Input' },
      { imported: 'InputPassword', local: 'InputPassword' },
    ]);
  });

  it('parses default + named', () => {
    const r = parseImportStatement('import D, { X, Y } from "mod"');
    expect(r?.defaultName).toBe('D');
    expect(r?.named).toEqual([
      { imported: 'X', local: 'X' },
      { imported: 'Y', local: 'Y' },
    ]);
  });

  it('parses namespace import', () => {
    const r = parseImportStatement('import * as ns from "mod"');
    expect(r?.namespaceName).toBe('ns');
    expect(r?.named).toEqual([]);
  });

  it('parses side-effect import', () => {
    const r = parseImportStatement('import "mod"');
    expect(r?.module).toBe('mod');
    expect(r?.named).toEqual([]);
    expect(r?.defaultName).toBeUndefined();
  });

  it('parses import type { ... } as clause-level type-only', () => {
    const r = parseImportStatement('import type { Foo } from "mod"');
    expect(r?.module).toBe('mod');
    expect(r?.isTypeOnly).toBe(true);
    expect(r?.named).toEqual([{ imported: 'Foo', local: 'Foo' }]);
  });

  it('parses binding-level type { type X }', () => {
    const r = parseImportStatement('import { type Foo, Bar } from "mod"');
    expect(r?.module).toBe('mod');
    expect(r?.isTypeOnly).toBe(false);
    expect(r?.named).toEqual([
      { imported: 'Foo', local: 'Foo', isTypeOnly: true },
      { imported: 'Bar', local: 'Bar' },
    ]);
  });

  it('parses import type D (default type-only)', () => {
    const r = parseImportStatement('import type D from "mod"');
    expect(r?.module).toBe('mod');
    expect(r?.isTypeOnly).toBe(true);
    expect(r?.defaultName).toBe('D');
  });

  it('returns null for non-import / dynamic import', () => {
    expect(parseImportStatement('const x = 1')).toBeNull();
    expect(parseImportStatement('import("mod")')).toBeNull();
    expect(parseImportStatement('import.meta')).toBeNull();
  });
});

describe('ensureImports', () => {
  const wrap = (script: string): string =>
    `<template><div /></template>\n<script setup lang="ts">\n${script}\n</script>\n`;

  it('appends whole statement when module not imported', () => {
    const sfc = wrap('const a = 1');
    const out = ensureImports(sfc, 'F.vue', [
      'import { Button } from "antdv-next"',
    ]);
    expect(out).toContain('import { Button } from "antdv-next"');
    expect(out).toContain('const a = 1');
  });

  it('merges missing named into existing clause', () => {
    const sfc = wrap('import { Input } from "antdv-next"\nconst a = 1');
    const out = ensureImports(sfc, 'F.vue', [
      'import { Button } from "antdv-next"',
    ]);
    expect(out).toContain('import { Input, Button } from "antdv-next"');
    // 不应再追加一条独立的 Button import
    expect(out).not.toContain('import { Button } from "antdv-next"');
  });

  it('merges into multiline named clause', () => {
    const sfc = wrap('import {\n  Input,\n  Select\n} from "antdv-next"');
    const out = ensureImports(sfc, 'F.vue', [
      'import { Button } from "antdv-next"',
    ]);
    expect(out).toContain('Button');
    expect(out).toContain('Input');
    expect(out).toContain('Select');
    // 合并而非新增：只有一条 antdv-next import 语句
    expect((out.match(/from "antdv-next"/g) || []).length).toBe(1);
  });

  it('is idempotent when named already imported', () => {
    const sfc = wrap('import { Button } from "antdv-next"\nconst a = 1');
    const out = ensureImports(sfc, 'F.vue', [
      'import { Button } from "antdv-next"',
    ]);
    expect(out).toBe(sfc);
  });

  it('respects alias in dedup (Button as Btn counts as Button imported)', () => {
    const sfc = wrap('import { Button as Btn } from "antdv-next"');
    const out = ensureImports(sfc, 'F.vue', [
      'import { Button } from "antdv-next"',
    ]);
    expect(out).toBe(sfc);
  });

  it('ignores import keyword inside strings and comments', () => {
    const sfc = wrap(
      'const s = "import { Button } from \\"antdv-next\\""\n// import { X } from "y"\nconst a = 1',
    );
    const out = ensureImports(sfc, 'F.vue', [
      'import { Button } from "antdv-next"',
    ]);
    // 字符串/注释里的不算已导入，应追加一条真实 import
    const realImports =
      out.match(/^import \{ Button \} from "antdv-next"$/gm) || [];
    expect(realImports.length).toBe(1);
  });

  it('creates <script setup lang=ts> when none exists', () => {
    const sfc = `<template><div /></template>\n`;
    const out = ensureImports(sfc, 'F.vue', [
      'import { Button } from "antdv-next"',
    ]);
    expect(out).toContain('<script setup lang="ts">');
    expect(out).toContain('import { Button } from "antdv-next"');
    expect(out).toContain('</script>');
  });

  it('handles multiple desired imports (mix append + merge)', () => {
    const sfc = wrap('import { Input } from "antdv-next"\nconst a = 1');
    const out = ensureImports(sfc, 'F.vue', [
      'import { Button } from "antdv-next"',
      'import { ref } from "vue"',
    ]);
    expect(out).toContain('import { Input, Button } from "antdv-next"');
    expect(out).toContain('import { ref } from "vue"');
  });

  it('appends partial for missing default when module has named clause', () => {
    const sfc = wrap('import { X } from "mod"\nconst a = 1');
    const out = ensureImports(sfc, 'F.vue', ['import D, { X } from "mod"']);
    // X 已存在；D 缺 -> 追加 import D from "mod"
    expect(out).toContain('import D from "mod"');
    expect((out.match(/from "mod"/g) || []).length).toBe(2);
  });

  it('skips dynamic import() and import.meta when scanning', () => {
    const sfc = wrap('const m = import("mod")\nconst meta = import.meta.url');
    const out = ensureImports(sfc, 'F.vue', ['import { X } from "mod"']);
    expect(out).toContain('import { X } from "mod"');
  });

  it('returns source unchanged when no imports given', () => {
    const sfc = wrap('const a = 1');
    expect(ensureImports(sfc, 'F.vue', [])).toBe(sfc);
  });

  it('writes into an empty <script> block instead of creating a second one', () => {
    const sfc = `<template><div /></template>\n<script setup lang="ts"></script>\n`;
    const out = ensureImports(sfc, 'F.vue', [
      'import { Button } from "antdv-next"',
    ]);
    expect((out.match(/<script/g) || []).length).toBe(1);
    expect(out).toContain('import { Button } from "antdv-next"');
  });

  // ---- type / value 语义 ----
  it('keeps both when existing type-only and desired value share name', () => {
    const sfc = wrap('import type { Foo } from "mod"\nconst a = 1');
    const out = ensureImports(sfc, 'F.vue', ['import { Foo } from "mod"']);
    // 两条共存：原 type-only 保留，值导入追加
    expect(out).toContain('import type { Foo } from "mod"');
    expect(out).toContain('import { Foo } from "mod"');
  });

  it('keeps both when existing value and desired type-only share name', () => {
    const sfc = wrap('import { Foo } from "mod"\nconst a = 1');
    const out = ensureImports(sfc, 'F.vue', ['import type { Foo } from "mod"']);
    expect(out).toContain('import { Foo } from "mod"');
    expect(out).toContain('import type { Foo } from "mod"');
  });

  it('does not merge value import into clause-level type clause', () => {
    const sfc = wrap('import type { A } from "mod"\nconst a = 1');
    const out = ensureImports(sfc, 'F.vue', ['import { B } from "mod"']);
    // type 子句原样不变，B 另起一行
    expect(out).toContain('import type { A } from "mod"');
    expect(out).toContain('import { B } from "mod"');
    expect(out).not.toContain('import type { A, B }');
  });

  it('merges binding-level type into existing mixed clause', () => {
    const sfc = wrap('import { type A, B } from "mod"');
    const out = ensureImports(sfc, 'F.vue', ['import { type C } from "mod"']);
    expect(out).toContain('import { type A, B, type C } from "mod"');
    // 不新增独立语句
    expect((out.match(/from "mod"/g) || []).length).toBe(1);
  });

  it('does not merge binding-level type into pure value clause', () => {
    const sfc = wrap('import { A } from "mod"\nconst a = 1');
    const out = ensureImports(sfc, 'F.vue', ['import { type B } from "mod"']);
    expect(out).toContain('import { A } from "mod"');
    expect(out).toContain('import { type B } from "mod"');
    expect((out.match(/from "mod"/g) || []).length).toBe(2);
  });
});

describe('joinImportStatements', () => {
  it('keeps binding-level type statement (no longer dropped)', () => {
    const out = joinImportStatements(['import { type X } from "mod"']);
    expect(out).toBe('import { type X } from "mod"');
  });
});
