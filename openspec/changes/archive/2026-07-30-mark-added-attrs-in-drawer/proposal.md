## Why

属性抽屉中点击已添加到编辑列表的属性时无任何视觉反馈--`onclick` 直接 `return`，用户无法区分哪些属性已添加、哪些未添加，体验上像是"点了没反应"。需要在抽屉中对已添加的属性显示 ✓ 标记，让用户一眼看出状态。

## What Changes

- 抽屉 `render(filter)` 构建属性行时，检查该属性是否已存在于 `state.panelData.entries`，已存在则在行右侧追加 ✓ 标记（`.__vdi-attr-drawer-item-check`）。
- 点击属性添加后，重新 `render(currentFilter)` 刷新整个列表，新添加的行立即显示 ✓。
- 将 `filter` 提为闭包变量 `let currentFilter = ""`，供点击添加后重渲染复用。
- `overlay.css` 新增 `.__vdi-attr-drawer-item-check` 样式（绿色 ✓，`margin-left: auto` 右对齐）。
- **不监听** prop panel 侧的 entries 变化（手动加/删/改 key）；标记仅在抽屉打开、搜索过滤、抽屉内点击添加时同步。关闭再打开抽屉时天然重新同步。

## Capabilities

### New Capabilities
<!-- 无 -->

### Modified Capabilities
- `attr-picker-drawer`: 新增「已添加属性视觉标记」requirement -- 抽屉渲染时检查 entries 并对已存在的属性显示 ✓ 标记，点击添加后即时刷新标记。

## Impact

- **`@vue-dev-inspector/overlay`**：`attr-drawer.ts` 的 `render` 函数增加 entries 检查 + ✓ 标记逻辑；`overlay.css` 新增标记样式。改动仅限 overlay 包内部，不涉及 shared 类型、服务端 API、配置流转。
- **构建**：修改 `overlay/src/*` 后需重建 overlay 并重启 demo（overlay IIFE 启动时一次性从磁盘读取）。
