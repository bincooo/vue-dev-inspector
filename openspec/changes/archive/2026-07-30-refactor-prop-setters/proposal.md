## Why

「编辑属性」面板的 BoolSetter 当前用一个文本按钮显示 "true"/"false" 字样来切换布尔值，视觉上不像开关，与用户对布尔值的直觉（Switch 拨动控件）不符。同时，4 个内置 setter（TextSetter / CodeSetter / SelectSetter / BoolSetter）全部以内联对象字面量挤在 `prop-panel.ts` 的 35–158 行，使该文件长达 537 行，新增 setter 或修改现有 setter 时需要在单文件中上下翻找，不利于维护。

## What Changes

- **BoolSetter UI 改为 Switch 控件**：将当前的文本按钮（`__vdi-prop-bool-btn`）替换为滑轨 + 圆形拨钮的 Switch 拨动样式（类似 `a-switch`），值仍存储为字符串 `"true"`/`"false"`，点击拨动切换。
- **每个 setter 抽取到 `packages/overlay/src/setters/` 目录下的独立文件**：
  - `setters/text-setter.ts`
  - `setters/code-setter.ts`
  - `setters/select-setter.ts`
  - `setters/bool-setter.ts`
  - `setters/index.ts`（导出 `SetterDef` 类型 + `setters` 注册表 + 推断函数 `getSetters`/`inferDefaultSetter`）
- **`prop-panel.ts` 拆入 `packages/overlay/src/panel/` 目录**：原单文件按职责拆为 `panel/index.ts`（面板生命周期 + 提交）、`panel/render.ts`（列表渲染）、`panel/control.ts`（值控件管理），删除 `prop-panel.ts`，更新 `events.ts`/`menu.ts`/`attr-drawer.ts` 导入路径。
- **CSS 调整**：`overlay.css` 中 `.__vdi-prop-bool-*` 系列样式替换为 `.__vdi-prop-switch-*` Switch 样式；其余 setter 的 CSS 不动。
- 不改变 `ComponentAttr.setter` 类型契约，不改变 setter 推断规则，不改变 `PropEntry` 数据流。

## Capabilities

### New Capabilities
- `prop-panel-setters`: 属性编辑面板的值控件（setter）注册体系--setter 注册表结构、推断规则、BoolSetter 的 Switch 交互行为。

### Modified Capabilities
<!-- 无。现有 `attr-picker-drawer` spec 描述的是属性选择抽屉的交互，本次不改动其 requirement。 -->

## Impact

- **代码**：新增 `packages/overlay/src/setters/*.ts`（5 个文件）、新增 `packages/overlay/src/panel/*.ts`（3 个文件）、删除 `packages/overlay/src/prop-panel.ts`、`packages/overlay/src/overlay.css`（BoolSetter 样式替换）、`events.ts`/`menu.ts`/`attr-drawer.ts`（导入路径更新）。
- **构建**：`packages/overlay` 重建（`pnpm -C packages/overlay build`），Vite lib 模式 + `vite-plugin-singlefile` 会将所有子模块打进单个 IIFE，产物体积几乎不变。
- **下游**：core/uni 经 `loadOverlayScript()` 读取 `dist/overlay.iife.js`，文件结构变化对下游透明（IIFE 内联）。
- **行为**：BoolSetter 的交互从"点击文本按钮"变为"点击/拨动 Switch"，值语义不变（`"true"`/`"false"` 字符串）。
