## Context

编辑代码抽屉（`packages/overlay/src/panel/code-drawer.ts`）当前布局：
- Script 和 CSS 面板在 `__vdi-code-split-wrap` 容器内上下分屏（中间 6px splitter 可拖动调整比例）
- 子节点面板在 `split-wrap` 下方，固定 300px 高度（可折叠）

三个面板共享抽屉 body 的纵向空间，编辑大面积代码时需要频繁滚动。

## Goals / Non-Goals

**Goals:**
- 用户可临时最大化某个编辑区，获得更大编辑面积
- 最大化/还原切换流畅，无闪烁
- 保持现有分屏布局的完整功能（splitter 拖动、子节点折叠）

**Non-Goals:**
- 最大化状态不跨会话持久化（关闭抽屉即还原）
- 不改变抽屉整体宽度（仍由左边缘拖动条控制）
- 不改变 Monaco 编辑器的配置

## Decisions

### 1. 最大化实现方式：隐藏其他面板 + 当前面板 flex: 1

**选择**: 最大化时将其他两个面板设为 `display: none`，当前面板设为 `flex: 1 1 0` 占满空间。

**替代方案**:
- CSS `position: absolute` 覆盖：需要计算坐标，复杂且破坏 flex 布局
- CSS `order` + `flex-grow`：无法完全隐藏其他面板（仍占 DOM 空间）

**理由**: 最简单直接，`display: none` 完全移除其他面板的布局占用，当前面板自然填满。

### 2. 状态追踪：单变量 `maximizedPanel`

**选择**: 在 `openCodeDrawer` 作用域内维护一个 `maximizedPanel: BlockPanel | null` 变量。

**理由**: 同一时间最多一个面板可最大化，单变量足够。关闭抽屉时自动清 null。

### 3. 按钮位置：标题栏右侧

**选择**: 最大化按钮放在 `__vdi-code-block-title` 右侧，与标题文字同行。

**DOM 结构**:
```
__vdi-code-block
├─ __vdi-code-block-header
│  ├─ __vdi-code-block-title (Script / CSS / 子节点)
│  └─ __vdi-maximize-btn (⛶ / ⤡)
├─ __vdi-code-editor
└─ __vdi-code-block-actions
```

**理由**: 符合常见编辑器 UI 惯例（VS Code、Chrome DevTools 的最大化按钮都在标题栏）。

### 4. 子节点面板最大化特殊处理

子节点面板初始为折叠态（`flex: 0 0 auto`）。最大化时需：
1. 自动展开（显示 editorWrap、saveBtn、cancelBtn）
2. 设为 `flex: 1 1 0`
3. 还原时若之前是折叠态，需恢复折叠

**实现**: 记录子节点面板最大化前的 `isCollapsed` 状态，还原时按此恢复。

## Risks / Trade-offs

**[Risk] Monaco 编辑器 layout 延迟**
→ 最大化后需调用 `editor.layout()` 刷新 Monaco 渲染。用 `requestAnimationFrame` 确保 DOM 更新后再 layout。

**[Risk] 子节点面板折叠态与最大化冲突**
→ 最大化时强制展开，还原时恢复原态。用户可能困惑"为什么还原后子节点又折叠了"。
→ 缓解：最大化子节点面板时自动触发 `loadChildText`（如果尚未加载）。

**[Trade-off] 隐藏而非销毁编辑器**
→ `display: none` 后 Monaco 编辑器仍占用内存。但关闭抽屉时会统一 dispose，可接受。
