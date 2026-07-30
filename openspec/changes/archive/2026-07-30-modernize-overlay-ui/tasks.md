## 1. 设计令牌

- [x] 1.1 在 `overlay.css` 顶部 `:root` 块中定义全部设计令牌（圆角 `--vdi-radius-*`、阴影 `--vdi-shadow-*`、过渡 `--vdi-ease`/`--vdi-duration`、主色 `--vdi-primary*`、毛玻璃 `--vdi-blur-*`）
- [x] 1.2 将文件内所有硬编码的 `border-radius`/`box-shadow`/`transition` 值替换为 `var(--vdi-*)` 引用

## 2. 遮罩与面板

- [x] 2.1 `.__vdi-backdrop` / `.__vdi-panel-mask` / `.__vdi-attr-backdrop`：`backdrop-filter` 提升到 `var(--vdi-blur-md)`（6px），降低背景不透明度
- [x] 2.2 `.__vdi-prop-card`：圆角改 `var(--vdi-radius-lg)`，阴影改 `var(--vdi-shadow-xl)`
- [x] 2.3 `.__vdi-prop-header` / `.__vdi-prop-footer`：padding 微调，border 颜色用更柔的 `#f1f5f9`

## 3. 右键菜单

- [x] 3.1 `.__vdi-context-menu`：圆角改 `var(--vdi-radius-lg)`，阴影改 `var(--vdi-shadow-md)`，padding 增至 `8px 0`
- [x] 3.2 `.__vdi-menu-item`：补 `border-radius: var(--vdi-radius-sm)` + `margin: 0 4px`，hover 圆角内缩
- [x] 3.3 `.__vdi-menu-title`：分隔线改用渐变 `border-bottom` 或更柔的颜色

## 4. 抽屉（组件抽屉 / 代码抽屉 / 属性抽屉）

- [x] 4.1 三个抽屉容器（`.__vdi-drawer` / `.__vdi-code-drawer` / `.__vdi-attr-drawer`）：补 `border-radius: var(--vdi-radius-lg) 0 0 var(--vdi-radius-lg)`（左上+左下圆角），阴影改 `var(--vdi-shadow-lg)`
- [x] 4.2 搜索框 `.__vdi-drawer-search-input` / `.__vdi-attr-drawer-search-input`：圆角改 `var(--vdi-radius-md)`
- [x] 4.3 列表项 `.__vdi-drawer-item` / `.__vdi-attr-drawer-item`：hover 圆角改 `var(--vdi-radius-md)`，补 `transition: all var(--vdi-duration) var(--vdi-ease)`
- [x] 4.4 抽屉 tab（`.__vdi-drawer-tab`）：active 态圆角改 `var(--vdi-radius-md)`，hover/active 过渡用 `var(--vdi-ease)`
- [x] 4.5 `.__vdi-drawer-item-icon`：圆角改 `var(--vdi-radius-md)`，border 颜色柔化

## 5. 按钮

- [x] 5.1 统一 primary 按钮风格：`.__vdi-save-btn` / `.__vdi-add-btn` / `.__vdi-code-save-btn` -- 圆角 `var(--vdi-radius-md)`，hover 补 `transform: translateY(-1px)` + `--vdi-shadow-sm`
- [x] 5.2 统一 secondary 按钮风格：`.__vdi-attr-btn` / `.__vdi-code-edit-btn` / `.__vdi-code-cancel-btn` -- 圆角 `var(--vdi-radius-md)`，hover 同上
- [x] 5.3 `.__vdi-close-btn`（ghost）：hover 背景改 `#f1f5f9`，圆角 `var(--vdi-radius-sm)`
- [x] 5.4 `.__vdi-delete-btn` / `.__vdi-copy-btn` / `.__vdi-tool-btn`（action btn）：圆角改 `var(--vdi-radius-sm)`，hover 补 `transform: scale(1.1)`
- [x] 5.5 `.__vdi-insert-btn`：保持圆形，hover 补 `transform: scale(1.15)` + 过渡曲线

## 6. 齿轮按钮迁移

- [x] 6.1 `.__vdi-gear-btn` CSS：设 `opacity: 0.7` 默认值，`:hover` 设 `opacity: 1; transform: scale(1.1)`，`:active` 设 `transform: scale(0.95)`，过渡用 `var(--vdi-ease)`
- [x] 6.2 `events.ts`：删除 `gearButton.style = "opacity: 0.7;transform: scale(1)"` 及 `onmouseenter`/`onmouseleave` 内联赋值（保留 `onclick` 和 `display` 切换）

## 7. 输入框与表单

- [x] 7.1 `.__vdi-prop-input` / `.__vdi-drawer-search-input` / `.__vdi-attr-drawer-search-input`：圆角改 `var(--vdi-radius-md)`，focus 阴影柔化
- [x] 7.2 `.__vdi-prop-select`：圆角 `var(--vdi-radius-md)`

## 8. Toast

- [x] 8.1 `.__vdi-toast`：圆角改 `var(--vdi-radius-lg)`，阴影改 `var(--vdi-shadow-lg)`

## 9. 滚动条

- [x] 9.1 为 `.__vdi-prop-body` / `.__vdi-drawer-list` / `.__vdi-attr-drawer-list` / `.__vdi-drawer-tabs` 添加 `::-webkit-scrollbar` 细窄样式（6px 宽，灰色圆角 thumb，透明 track）
- [x] 9.2 补 Firefox 回退：`scrollbar-width: thin; scrollbar-color: #cbd5e1 transparent;`

## 10. 过渡曲线全局统一

- [x] 10.1 将所有 `transition: ... 0.12s` / `0.2s ease-out` 等替换为 `transition: ... var(--vdi-duration) var(--vdi-ease)`

## 11. 构建与验证

- [x] 11.1 重建 overlay 包（`pnpm -C packages/overlay build`）
- [x] 11.2 重建 core 包（`pnpm -C packages/core build`，cp overlay.iife.js）
- [x] 11.3 启动 PC demo 验证视觉：齿轮按钮 hover / 右键菜单 / 编辑属性面板 / 组件抽屉 / 属性抽屉 / 代码抽屉 / Toast
- [x] 11.4 运行 `pnpm typecheck` 确保无类型错误
- [x] 11.5 运行 `pnpm run prettier` 格式化
