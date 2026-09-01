## Why

在「编辑代码」抽屉面板中，Script、CSS、子节点三个编辑区共享纵向空间。当用户专注于编辑其中一个块时（尤其是子节点文本，固定 300px 高度），可用编辑面积有限，需要频繁滚动。添加最大化按钮可以让用户临时放大某个编辑区，提升代码编辑体验。

## What Changes

- 在每个块面板（Script / CSS / 子节点）的标题栏右上角添加「最大化」按钮（⛶ 或 ⤢ 图标）
- 点击最大化按钮后：
  - 隐藏其他两个块面板的 DOM（`display: none`）
  - 当前面板占据抽屉 body 的全部高度
  - 按钮变为「还原」图标（⤡ 或 ⏲），点击后恢复三块分屏布局
- 最大化状态不持久化（关闭抽屉自动还原）

## Capabilities

### New Capabilities
- `drawer-panel-maximize`: 编辑代码抽屉中单个块面板的最大化/还原切换功能

### Modified Capabilities
（无）

## Impact

- **Affected code**: `packages/overlay/src/panel/code-drawer.ts`（添加 maximize 逻辑）+ `packages/overlay/src/overlay.css`（最大化按钮样式）
- **DOM 结构变更**: `buildBlockPanel` 的 `titleEl` 旁新增 maximize 按钮元素
- **状态管理**: 新增 `maximizedPanel` 状态追踪当前最大化的面板（或用 null 表示无最大化）
- **依赖**: 无新增依赖
