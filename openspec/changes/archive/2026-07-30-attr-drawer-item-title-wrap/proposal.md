## Why

属性抽屉中属性行的 `name` 和 `label` 当前水平排列（`flex` 行内），当 `label` 较长时挤压 `value` 和 ✓ 的空间，信息密度低且视觉层次不够清晰。将 `name` 和 `label` 包裹进一个上下布局的容器，可以让属性名和标签形成主次关系，行内空间更紧凑。

## What Changes

- 在 `attr-drawer.ts` 中，将 `nameEl` 和 `labelEl` 包裹进一个 `__vdi-attr-drawer-item-title` 容器 div，该容器成为行的第一个子元素。
- 在 `overlay.css` 中新增 `.__vdi-attr-drawer-item-title` 样式：`display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0`，使 name 在上、label 在下。
- `.__vdi-attr-drawer-item-label` 去掉 `flex: 1`（由外层 title 容器占据弹性空间）。
- 无 label 时 title 容器内只有 name，布局不受影响。

## Capabilities

### New Capabilities
<!-- 无 -->

### Modified Capabilities
<!-- 纯样式/结构调整，无行为变化，skip_specs: true -->

## Impact

- **`@vue-dev-inspector/overlay`**：`attr-drawer.ts` 行构建逻辑调整（name + label 包裹进 title 容器）；`overlay.css` 新增 title 容器样式 + 调整 label 样式。改动仅限 overlay 包内部。
- **构建**：修改 `overlay/src/*` 后需重建 overlay 并重启 demo。
