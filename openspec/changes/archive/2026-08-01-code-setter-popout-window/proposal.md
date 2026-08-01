## Why

CodeSetter 在属性行内嵌入了一个紧凑的 Monaco 编辑器（fontSize 12、无行号、无 minimap），适合简单值编辑。但当属性值是多行 Vue 表达式（如 `:value`、`@click` 绑定的复杂回调）时，行内编辑器高度有限、视野局促，用户难以舒适地阅读和编辑较长代码。需要一个"弹出大窗口"入口，在不破坏现有行内编辑体验的前提下提供更大的代码输入观感。

## What Changes

- 在 CodeSetter 行内编辑器的右上角添加一个齿轮按钮（⚙️），点击后打开一个浮动窗口。
- 浮动窗口为一个模态遮罩 + 居中大尺寸 Monaco 编辑器（约 70vw × 70vh），标题栏显示属性名 + 关闭按钮。
- 浮动窗口与行内编辑器共享同一个 Monaco `ITextModel`，双方实时同步（Monaco 原生支持同 model 多 editor）。
- 关闭浮动窗口时仅 dispose 浮动 editor 实例，不 dispose model（行内 editor 继续使用）。
- 不改变 CodeSetter 的行内编辑行为、不改变 `entry.value` 数据流、不改变 setter 推断规则。

## Capabilities

### New Capabilities
<!-- 无新能力，复用现有 prop-panel-setters 能力。 -->

### Modified Capabilities
- `prop-panel-setters`: 新增 CodeSetter 弹出窗口行为--齿轮按钮触发浮动编辑器、共享 model 实时同步、关闭时仅释放浮动 editor。

## Impact

- **代码**：`packages/overlay/src/setters/code-setter.ts`（添加齿轮按钮 + 浮动窗口逻辑）、`packages/overlay/src/overlay.css`（浮动窗口样式）。
- **构建**：`packages/overlay` 重建（`pnpm -C packages/overlay build`），IIFE 体积微增。
- **行为**：CodeSetter 行内编辑器右上角新增可点击齿轮，弹出大窗口编辑。不改变其他 setter。
- **依赖**：无新增依赖，复用已加载的 Monaco。
