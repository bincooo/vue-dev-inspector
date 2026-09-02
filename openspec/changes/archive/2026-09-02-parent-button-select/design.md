## Context

`packages/overlay/src/events.ts` 的 click 处理器中，`parentButton` 分支（L316-321）已检测到按钮命中，但函数体为空（TODO）。overlay 已有 `findInspectableElement`（从 `e.target` 向上找最近可审查元素），但父级按钮需要从 `state.selectedElement` 向上找父级，语义不同。

## Goals / Non-Goals

**Goals:**
- 点击父级按钮时从 `state.selectedElement` 向上遍历 DOM，找到最近带 `data-source-file` 属性的祖先元素并选中
- 复用已有的 `setSelectedElement` + `redrawSelection` 完成状态切换和 UI 更新

**Non-Goals:**
- 不实现父级按钮的长按/连续跳转（每次只跳一级）
- 不修改 `findInspectableElement` 的通用逻辑

## Decisions

### 从 `selectedElement.parentElement` 开始向上遍历

替代方案：复用 `findInspectableElement`。但 `findInspectableElement` 从传入的 `target` 自身开始检查，而父级按钮需要跳过当前选中元素，从其父级开始。写一个简单的 `while` 循环更清晰。

### 遍历条件与 `findInspectableElement` 一致

检查 `node.getAttribute(state.attrName)` 是否存在。遍历到 `document.documentElement` 停止。这与现有 `findInspectableElement` 的属性检查逻辑一致。

### 不单独抽取工具函数

仅 5-6 行代码，直接写在 click 处理器分支内。如果后续需要复用再抽取。

## Risks / Trade-offs

- [低风险] 若选中元素嵌套极深，遍历性能可忽略（DOM 层级通常 < 50）
