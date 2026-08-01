## 1. CodeSetter 添加齿轮按钮

- [x] 1.1 在 `setters/code-setter.ts` 的 `build()` 中，Monaco 加载成功后的 `.then()` 回调内，创建齿轮按钮 `<button class="__vdi-prop-code-expand">⚙</button>` 并添加到容器。
- [x] 1.2 将 model 引用存到容器的 `__vdiModel` 属性上，供齿轮按钮 click handler 取用。
- [x] 1.3 确认 `.__vdi-prop-code-wrap` 有 `position: relative`（若无则在 CSS 中添加），使齿轮按钮可绝对定位。

## 2. 浮动窗口逻辑

- [x] 2.1 在 `code-setter.ts` 中实现 `openPopout(model)` 函数：创建遮罩 + 浮动窗口 DOM，用共享 model 创建新 Monaco editor（fontSize 14、lineNumbers on、minimap on）。
- [x] 2.2 浮动窗口标题栏显示"代码编辑" + 关闭按钮（✕），点击关闭按钮或遮罩关闭窗口。
- [x] 2.3 关闭时调用 `floatingEditor.dispose()`（不 dispose model），移除浮动窗口 DOM。
- [x] 2.4 齿轮按钮的 click handler 调用 `openPopout(model)`。

## 3. CSS 样式

- [x] 3.1 在 `overlay.css` 添加 `.__vdi-prop-code-expand` 样式（绝对定位右上角、半透明、hover 高亮）。
- [x] 3.2 在 `overlay.css` 添加 `.__vdi-code-popout-mask` / `.__vdi-code-popout` / `.__vdi-code-popout-header` / `.__vdi-code-popout-body` / `.__vdi-code-popout-close` 样式。

## 4. 构建与验证

- [x] 4.1 运行 `pnpm -C packages/overlay build` 构建 IIFE，确认无报错。
- [x] 4.2 运行 `pnpm typecheck` 确认类型通过。
- [x] 4.3 运行 `pnpm lint` 确认 ESLint 通过。
- [ ] 4.4 启动 PC demo（由用户执行），验证：CodeSetter 行内编辑器右上角有齿轮按钮、点击弹出大窗口、双方实时同步、关闭后行内编辑器正常。
- [x] 4.5 运行 `pnpm run prettier` 格式化改动代码。
