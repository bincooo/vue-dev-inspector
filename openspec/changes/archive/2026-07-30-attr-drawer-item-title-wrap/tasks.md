## 1. attr-drawer.ts 行结构调整

- [x] 1.1 在 `render` 函数的属性行构建中，新增 `__vdi-attr-drawer-item-title` 容器 div，将 `nameEl` 和 `labelEl` 包裹其中后再 append 到 `row`
- [x] 1.2 无 `label` 时 title 容器内仅含 `nameEl`，结构保持一致

## 2. overlay.css 样式调整

- [x] 2.1 新增 `.__vdi-attr-drawer-item-title` 样式：`display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0`
- [x] 2.2 `.__vdi-attr-drawer-item-label` 去掉 `flex: 1`（弹性空间由 title 容器接管）

## 3. 构建与验证

- [x] 3.1 运行 `pnpm -C packages/overlay build` 重建 overlay 包
- [x] 3.2 启动 PC demo 验证：属性抽屉中 name 在上、label 在下，value 和 ✓ 在右侧
- [x] 3.3 验证无 label 属性的行布局正常（仅 name，不塌陷）
- [x] 3.4 运行 `pnpm typecheck` 确保类型安全
- [x] 3.5 运行 `pnpm run prettier` 格式化修改的代码
