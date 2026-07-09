# v-bind / v-on / v-access:code 等指令解析截断修复实现计划

> **For agentic workers:** REQUIRED SUB-KILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 `packages/client/src/editor.ts` 中 `extractProps` 对指令 `arg` 与 `modifiers` 的截断问题，使服务端 AST 读写在 `v-bind:src` / `v-on:click` / `v-access:code` / `v-bind:[dyn]` / `v-on:click.prevent` / `v-bind:src.sync` 等指令上保持源码等价、语义不变。

**Architecture:**
- 单文件改造：`packages/client/src/editor.ts` 内 `extractProps` 重写为统一序列化器（arg / dynamic arg / modifiers / 表达式）。
- `editElementProps` 的 attrs 序列化器需保持与 `extractProps` 完全对偶：往返一致（identity round-trip）。
- 新增 `packages/client/test/editor-extract-props.test.ts`：用 `baseParse` 直接喂 SFC 源码，断言 `getElementProps` 的返回结构与重新写入后源码等价。

**Tech Stack:** TypeScript、`@vue/compiler-core`、`@vue/compiler-sfc`、`magic-string`、vitest@^2、tsup。

## Global Constraints

1. **零破坏性**：现有 `class` / `:src` / `@click` / `v-if` / `v-else` / `v-slot:foo` 等已被覆盖的写法继续工作；用户主动编辑后写回的源码在重新解析后属性集合与编辑后一致。
2. **不动前端 UI**：`overlay/src/panel.ts` 的 `PropEntry { key, value }` 契约不变；新增的 arg/modifier 信息以「写在 key 里」的形式呈现（key 就是源码书写形式），UI 端继续把 key 当字符串展示/编辑。
3. **指令源码语法还原**：
   - `v-bind:src` → key `":src"`（保持现状）
   - `v-on:click` → key `"@click"`（保持现状）
   - `v-bind:src.sync` → key `":src.sync"`
   - `v-on:click.prevent` → key `"@click.prevent"`
   - `v-bind:[key]`（动态 arg）→ key `":[key]"`（把 `arg.isStatic === false` 的 content 用 `[]` 包回）
   - `v-on:[event].once` → key `"@[event].once"`
   - `v-access:code`（自定义指令带 arg）→ key `"v-access:code"`（**当前缺失 → 修复**）
   - `v-access:code.foo` → key `"v-access:code.foo"`
   - `v-my-dir`（无 arg 无 modifier）→ key `"v-my-dir"`
4. **不修改 transform.ts**：`core/src/transform.ts` 的 `data-source-file` 注入路径与本次问题无关。
5. **错误语义**：arg 解析失败（非 SimpleExpressionNode 且不可序列化）时抛 `[vdi] unsupported directive arg in extractProps`，不静默丢数据。
6. **代码风格**：中文注释、英文标识符；保持与 `packages/client/src/editor.ts` 一致。
7. **包管理器**：pnpm；ESM-only；改动后必须重建 client 包并由用户跑 `pnpm dev:demo` 验证。
8. **测试**：新增 `vitest@^2` 作为 client 包 devDep（当前 packages/client 无 test 目录）。
9. **类型**：保持导出 `PropEntry { key: string; value: string }` 不变；扩展只能发生在 `key` 字符串编码层（key 即源码）。

---

## Root Cause（来自 Phase 1）

`packages/client/src/editor.ts:118-141` 的 `extractProps`：

```ts
if (d.name === "bind" || d.name === "on") {
  return {
    key: prefix + (isSimpleExp(d.arg) ? d.arg.content : ""),
    value: exp,
  };
}
return { key: prefix, value: d.name === "else" ? "" : exp };
```

- 只对 `bind` / `on` 拼 arg；其它指令（如自定义 `v-access:code`）的 arg 全部丢弃。
- `modifiers`（`d.modifiers[]`）从未被读取，所有指令的 `.prevent` / `.sync` / `.stop` / `.capture` 等修饰符都丢失。
- 动态 arg（`v-bind:[key]`）的 `arg.content` 已被 Vue 解析器去掉 `[]`，但 `arg.isStatic === false`；当前实现把 `isSimpleExp(d.arg) === true` 当成「静态」的条件，实际能跑通，但 round-trip 时无法还原 `[key]` 写法 —— 编辑后再保存会变成 `v-bind:key="..."`（静态），语义改变。

