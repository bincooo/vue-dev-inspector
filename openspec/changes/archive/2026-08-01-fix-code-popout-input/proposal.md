## Why

CodeSetter 的浮动编辑窗口在宿主页面的 antdv 抽屉组件（`a-drawer`/`a-modal`）打开时无法接收键盘输入。根因是 antdv 的抽屉/模态框实现了 focus trap（焦点陷阱），会拦截键盘事件并强制将焦点拉回抽屉内部，导致 Monaco 编辑器无法获得键盘焦点。

## What Changes

- 浮动窗口 z-index 从 10001 提升到 99999，确保高于任何 antdv 组件的 z-index。
- 浮动窗口创建后显式调用 `editor.focus()` 抢占焦点。
- 浮动窗口 mask 添加 `onmousedown` 阻止默认行为，防止 antdv focus trap 在鼠标点击时抢回焦点。

## Capabilities

### New Capabilities
<!-- 无。 -->

### Modified Capabilities
<!-- 无。纯 bug 修复，不改变 spec 级行为。skip_specs: true。 -->

## Impact

- **代码**：`packages/overlay/src/setters/code-setter.ts`（z-index、focus 调用）、`packages/overlay/src/overlay.css`（z-index 提升）。
- **构建**：`packages/overlay` 重建。
- **行为**：浮动窗口在 antdv 抽屉下可正常输入。
