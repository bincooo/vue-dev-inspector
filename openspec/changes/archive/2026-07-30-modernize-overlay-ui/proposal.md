## Why

overlay 当前的视觉风格停留在早期 Material/扁平风：`border-radius: 3px`、硬边框、重阴影、弱毛玻璃（blur 1-2px）、无 CSS 变量。作为开发工具悬浮在宿主页面上方，观感偏粗糙，与 2025 年主流 devtools（Vercel v0、Linear、Raycast）的圆角 + 柔阴影 + 层次感设计语言差距明显。

## What Changes

- **引入 CSS 设计令牌**：在 `overlay.css` 顶部以 `:root` 自定义属性集中定义圆角、阴影、颜色、过渡时长等令牌，全文件引用令牌而非硬编码值。
- **圆角现代化**：卡片/抽屉 `8px`，输入框/按钮 `6px`，小标签/徽章 `4px`（原全局 `3px`）。
- **阴影分层**：用 2-3 层叠加柔阴影替代单层重阴影（如 `0 4px 6px + 0 10px 24px`），营造层次感而非生硬投影。
- **毛玻璃增强**：遮罩 `backdrop-filter` 从 1-2px 提升到 6-8px，配合更低不透明度背景色，更接近现代毛玻璃效果。
- **按钮变体**：统一 primary（蓝实心）/ secondary（灰底）/ ghost（透明边框）/ danger（红实心）四种按钮风格，补充 hover/active 过渡。
- **过渡曲线**：全局过渡从线性 `0.12s` 升级为 `cubic-bezier(0.4, 0, 0.2, 1)` 0.18s，hover/active 补 `transform: scale(1.02)` 微缩放。
- **齿轮按钮**：hover 从仅改 opacity 改为 scale + 阴影增强 + opacity 渐变；补 `active: scale(0.95)` 按压反馈。
- **右键菜单**：圆角增至 `8px`、阴影分层、菜单项圆角 `4px` + hover 内缩 padding、分隔线改用更柔的渐变。
- **抽屉**：左上/左下圆角 `8px`（右侧贴边不圆角），搜索框圆角 `6px`，列表项 hover 圆角 `6px`。
- **滚动条**：自定义 `::-webkit-scrollbar` 细窄滚动条（6px 宽），与整体风格协调。
- **Toast**：圆角增至 `8px`，阴影分层，边框改用更柔和的左侧色条 + 微透明背景。

## Capabilities

### New Capabilities
<!-- 无新增能力 -- 纯视觉风格重构，行为不变 -->

### Modified Capabilities
<!-- 无 spec 级行为变更 -- skip_specs: true -->

## Impact

- **`packages/overlay/src/overlay.css`**：几乎全文重写样式值（圆角/阴影/过渡/颜色），但 CSS 选择器结构与 class 命名保持不变。
- **`packages/overlay/src/inspector.ts`**：齿轮按钮的内联 `opacity` 初始化可能需要移除（改由 CSS `:hover` 全权控制）。
- **无 JS 行为变更**：不修改任何事件处理、状态管理、DOM 结构或 API 调用。
- **无 spec 变更**：纯视觉重构，所有交互行为保持不变。
- **构建**：修改 `overlay.css` 后需重建 overlay 包 + 重启 demo。