`editElementProps` 的 attrs 序列化器（`editor.ts:213-217`）只做 ` ${key}="${value}"`，对含 `:`、`.`、`[`、`]` 的 key 不做转义。Vue 模板解析器允许直接书写这些字符，**不需要转义**，所以序列化器保持简单即可。

---

## File Structure

| 文件 | 职责 |
|---|---|
| `packages/client/src/editor.ts` (改) | 重写 `extractProps`；新增 `formatDirectiveKey(d)` helper |
| `packages/client/package.json` (改) | 加 `vitest@^2` devDep + test 脚本 |
| `packages/client/vitest.config.ts` (新) | node 环境配置 |
| `packages/client/test/extract-props.test.ts` (新) | 单元测试：arg / modifiers / dynamic arg / 其它指令 / 边界 case |

`editElementProps` 不改（其 attrs 序列化器对 `v-access:code` / `[key]` / `.prevent` 全部透明，Vue 解析器吃原样）。但**用 round-trip 测试**保证二者对偶。

---

## Tasks

### Task 1：建立 client 包测试基础设施

**Files:**
- Modify: `packages/client/package.json`
- Create: `packages/client/vitest.config.ts`

**Interfaces:**
- Consumes: 无
- Produces: 可运行的 vitest 框架

- [ ] **Step 1：修改 `packages/client/package.json`**

读 `packages/client/package.json`，在 `devDependencies` 块中追加（如果不存在）：

```json
    "vitest": "^2.1.0"
```

在 `scripts` 块中追加：

```json
    "test": "vitest run"
```

参考已存在的 `packages/utils/package.json:18-29` 字段布局。

- [ ] **Step 2：创建 `packages/client/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
```

- [ ] **Step 3：跑一次空套件确认配置可加载**

```bash
cd packages/client && npx vitest run --reporter=verbose
```

预期输出：`No test files found`，退出码 0。

- [ ] **Step 4：提交**

```bash
git add packages/client/package.json packages/client/vitest.config.ts
git commit -m "test(client): add vitest scaffolding for editor unit tests"
```

---

### Task 2：补全 `DIRECTIVE_PREFIX` —— 抹平「bind/on 用前缀、其它指令用 `v-`」的不对称

**Files:**
- Modify: `packages/client/src/editor.ts:32-43`

**Interfaces:**
- Consumes: 无
- Produces: `DIRECTIVE_PREFIX` 包含「`slot`（`v-slot`，已有别名但被遗漏）」、`else-if`、`else` 不变；统一规则在 helper 里使用

- [ ] **Step 1：在 `DIRECTIVE_PREFIX` 里追加 `slot` 条目**

当前 `editor.ts:32-43` 缺少 `slot`，导致任何带 arg 的 `v-slot:foo` 走到 `else` 分支时返回 `key: "v-slot"`、`value: "foo"`，**丢掉 arg**。这就是 v-slot:foo 与 v-access:code 同根的 bug 表现（虽然测试主题是 access，但顺手把 slot 也修对）。

把

```ts
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
```

改为

```ts
const DIRECTIVE_PREFIX: Record<string, string> = {
  bind: ":",
  on: "@",
  slot: "v-slot",
  model: "v-model",
  for: "v-for",
  if: "v-if",
  "else-if": "v-else-if",
  else: "v-else",
  html: "v-html",
  text: "v-text",
  show: "v-show",
};
```

> 备注：本次 root cause 是 arg/modifier 截断，slot 的修复由 Task 3 的 helper 统一覆盖；这里先把 prefix 表补齐，避免 Task 3 的 helper 在 slot 走 fallthrough 分支拼出 `v-slot:` 而非 `v-slot`。

- [ ] **Step 2：暂不跑测试，下一 Task 才用到此 helper**

- [ ] **Step 3：提交**

```bash
git add packages/client/src/editor.ts
git commit -m "refactor(client/editor): add slot to DIRECTIVE_PREFIX table"
```

---

### Task 3：抽出 `formatDirectiveKey` helper + 重写 `extractProps` —— 写测试失败用例

**Files:**
- Modify: `packages/client/src/editor.ts:118-141`
- Create: `packages/client/test/extract-props.test.ts`

