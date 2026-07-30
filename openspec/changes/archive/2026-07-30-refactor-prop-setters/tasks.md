## 1. 创建 setters/ 目录与各 setter 文件

- [x] 1.1 创建 `packages/overlay/src/setters/` 目录。从 `prop-panel.ts` 提取 `SetterDef` 接口，放入 `setters/index.ts`（或单独 `types.ts`，由实现时决定）。
- [x] 1.2 创建 `setters/text-setter.ts`，导出 `textSetter: SetterDef`，将 prop-panel.ts 中 TextSetter 的 `build` 逻辑原样搬入。
- [x] 1.3 创建 `setters/code-setter.ts`，导出 `codeSetter: SetterDef`，搬入 CodeSetter 的 `build` 逻辑（含 Monaco 懒加载 + `__vdiCleanup`）。
- [x] 1.4 创建 `setters/select-setter.ts`，导出 `selectSetter: SetterDef`，搬入 SelectSetter 的 `build` 逻辑。
- [x] 1.5 创建 `setters/bool-setter.ts`，导出 `boolSetter: SetterDef`，先原样搬入当前 BoolSetter 的 button 实现（下一步再改 Switch）。
- [x] 1.6 创建 `setters/index.ts`，聚合 `setters` 注册表（从各文件导入），搬入 `getSetters()` 与 `inferDefaultSetter()`，统一导出 `SetterDef` 类型 + `setters` + 两个推断函数。

## 2. 精简 prop-panel.ts

- [x] 2.1 从 `prop-panel.ts` 删除内联的 `SetterDef` 接口、`setters` 注册表、`getSetters()`、`inferDefaultSetter()`（共约 120 行）。
- [x] 2.2 在 `prop-panel.ts` 顶部添加 `import { setters, getSetters, inferDefaultSetter } from "./setters"`（类型按需导入）。
- [x] 2.3 确认 `prop-panel.ts` 中 `getEntrySetter`、`createValueControl`、`makeSetterSwitcher` 等函数正确引用导入的 `setters`/`getSetters`/`inferDefaultSetter`，编译通过。

## 3. BoolSetter 改为 Switch 拨动控件

- [x] 3.1 在 `setters/bool-setter.ts` 中将 `build()` 返回的 DOM 从 `<div class="__vdi-prop-bool-wrap"><button>` 改为 `<div class="__vdi-prop-switch"><div class="__vdi-prop-switch-track"><div class="__vdi-prop-switch-knob">`。
- [x] 3.2 `sync()` 逻辑改为切换 track 的 `--on` class（而非 button 的 `--on` class + textContent），点击仍翻转 `entry.value`（`"true"` <-> `"false"`）。

## 4. CSS 调整

- [x] 4.1 从 `overlay.css` 删除 `.__vdi-prop-bool-wrap`、`.__vdi-prop-bool-btn`、`.__vdi-prop-bool-btn--on`、`.__vdi-prop-bool-btn:hover` 四条规则。
- [x] 4.2 在 `overlay.css` 添加 `.__vdi-prop-switch`（flex 容器）、`.__vdi-prop-switch-track`（pill 滑轨，36×20px，关态 `#e2e8f0`，`transition: background 0.2s`）、`.__vdi-prop-switch-track--on`（开态 `#10b981`）、`.__vdi-prop-switch-knob`（圆形拨钮 16×16px，`transform` + `transition: transform 0.2s`）样式。

## 5. 将 prop-panel.ts 抽取到 panel/ 目录

- [x] 5.1 创建 `panel/control.ts`，搬入值控件管理：`entrySetter` WeakMap、`getEntrySetter`、`makeSetterSwitcher`、`createValueControl`、`cleanupValueControl`。从 `../setters` 导入注册表与推断函数。
- [x] 5.2 创建 `panel/render.ts`，搬入列表渲染：`findAttrByName`（内部）、`makePropRow`（内部）、`renderList`（导出）。从 `./control` 导入值控件函数。
- [x] 5.3 创建 `panel/index.ts`，搬入面板生命周期：`currentListEl`、`openPanel`、`closePanel`、`rerenderPropList`、`submit`。从 `./render` 导入 `renderList`，从 `./control` 导入 `cleanupValueControl`。
- [x] 5.4 删除 `prop-panel.ts`，更新 `events.ts`、`menu.ts`、`attr-drawer.ts` 的导入路径从 `./prop-panel` 改为 `./panel`。

## 6. 构建与验证

- [x] 6.1 运行 `pnpm -C packages/overlay build` 构建 IIFE，确认无报错。
- [x] 6.2 运行 `pnpm typecheck` 确认类型通过。
- [x] 6.3 运行 `pnpm lint` 确认 ESLint 通过。
- [ ] 6.4 启动 PC demo（由用户执行），在「编辑属性」面板中对布尔属性验证：Switch 拨动控件正确显示开/关状态、点击切换值、setter 间切换后切回 BoolSetter 仍正确反映当前值。
- [x] 6.5 运行 `pnpm run prettier` 格式化改动代码。
