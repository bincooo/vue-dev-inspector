## Context

`packages/overlay/src/prop-panel.ts` 当前在一个 537 行的单文件中内联定义了 4 个 setter（TextSetter / CodeSetter / SelectSetter / BoolSetter）及推断函数。BoolSetter 用文本按钮显示 "true"/"false" 切换。overlay 构建为 Vite lib + `vite-plugin-singlefile` 单 IIFE，子目录结构对产物透明。见 `proposal.md` 了解动机。

## Goals / Non-Goals

**Goals:**
- BoolSetter 改为 Switch 拨动控件，视觉上符合布尔值直觉。
- 4 个 setter 各自独立文件（`setters/`），面板本体拆入 `panel/` 目录（`index.ts` / `render.ts` / `control.ts`）。
- 保持 setter 推断规则、值语义（字符串 `"true"`/`"false"`）、`PropEntry` 数据流不变。

**Non-Goals:**
- 不改动 TextSetter / CodeSetter / SelectSetter 的 UI 与行为。
- 不改动 `ComponentAttr.setter` 类型契约。
- 不改动面板交互逻辑（openPanel / closePanel / renderList / submit 的行为不变，仅文件位置变）。
- 不引入虚拟列表或搜索过滤。

## Decisions

### D1: 文件拆分边界 -- 注册表 + 推断移入 `setters/`，面板拆入 `panel/`

原 `prop-panel.ts` 同时承担面板生命周期、列表渲染、值控件管理三职责。拆为两个目录：

**`setters/`** -- setter 注册表 + 推断（自包含，不依赖面板）：
`SetterDef` 接口、`setters` 注册表、`getSetters()`、`inferDefaultSetter()`、各 setter 的 `build` 实现。

**`panel/`** -- 面板本体（消费者）：

| `panel/control.ts` | `panel/render.ts` | `panel/index.ts` |
|---|---|---|
| `entrySetter` WeakMap | `findAttrByName`（内部） | `currentListEl` |
| `getEntrySetter()` | `makePropRow`（内部） | `openPanel()` / `closePanel()` |
| `makeSetterSwitcher()` | `renderList`（导出） | `rerenderPropList()` |
| `createValueControl()` | | `submit()` |
| `cleanupValueControl()` | | |

依赖方向（无循环）：`index.ts` → `render.ts` → `control.ts` → `../setters`；`index.ts` → `control.ts`；`render.ts` → `../state`。

**备选**：把 `createValueControl` / `makeSetterSwitcher` 也移入 `setters/`。**否决**：这两个函数操作 DOM 替换与 `WeakMap` 状态，与面板渲染紧耦合，移入 setter 模块会引入循环依赖。

### D2: `setters/index.ts` 统一导出

```
setters/
├── index.ts          # 导出 SetterDef + setters 注册表 + getSetters + inferDefaultSetter
├── text-setter.ts    # export const textSetter: SetterDef
├── code-setter.ts    # export const codeSetter: SetterDef
├── select-setter.ts  # export const selectSetter: SetterDef
└── bool-setter.ts    # export const boolSetter: SetterDef（Switch UI）
```

每个 setter 文件导出一个 `SetterDef` 常量，`index.ts` 聚合为注册表并导出推断函数。`panel/control.ts` 从 `../setters` 导入注册表与推断函数。

### D3: Switch 控件 DOM 结构与 CSS

DOM：
```html
<div class="__vdi-prop-switch">
  <div class="__vdi-prop-switch-track">
    <div class="__vdi-prop-switch-knob"></div>
  </div>
</div>
```

- `.__vdi-prop-switch`：flex 容器，点击触发切换。
- `.__vdi-prop-switch-track`：pill 形滑轨，`width:36px;height:20px;border-radius:10px`。关态灰底 `#e2e8f0`，开态绿底 `#10b981`（与原 `--on` 色一致），`transition: background 0.2s`。
- `.__vdi-prop-switch-knob`：圆形拨钮，`width:16px;height:16px;border-radius:50%;background:#fff`。关态 `transform: translateX(2px)`，开态 `transform: translateX(18px)`，`transition: transform 0.2s`。
- 开态通过在 track 上加 `--on` class 切换。

**备选**：用 `<input type="checkbox">` + `appearance:none` 自定义。**否决**：overlay IIFE 无需表单语义，div 方案更直观且无浏览器默认样式干扰。

### D4: BoolSetter build 逻辑保持不变，仅替换 DOM 与 CSS

`build(entry)` 仍创建容器、读取 `entry.value === "true"` 初始化状态、点击时翻转 `entry.value`。唯一变化：返回的 DOM 从 `<div class="__vdi-prop-bool-wrap"><button>` 变为 `<div class="__vdi-prop-switch"><div class="__vdi-prop-switch-track"><div class="__vdi-prop-switch-knob">`。

## Risks / Trade-offs

- **[overlay 重建必须重启 demo]** overlay 构建为单 IIFE，core/uni 启动时一次性读取 `dist/overlay.iife.js`。修改 setter 源码后必须 `pnpm -C packages/overlay build` + 重启 demo，否则旧 IIFE 驻留。**缓解**：tasks 中显式包含 overlay 重建步骤。
- **[Switch 尺寸与属性行高度对齐]** 属性行内 key 输入 + = + setter 切换 + value 控件水平排列，Switch 高度（20px）需与 input 高度（~30px）视觉协调。**缓解**：Switch 容器 `align-items:center`，实际拨动区域 36×20px 居中于行内。
- **[CSS 旧类名残留]** 原 `.__vdi-prop-bool-wrap` / `.__vdi-prop-bool-btn` / `.__vdi-prop-bool-btn--on` 需从 `overlay.css` 删除，避免死代码。**缓解**：tasks 中包含 CSS 清理步骤。