**Interfaces:**
- Consumes: Vue AST `DirectiveNode`（来自 `@vue/compiler-core`）
- Produces:
  - `function formatDirectiveKey(d: DirectiveNode): string`：把指令还原为源码书写形式的 key（含 arg / dynamic arg / modifiers）
  - `function extractProps(el: ElementNode): PropEntry[]`：用 `formatDirectiveKey` 替换原 inline 分支

> 这一 Task 用 TDD：**Step 1 先写测试**，**Step 2 跑确认失败**（当前 `extractProps` 对 `v-access:code` 返回 `v-access`，对 `.prevent` 丢失），**Step 3 写实现**，**Step 4 跑确认通过**，**Step 5 提交**。

- [ ] **Step 1：写失败测试 —— `packages/client/test/extract-props.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { getElementProps, editElementProps } from '../src/editor';

/** 用 `baseParse` 找元素节点的 (line, col)；在 SFC 里 <template> 在第 2 行（首行换行后）。 */
function buildSFC(body: string): string {
  return `<template>\n  ${body}\n</template>`;
}

/** 把 SFC 喂给 baseParse，找到第一个元素节点的绝对行/列。 */
import { baseParse } from '@vue/compiler-core';

function locate(sfc: string): { line: number; col: number } {
  const ast = baseParse(sfc, { comments: false });
  const root = ast.children[0] as any;
  return { line: root.loc.start.line + 1, col: root.loc.start.column };
}

describe('getElementProps / directive key extraction', () => {
  it('preserves :src arg on v-bind', () => {
    const sfc = buildSFC('<img :src="url" />');
    const { line, col } = locate(sfc);
    const result = getElementProps(sfc, 'Foo.vue', line, col)!;
    expect(result.props).toEqual([{ key: ':src', value: 'url' }]);
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
    expect(result.props).toEqual([{ key: 'v-access:code.readonly', value: 'value' }]);
  });

  it('preserves named slot v-slot:foo', () => {
    const sfc = buildSFC('<Comp><template #foo="props" /></Comp>');
    const { line, col } = locate(sfc);
    // 找 <template>，它才是被解析为带 prop 的元素
    const ast = baseParse(sfc, { comments: false });
    let templateNode: any;
    const stack = [ast];
    while (stack.length) {
      const n: any = stack.pop();
      if (n?.tag === 'template') { templateNode = n; break; }
      if (n?.children) stack.push(...n.children);
    }
    const tplLine = templateNode.loc.start.line + 1;
    const tplCol = templateNode.loc.start.column;
    const result = getElementProps(sfc, 'Foo.vue', tplLine, tplCol)!;
    expect(result.props).toEqual([{ key: 'v-slot:foo', value: 'props' }]);
  });

  it('preserves plain custom directive with no arg', () => {
    const sfc = buildSFC('<div v-my-dir="value" />');
    const { line, col } = locate(sfc);
    const result = getElementProps(sfc, 'Foo.vue', line, col)!;
    expect(result.props).toEqual([{ key: 'v-my-dir', value: 'value' }]);
  });
});

describe('editElementProps round-trip preserves directive key', () => {
  it('round-trip v-access:code unchanged', () => {
    const sfc = buildSFC('<div v-access:code="value" />');
    const { line, col } = locate(sfc);
    const props = getElementProps(sfc, 'Foo.vue', line, col)!.props;
    const out = editElementProps(sfc, 'Foo.vue', line, col, props);
    // 重新解析应得到等价的 prop 集合
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
```

- [ ] **Step 2：跑测试，确认期望的失败点**

```bash
cd packages/client && npx vitest run test/extract-props.test.ts --reporter=verbose
```

预期输出：
- `preserves :src arg on v-bind` ✅ 通过（现状就行）
- `preserves @click arg on v-on` ✅ 通过
- `preserves :code arg on custom v-access:code directive` ❌ FAIL（当前返回 `v-access`，期望 `v-access:code`）
- `preserves modifier on v-on` ❌ FAIL（当前返回 `@click`）
- `preserves modifier on v-bind` ❌ FAIL（当前返回 `:value`）
- `preserves dynamic arg with brackets on v-bind` ❌ FAIL（当前返回 `:key`）
- `preserves dynamic arg + modifier on v-on` ❌ FAIL（当前返回 `@[event]` 或 `@event`）
- `preserves modifier on custom directive` ❌ FAIL（当前返回 `v-access:code` 但 `.readonly` 丢失）
- `preserves named slot v-slot:foo` ❌ FAIL（slot 在 prefix 表里漏注册时走到 fallthrough 返回 `v-slot`）
- `preserves plain custom directive with no arg` ✅ 通过
- 全部 round-trip 用例 ❌ FAIL（依赖 extractProps 修复）

