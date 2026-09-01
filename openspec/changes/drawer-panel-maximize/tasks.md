## 1. CSS 样式添加

- [x] 1.1 在 `overlay.css` 中添加 `__vdi-maximize-btn` 最大化按钮样式（标题栏内，右侧对齐，hover 高亮）
- [x] 1.2 添加 `__vdi-maximize-btn` 的 hover/active 状态样式
- [x] 1.3 添加 `__vdi-code-block-header` 容器样式（flex 布局，标题与按钮同行）

## 2. DOM 结构改造

- [x] 2.1 修改 `buildBlockPanel` 函数，在 `titleEl` 外包裹 `__vdi-code-block-header` 容器
- [x] 2.2 在 `__vdi-code-block-header` 内添加最大化按钮元素（`__vdi-maximize-btn`，初始图标 ⛶）
- [x] 2.3 更新 `BlockPanel` 接口，添加 `maximizeBtn` 和 `isCollapsed` 字段（用于子节点面板）

## 3. 最大化/还原逻辑实现

- [x] 3.1 在 `openCodeDrawer` 作用域内添加 `maximizedPanel: BlockPanel | null` 状态变量
- [x] 3.2 实现 `maximizePanel(panel: BlockPanel)` 函数：隐藏其他面板，当前面板 flex: 1，更新按钮图标为 ⤡
- [x] 3.3 实现 `restorePanel()` 函数：恢复所有面板默认布局，更新按钮图标为 ⛶，清空 `maximizedPanel`
- [x] 3.4 为每个面板的最大化按钮绑定点击事件：若当前已最大化则还原，否则最大化

## 4. 子节点面板特殊处理

- [x] 4.1 最大化子节点面板时，若处于折叠态则自动展开（调用 `loadChildText` 或直接显示 editorWrap）
- [x] 4.2 记录子节点面板最大化前的 `isCollapsed` 状态
- [x] 4.3 还原子节点面板时，若之前是折叠态则调用 `collapseChildText` 恢复折叠

## 5. Monaco 编辑器 layout 刷新

- [x] 5.1 最大化/还原后调用 `requestAnimationFrame` + `editor.layout()` 刷新 Monaco 渲染

## 6. 关闭抽屉自动还原

- [x] 6.1 在 `closeCodeDrawer` 函数开头调用 `restorePanel()` 确保最大化状态被清除

## 7. 样式微调与测试

- [ ] 7.1 测试最大化/还原切换流畅性，无闪烁
- [ ] 7.2 测试 splitter 拖动与最大化状态的交互（最大化时禁用 splitter）
- [ ] 7.3 测试关闭抽屉后重新打开，最大化状态已清除
- [x] 7.4 运行 `pnpm run prettier` 格式化代码
