## 1. 提升 z-index

- [x] 1.1 在 `overlay.css` 中将 `.__vdi-code-popout-mask` 的 `z-index` 从 10001 改为 99999。

## 2. 焦点抢占

- [x] 2.1 在 `setters/code-setter.ts` 的 `openPopout` 中，`editor` 创建后添加 `requestAnimationFrame(() => editor.focus())`。
- [x] 2.2 在 mask 的 `onmousedown` 中添加 `e.stopPropagation()`，防止 antdv focus trap 拦截。

## 3. 构建与验证

- [x] 3.1 运行 `pnpm -C packages/overlay build`，确认无报错。
- [x] 3.2 运行 `pnpm typecheck` 确认类型通过。
- [x] 3.3 运行 `pnpm lint` 确认 ESLint 通过。
- [x] 3.4 运行 `pnpm run prettier` 格式化改动代码。