记下失败用例清单，写进 commit message。

- [ ] **Step 3：在 `editor.ts` 写 `formatDirectiveKey` helper + 重写 `extractProps`**

把 `editor.ts:118-141` 整段替换为：

```ts
/**
 * 把 Vue AST 的 DirectiveNode 还原为源码书写的 key。
 *
 * - `v-bind:src`       → `:src`
 * - `v-bind:src.sync`  → `:src.sync`
 * - `v-bind:[k]`       → `:[k]`     （动态 arg：用 [] 包回，isStatic=false 时）
 * - `v-bind:[k].sync`  → `:[k].sync`
 * - `v-on:click`       → `@click`
 * - `v-on:click.once`  → `@click.once`
 * - `v-on:[ev].once`   → `@[ev].once`
 * - `v-slot:foo`       → `v-slot:foo`
 * - `v-access:code`    → `v-access:code`
 * - `v-access:code.r`  → `v-access:code.r`
 * - `v-my-dir`         → `v-my-dir`
 *
 * 走 `DIRECTIVE_PREFIX` 拿前缀（`bind` → `:`，`on` → `@`，其它 → `v-<name>`）。
 * arg 通过 `d.arg` 拿到：静态直接拼 content；动态用 [] 包回 content。
 * modifiers 通过 `d.modifiers[].content` 拼 `.mod1.mod2`。
 *
 * 当 arg 不是 SimpleExpressionNode（理论上 Vue parser 不会产出这种情况，
 * 但 AST 类型允许 ExpressionNode = CompoundExpressionNode 等）时抛错，
 * 不静默丢数据。
 */
function formatDirectiveKey(d: DirectiveNode): string {
  const prefix = DIRECTIVE_PREFIX[d.name] ?? `v-${d.name}`;
  if (d.name === "else") return prefix; // v-else 不带 arg/modifier/value
  if (!d.arg) return prefix;
  if (!isSimpleExp(d.arg)) {
    throw new Error(
      `[vdi] unsupported directive arg in extractProps: ${d.name}`,
    );
  }
  const argStr = d.arg.isStatic ? d.arg.content : `[${d.arg.content}]`;
  const mods = d.modifiers.map((m) => `.${m.content}`).join("");
  return `${prefix}${argStr}${mods}`;
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
        const value = isSimpleExp(d.exp)
          ? d.exp.content
          : d.name === "else"
            ? ""
            : "";
        // `else` 没有 exp；其它非 simple exp（如复合表达式）取空串，
        // 因为 panel UI 的 PropEntry.value 是字符串字段，复杂表达式
        // 也无法在面板里直接编辑。
        return { key: formatDirectiveKey(d), value };
      }
      return null;
    })
    .filter((p): p is PropEntry => p !== null);
}
```

> 备注：原 `value` 表达式分支里 `isSimpleExp(d.exp) ? d.exp.content : ""` 已经在所有情况下做这件事（else 时 `d.exp` 是 undefined，content 是 `""`，已正确），但本次重写时显式把 `else` 走单独分支，行为等价。

- [ ] **Step 4：跑测试，确认全部通过**

```bash
cd packages/client && npx vitest run test/extract-props.test.ts --reporter=verbose
```

预期：所有 13 个用例 ✅ PASS。

- [ ] **Step 5：跑 client 包 typecheck 确认无类型错**

```bash
npx tsc -p packages/client/tsconfig.json
```

预期：无错误输出（`noEmit: true`，仅做类型检查）。

- [ ] **Step 6：提交**

```bash
git add packages/client/src/editor.ts packages/client/test/extract-props.test.ts
git commit -m "fix(client/editor): preserve directive arg + modifiers on extractProps

- v-access:code, v-on:click.prevent, v-bind:src.sync, v-bind:[k] 等
  指令在读取/写入时不再截断 arg 与 modifier。
- 抽出 formatDirectiveKey helper 统一序列化逻辑。
- 修复 v-slot:foo（DIRECTIVE_PREFIX 漏注册 slot）。
- 新增 test/extract-props.test.ts 覆盖 13 个用例（含 round-trip）。"
```

