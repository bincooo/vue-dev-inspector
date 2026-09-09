## Context

属性编辑面板的写入路径 `editElementProps`（`packages/client/src/editor.ts`）当前用字面拼接 `${x.k}="${x.v}"` 把编辑框提交的值包进双引号。当值内含 `"`（典型如 `:options="getDictOptions("wms")"`）时，第一个内嵌 `"` 让属性提前闭合，写盘 SFC 语法损坏、Vue 编译报错、HMR 中断。读取端 `extractProps` 取 AST 的 `value.content` / `exp.content`，经实测 `@vue/compiler-core@3.5.38` 的 `baseParse` 已在解析阶段把 `&quot;` / `&apos;` / `&amp;` 解码进 `content`，故读取端天然得到裸值，无需改动。

约束（见 CLAUDE.md 既有 invariant）：`editElementProps` 在 `[tagNameEnd, openTagEnd)` 上做原子替换；当 `openTagEnd === tagNameEnd`（自闭合标签无现有属性）时必须用 `prependRight` 而非 `overwrite`（MagicString 不允许 overwrite 零长度区间）；`attrs` 为空且区间非空时用 `remove`。本次只改属性串的生成，不改区间操作策略，这些 invariant 保持不变。

## Goals / Non-Goals

**Goals:**
- 写回 SFC 的属性值在含 `"` / `'` 时模板语法合法，Vue 编译器不报错。
- 同一值经「写回 → 再读出」往返后，编辑框显示与用户原始输入一致。
- 改动收敛在 `editElementProps` 的属性串生成段，不扩散到其他编辑函数。

**Non-Goals:**
- 不做 JS 表达式合法性校验（不引入 parser）。
- 不改 `PropEntry` 数据结构、不改 overlay 前端。
- 不修复已被旧逻辑写坏的历史源码。
- 不处理 `<script>` / `<style>` 块内引号场景。

## Decisions

### Decision 1: 写入端 clamp 引号策略（三档）

按值内容分三档选择包裹引号：

| 值含 `"`? | 值含 `'`? | 包裹 | 转义 |
|---|---|---|---|
| 否 | — | `"` | 无 |
| 是 | 否 | `'` | 无 |
| 是 | 是 | `"` | 值内 `"` → `&quot;` |

**Why not「恒用双引号 + 内部 `"` 全转 `&quot;`」**（单档策略）：对最常见的「不含 `"`」值（绝大多数属性）会无谓产生与旧写法不同的产出，放大 diff、扰动 git 历史。clamp 策略让无 `"` 值保持双引号零转义，与现状一致；只有真正含 `"` 时才切档，最小化改动面。

**Why not「恒用单引号包裹」**：单引号在 Vue 模板属性中虽合法但与项目既有双引号风格冲突，会让整个文件的属性引号风格分裂，且单引号包裹仍无法处理「值同时含 `"` 和 `'`」的场景。

**第三档为何用 `&quot;` 而非 `&apos;`**：第三档值已含 `'`，若转义 `'` 为 `&apos;` 则需用单引号包裹，但值还含 `"` 仍需处理；双向转义更复杂。用双引号包裹 + 只转义内部 `"` 为 `&quot;` 是单向的、最小的合法化操作，且 `&quot;` 是 Vue 模板属性中标准的合法实体。

### Decision 2: 抽出 `quoteAttrValue(v): string` helper

把引号选择 + 转义封装成独立纯函数，替换现有字面拼接。返回值形如 `"v"` / `'v'` / `"a&quot;b'c"`（含外层引号）；调用处负责拼 ` ${k}${quote}`。

**Why**：使策略可单测、可复用（未来若 `insertComponent` 等也需包裹属性值可直接调用），且让 `editElementProps` 主体保持聚焦区间操作。helper 内聚「值 → 合法属性值串」这一单一职责。

**为什么不改读取端**：已实测（见下「验证依据」）`baseParse` 对 `&quot;` / `&apos;` / `&amp;` 均解码进 `content`，读取端已天然对称。在读取端再解一次既冗余又会与 compiler 的解码叠加产生双重解码风险。

### Decision 3: 空值属性短路

`value === ''` 时渲染为无值布尔属性（`disabled`），不调用 `quoteAttrValue`、不附加 `=""`。与现有行为一致，避免给布尔属性强加空串引号。

## 验证依据（实测，非推测）

用 `packages/examples/pc` 的 `@vue/compiler-core@3.5.38` 实测 `baseParse` 对各引号/实体形态的 `content`：

| 源码书写 | `exp.content` / `value.content` |
|---|---|
| `:options="getDictOptions(&quot;wms&quot;)"` | `getDictOptions("wms")` |
| `:options='getDictOptions("wms")'` | `getDictOptions("wms")` |
| `:options="getDictOptions('wms')"` | `getDictOptions('wms')` |
| `label="a&quot;b"` | `a"b` |
| `label="a&apos;b"` | `a'b` |
| `label="a&amp;b"` | `a&b` |

结论：读取端 `content` 已是裸值，clamp 写回后往返保真成立。

## Risks / Trade-offs

- **[值含反引号 `` ` `` 但无 `"`/`'`]** → clamp 第一档双引号包裹。反引号在双引号属性值内合法，不触发 `SyntaxError`（实测 `:class="`x`"` 解析正常）。无额外处理。
- **[值含换行/多行表达式]** → clamp 第一/二档正常包裹，多行在双引号属性值内合法（实测 `:options="fn(\n  'a'\n)"` 解析正常）。第三档换行不转义，保留原样。
- **[第三方组件 `inheritAttrs:false` + fallthrough 失效]** → 与本 change 无关，由既有 `wrapComponents` 机制处理，不在本次 scope。
- **[历史已损坏文件]** → 本 change 不修复已写坏的源码，只保证此后不再产生新损坏。若需清理历史损坏，另立 change。
- **[clamp 与人工手写风格不一致]** → 人工写的 `&quot;` 会被读成裸 `"` 再按 clamp 重写，可能把源码里手写的 `&quot;` 形态改成 `'...'` 形态。这是可接受的：值语义不变，且 clamp 产出的是合法且更可读的形态。
