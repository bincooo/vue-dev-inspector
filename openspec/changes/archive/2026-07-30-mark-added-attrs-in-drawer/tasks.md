## 1. attr-drawer.ts 标记逻辑

- [x] 1.1 在 `buildAttrDrawer` 内新增闭包变量 `let currentFilter = ""`，`render(filter)` 改为写入 `currentFilter` 后执行渲染逻辑
- [x] 1.2 `searchInput.oninput` 改为先更新 `currentFilter` 再调 `render()`
- [x] 1.3 `render` 内构建属性行时，检查 `state.panelData.entries.some(e => e.key === attr.name)`，已存在则追加 `<span class="__vdi-attr-drawer-item-check">✓</span>`
- [x] 1.4 属性行 `onclick` 中，添加成功后调 `render(currentFilter)` 刷新整个列表（替代当前仅调 `rerenderPropList()` 的逻辑，两者都保留）

## 2. 样式

- [x] 2.1 在 `packages/overlay/src/overlay.css` 中新增 `.__vdi-attr-drawer-item-check` 样式：`margin-left: auto; color: #22c55e; font-size: 12px; flex-shrink: 0`

## 3. 构建与验证

- [x] 3.1 运行 `pnpm -C packages/overlay build` 重建 overlay 包
- [x] 3.2 启动 PC demo 验证：右键 antdv 组件 -> 编辑属性 -> 打开属性抽屉 -> 已添加属性显示 ✓
- [x] 3.3 验证抽屉内点击添加属性后，该行立即出现 ✓
- [x] 3.4 验证搜索过滤后 ✓ 标记保留
- [x] 3.5 验证点击已标记属性无操作（不重复添加）
- [x] 3.6 验证关闭抽屉再打开后 ✓ 标记根据当前 entries 重新同步
- [x] 3.7 运行 `pnpm typecheck` 确保类型安全
- [x] 3.8 运行 `pnpm run prettier` 格式化修改的代码
