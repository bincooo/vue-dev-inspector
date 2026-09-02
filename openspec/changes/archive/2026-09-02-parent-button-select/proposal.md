## Why

`packages/overlay/src/events.ts:320` 处有一个 TODO：点击父级按钮（⏷）后应该选中当前选中组件的最近父级可审查元素。当前按钮已创建并定位，但点击后无任何响应——功能缺失。

## What Changes

- 在 `events.ts` 的 click 处理器中，当命中 `parentButton` 时，从 `state.selectedElement` 向上遍历 DOM，找到最近一个带 `data-source-file` 属性的祖先元素并选中它
- 使用已有的 `setSelectedElement` + `redrawSelection` 完成选中态切换
- 若当前无选中元素或无父级可审查元素，则忽略点击

## Capabilities

### New Capabilities

- `parent-select`: 点击父级按钮选中当前选中元素的最近父级可审查组件

### Modified Capabilities

（无）

## Impact

- 仅修改 `packages/overlay/src/events.ts` 的 click 处理器
- 无 API 变更，无依赖变化