---

### Task 4：在 demo 中手动验证端到端

**Files:**
- Modify: `packages/demo/src/App.vue`（或 `packages/demo/src/*.vue` 任意一个有 v-access 的文件）—— 临时加一行用于手动验证，验证完可回退

> 备注：仓库内 `packages/demo/src/` 不一定有 v-access:code 的样例文件；按实际 demo 内容调整。如果 demo 里没有自定义指令，可以让用户在浏览器里随便找个真实项目的 .vue 文件来验证，**或者**在 demo 里临时加 `<div v-access:code="x">test</div>` 看属性面板里是否显示 `v-access:code` 与 `x`。

**Interfaces:**
- Consumes: `pnpm dev:demo`
- Produces: 浏览器 overlay 面板里点击元素后看到 `v-access:code = value`，修改后写回磁盘仍保持 `v-access:code` 不丢

- [ ] **Step 1：重建 client 包**

```bash
pnpm -C packages/client build
```

- [ ] **Step 2：把任务交给用户执行 `pnpm dev:demo`**（CLAUDE.md 约定「服务启动操作交由用户协作完成」）

向用户发出请求：

> 请在另一个终端运行 `pnpm dev:demo`，等浏览器打开 demo 页面后：
> 1. 在任意 .vue 文件里加 `<div v-access:code="value" />` 或 `<button @click.prevent="onClick">`
> 2. 打开浏览器 inspector（Alt+Shift+I）
> 3. 点击该元素，弹出属性面板
> 4. 确认面板里 key 列显示 `v-access:code`（不是 `v-access`），value 列显示 `value`
> 5. 修改 value 为别的内容，点保存；检查磁盘上 .vue 文件源码仍是 `v-access:code="新值"`

等用户回报。

- [ ] **Step 3：如发现问题（手动验证暴露的额外 bug），新增 task 处理**

如果用户报告问题，开新 Task 处理；不阻塞主修复的提交。

- [ ] **Step 4：清理 demo 临时修改（如有）**

如果 Task 4 改了 `packages/demo/src/*.vue` 加临时验证代码，确认行为正确后回退那些改动。

---

## Self-Review Checklist（执行者跑完所有 Task 后自查）

1. **Spec coverage**:
   - v-bind（静态 arg）→ 保留 ✓ Task 3
   - v-bind（动态 arg `[k]`）→ 保留 ✓ Task 3
   - v-bind.modifier（`.sync` / `.prop` / `.camel` / `.attr`）→ 保留 ✓ Task 3
   - v-on（静态 arg）→ 保留 ✓ Task 3
   - v-on（动态 arg `[event]`）→ 保留 ✓ Task 3
   - v-on.modifier（`.prevent` / `.stop` / `.once` / `.capture`）→ 保留 ✓ Task 3
   - 自定义指令带 arg（`v-access:code`）→ 保留 ✓ Task 3
   - 自定义指令带 modifier（`v-access:code.readonly`）→ 保留 ✓ Task 3
   - 自定义指令无 arg 无 modifier（`v-my-dir`）→ 保留 ✓ Task 3
   - v-slot:foo → 保留 ✓ Task 2 + Task 3
   - 已有用例（class / `:src` / `@click` / `v-if` / `v-else`）→ 保留 ✓ Task 3 测试覆盖

2. **Placeholder scan**: 已检查。每个代码块都有完整内容；无 TODO；无 "similar to"。

3. **Type consistency**:
   - `PropEntry { key: string; value: string }` 在所有 Task 中保持不变 ✓
   - `formatDirectiveKey(d: DirectiveNode): string` 在 Task 3 定义并被同 Task 使用 ✓
   - `getElementProps` / `editElementProps` 签名不变（Task 3 不动它们的对外签名）✓

4. **Round-trip**: Task 3 用 3 个 round-trip 用例覆盖 v-access:code / :[key].sync / @click.prevent 三类最常被截断的形态。

5. **CLAUDE.md constraints**:
   - 中文注释 ✓
   - `__vdi-` 前缀不变（本次未改 overlay）
   - 修改 client 源码后必须 rebuild ✓（Task 4 Step 1）
   - 服务启动交由用户 ✓（Task 4 Step 2）