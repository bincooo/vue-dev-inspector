## 1. 实现父级按钮点击逻辑

- [x] 1.1 在 `packages/overlay/src/events.ts` L320 的 TODO 处，从 `state.selectedElement.parentElement` 开始向上遍历 DOM，找到最近带 `state.attrName` 属性的祖先元素
- [x] 1.2 找到父级后调用 `setSelectedElement` + `redrawSelection` 完成选中态切换，并 `swallow(e)` + `return`
- [x] 1.3 若无父级可审查元素或无选中元素，直接 `return` 不做任何操作

## 2. 验证与格式化

- [x] 2.1 手动验证：选中一个嵌套组件 → 点击父级按钮 → 选中框跳到父级
- [x] 2.2 手动验证：选中最外层可审查元素 → 点击父级按钮 → 无效果
- [x] 2.3 手动验证：未选中任何元素 → 点击父级按钮 → 无效果
- [x] 2.4 运行 `pnpm run prettier` 格式化代码
