## Why

属性编辑面板把编辑框内容原样拼回 `attr="value"`，对含双引号的 v-bind 表达式（如 `:options="getDictOptions("wms_stock_in_order_status")"`）会让模板属性在第一个内嵌 `"` 处提前闭合，写盘后 SFC 语法损坏、Vue 编译器报错、HMR 中断。用户在属性输入框里输入任何含 `"` 的 JS 表达式都会触发此问题，是该能力的一个结构性缺陷，现在修是因为它直接阻断「在属性面板编辑带字典/枚举参数的组件」这一高频场景。

## What Changes

- **写入端智能选引号（clamp 策略）**：`editElementProps` 写属性值时不再恒用双引号包裹，改为按值内容选择：不含 `"` → 双引号（保持现有风格，最小 diff）；含 `"` 但不含 `'` → 单引号；`"`、`'` 都含 → 双引号包裹且把内部 `"` 转成 `&quot;`（Vue 模板属性中合法实体，解析后等价 `"`）。
- **抽出 `quoteAttrValue(v)` helper**：封装上述引号选择 + 必要转义，替换 `editor.ts` 中 `${x.k}="${x.v}"` 字面拼接。空值属性（`x.v === ''`）仍渲染为无值布尔属性，不受影响。
- **读取链路不改动**：`extractProps` 现有取 `value.content` / `exp.content` 的行为保持不变——已实测确认 `@vue/compiler-core@3.5.38` 在 `baseParse` 解析阶段把源码中的 `&quot;` / `&apos;` / `&amp;` 解码进 `content`，编辑框天然显示裸值，写回再包裹，两端对称。无需在 `extractProps` 里再做一次手动实体解码。
- **非目标**：不做 JS 表达式合法性校验（不引入 parser）；不改变 `PropEntry` 数据结构；不处理 `<script>` / `<style>` 块内更深层的引号场景；不实现「引号风格可配置」。

## Capabilities

### New Capabilities

- `attr-value-roundtrip`: 通过属性编辑面板读写的属性值，在含引号（`"` / `'`）或 HTML 实体时，写回 SFC 源码后模板语法不损坏，且回读编辑框显示与用户原始输入一致（往返保真）。

### Modified Capabilities

<!-- 无。现有 specs（edit-history / overlay-focus-guard / parent-select / portal-inspect-fix）均不涉及属性值引号语义，本次不改其 requirements。 -->

## Impact

- **代码**：`packages/client/src/editor.ts` —— `editElementProps` 的属性拼接段 + 新增 `quoteAttrValue` helper。`extractProps` / `directiveValue` 不改动。
- **类型**：`PropEntry` / `ElementProps` 结构不变。
- **overlay**：`packages/overlay/src/escape.ts`（仅转义 `&<>`，用于 element-content，非属性值）与 `setters/code-setter.ts`（显示/提交裸值）均不改动——前端继续只管「值是什么」，引号包裹由服务端负责。
- **其他编辑函数**：`insertComponent` / `moveElement` / `updateChildText` / `updateSfcBlock` 均不涉及用户提交的属性值拼接，不受影响。
- **历史损坏文件**：本 change 不修复已被旧逻辑写坏的源码，只保证此后编辑不再产生新损坏。
- **依赖**：无新增依赖；`@vue/compiler-core` 的实体解码行为是被依赖的既有事实，本次只是显式依赖它做读取端解码。
