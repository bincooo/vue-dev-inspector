## Why

phone-shell 虚拟 iPhone 外壳目前有刘海、听筒、摄像头、侧边按钮和 Home bar，但顶部状态栏区域是空的——没有时间、信号、电量等图标。这让虚拟机外观缺少真实感，开发者在 h5 dev 模式下调试 uni 应用时，无法直观感受 navbar 与状态栏的视觉关系。

## What Changes

- 在 phone-shell 的 `buildCss()` 中新增状态栏图标的 CSS 样式（时间文字、信号格、wifi 图标、电量图标）。
- 在 `buildPhoneShellScript()` 的 IIFE 中，向 frame 注入状态栏 DOM 元素，位于 notch 同层、screen 之上。
- 时间显示使用经典 "9:41"（Apple 发布会标准时间），纯静态展示，不实时更新。
- 信号格（4 格递增）、wifi 弧线、电量图标（约 80% 电量）均用纯 CSS / inline SVG 绘制，不依赖外部资源。
- 状态栏图标 z-index 介于 notch（55）与 screen（50）之间，挂在 frame 上（非 screen 内），不随页面滚动。
- 图标颜色默认深色（适配浅色 navbar），后续可考虑根据 navbar 背景色自适应。

## Capabilities

### New Capabilities

- `phone-shell-status-bar`: phone-shell 虚拟 iPhone 状态栏假图标（时间、信号、wifi、电量），仅 dev + h5 + phoneShell 开启时生效。

### Modified Capabilities

（无——这是 phone-shell 的视觉增强，不改变已有行为契约。）

## Impact

- **代码**：`packages/uni/src/phone-shell.ts` — `buildCss()` 新增图标样式，`buildPhoneShellScript()` 新增 DOM 注入。
- **依赖**：无新增依赖，纯 CSS + inline SVG。
- **产物**：仅影响 dev 模式 h5 注入的 IIFE，不影响编译产物或运行时包。
- **兼容性**：无破坏性变更；phoneShell 关闭时完全不注入状态栏图标。
