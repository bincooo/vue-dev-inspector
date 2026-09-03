## Why

审查模式下所有写操作（更新属性、删除、复制、插入、移动、编辑 Script/Style/子节点文本）都直接 `fs.writeFileSync` 覆盖源码，没有任何撤销手段——误删一个元素后只能去编辑器里手动 `Cmd+Z`，而此时文件已被外部改写，编辑器的本地撤销栈早已失效。用户在审查模式里做可视化编辑时缺少最基本的安全网。

## What Changes

- **服务端新增修改历史栈**（`packages/client/src/server.ts`）：所有 7 个写路由在写盘前把「旧文件全文快照」压入内存栈（每文件上限 N 条，防大文件无限占用内存），撤销/还原即弹出快照写回磁盘，由 Vite HMR 热更新。
- **新增 REST 路由**：
  - `/undo` —— 撤销上一次写操作，返回撤销后的条目信息（文件 + 动作类型 + 剩余可撤销数）
  - `/redo` —— 重做最近一次被撤销的操作
  - `/get-history` —— 读取当前历史栈状态（可撤销数 / 可重做数 / 最近条目摘要），供按钮禁用态刷新
- **overlay 新增撤销/还原按钮**（`packages/overlay/src/inspector.ts` + `state.ts` + `events.ts`）：固定在页面右上角（审查模式开启时显示），`↩ 撤销` / `↪ 重做` 两枚按钮；无可撤销/可重做条目时置灰。快捷键 `Ctrl+Z` / `Ctrl+Shift+Z`（审查模式内）。
- **写路由统一接入**：`update-props` / `delete-element` / `insert-component` / `duplicate-element` / `move-element` / `update-block` / `update-child-text` 全部入栈；只读路由不入栈。

## Capabilities

### New Capabilities

- `edit-history`: 审查模式写操作的服务端快照历史与撤销/重做——涵盖历史栈记录、`/undo` `/redo` `/get-history` API 语义、overlay 撤销/重做按钮交互与快捷键。

### Modified Capabilities

（无——`review-mode` 主 spec 尚未落库，`overlay-focus-guard` / `parent-select` / `portal-inspect-fix` 的行为不受影响；撤销/重做走独立浮层按钮，不进入 focus-guard guards 列表也无需拦截焦点。）

## Impact

- **`packages/client/src/server.ts`**：新增 history 模块（快照栈数据结构 + push/undo/redo 逻辑）+ 3 个路由 + 7 个写路由各加一行入栈调用。
- **`packages/overlay/src/`**：`state.ts`（按钮元素引用）、`inspector.ts`（创建/定位按钮）、`events.ts`（点击处理 + 快捷键）、`overlay.css`（按钮静态样式）。
- **构建链**：改 client 后需 `pnpm -C packages/client build`；改 overlay 后需 `pnpm -C packages/overlay build` 并重启 demo。
- **无依赖变化**、无公开 API 破坏（仅新增路由）；`shared` 无需改动。
- **已知边界**：历史栈仅驻内存，dev server 重启即清空；不做跨浏览器标签页同步（与 `currentSelection` 同语义）；不拦截用户在编辑器里的手动保存（手动改文件会使快照与磁盘脱钩，撤销仍可回滚到快照内容）。
