## Context

CodeSetter 浮动窗口（`openPopout`）在 antdv `a-drawer`/`a-modal` 打开时无法输入。antdv 抽屉实现 focus trap，拦截键盘事件。浮动窗口 z-index 10001 高于 antdv 默认 z-index 1000，但 focus trap 与 z-index 无关--它通过事件监听拦截 focus。见 `proposal.md` 了解动机。

## Goals / Non-Goals

**Goals:**
- 浮动窗口在 antdv 抽屉/模态框下可正常接收键盘输入。
- 不影响浮动窗口的关闭行为（遮罩点击关闭、✕ 按钮关闭）。

**Non-Goals:**
- 不修改 antdv 组件本身。
- 不处理 antdv 抽屉的 mask 遮挡问题（z-index 已足够高）。

## Decisions

### D1: z-index 提升到 99999

当前 z-index 10001 与 overlay 内部 attr drawer（也 10001）同级，存在潜在冲突。提升到 99999 确保高于所有 antdv 组件（antdv base 1000，增量不超过 2000）和 overlay 内部所有层。

### D2: editor.focus() 显式抢占焦点

Monaco 创建后默认不自动获取焦点。在 antdv focus trap 环境下，需显式 `editor.focus()` 确保键盘事件路由到 Monaco。在 `requestAnimationFrame` 中调用，确保 DOM 已渲染。

### D3: mask onmousedown 阻止默认行为

antdv focus trap 可能监听 `mousedown` 事件来抢回焦点。在 mask 的 `onmousedown` 中调用 `e.stopPropagation()` 阻止事件冒泡到 antdv 的事件监听器。仅对 mask 本身的点击生效（点击 popout 内部不需要，因为 popout 内的事件不会冒泡到 mask）。

## Risks / Trade-offs

- **[z-index 99999 过高]** 可能与宿主页面的极高 z-index 元素冲突。**缓解**：99999 是常见的安全值，Bootstrap/Element UI 等均使用类似值。
- **[stopPropagation 副作用]** 阻止 mask 的 mousedown 冒泡可能影响宿主页面的全局 mousedown 监听。**缓解**：仅阻止 mask 元素自身的事件，不影响 popout 内部交互。
