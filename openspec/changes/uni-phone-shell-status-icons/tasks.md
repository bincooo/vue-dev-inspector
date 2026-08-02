## 1. 布局常量

- [x] 1.1 在 `phone-shell.ts` 常量区新增状态栏图标相关常量：`STATUS_BAR_H`（状态栏高度，与 notch 高度对齐）、`STATUS_TIME_FS`（时间字号）、`STATUS_TIME_RIGHT`（时间距 notch 右侧间距）、`STATUS_ICONS_LEFT`（图标组距 notch 左侧间距）、`STATUS_ICONS_RIGHT`（图标组距屏幕右侧间距）、信号格/wifi/电量各自尺寸常量

## 2. CSS 样式

- [x] 2.1 在 `buildCss()` 中新增 `[data-vdi-phone-status-time]` 样式：绝对定位、左侧布局、右对齐、字号 `px(STATUS_TIME_FS)`、垂直居中于 `px(STATUS_BAR_H)` 高度内、`z-index:56`、颜色 `#000`、`font-weight:600`
- [x] 2.2 新增 `[data-vdi-phone-status-icons]` 样式：绝对定位、右侧布局、flex 行排列、垂直居中、`z-index:56`、间距 `px(STATUS_ICONS_GAP)`
- [x] 2.3 新增信号格样式 `[data-vdi-phone-status-signal]`：4 个子 div 递增高度、圆角、黑色背景
- [x] 2.4 新增 wifi 图标样式 `[data-vdi-phone-status-wifi]`：内联 SVG 弧线、黑色填充
- [x] 2.5 新增电量图标样式 `[data-vdi-phone-status-battery]`：外壳圆角矩形 + 内填充（约 80%）+ 头部凸起

## 3. DOM 注入

- [x] 3.1 在 `buildPhoneShellScript()` 的 `frame.innerHTML` 字符串中追加状态栏 DOM：时间容器（含 "9:41" 文本）和图标容器（含信号格 4 个 div + wifi SVG + 电量 div 结构）
- [x] 3.2 确保状态栏 DOM 元素与 speaker/cam/notch 同级，位于 screen 之前

## 4. 构建与验证

- [x] 4.1 执行 `pnpm -C packages/uni build` 构建 uni 包
- [ ] 4.2 启动 uni-demo（`pnpm dev:uni`），确认状态栏图标在 notch 两侧正确显示
- [ ] 4.3 滚动页面确认状态栏图标不随内容滚动
- [x] 4.4 执行 `pnpm typecheck` 确认无类型错误
- [x] 4.5 执行 `pnpm run prettier` 格式化修改的代码
