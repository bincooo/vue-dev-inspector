## 1. 服务端历史模块（packages/client/src/history.ts）

- [x] 1.1 新建 `history.ts`：`Snapshot` 接口（`absolutePath` / `content` / `label` / `at`）+ 模块级 `undoStack` / `redoStack` 双数组
- [x] 1.2 实现 `writeTracked(absolutePath, nextContent, label)`：读盘上旧全文 → push 进 undoStack（每文件超 `HISTORY_MAX_PER_FILE = 50` 时 FIFO 淘汰该文件最旧一条）→ 清空 redoStack → `fs.writeFileSync` 写入新内容。入栈失败（读盘异常）不阻断写盘
- [x] 1.3 实现 `undo()`：栈空返回 `{ success:false, error:'无可撤销条目' }`；否则弹栈顶 → 读盘上当前内容 push 进 redoStack → 把快照 content 写回磁盘 → 返回 `{ success:true, undo:{file,label,at}, canUndo, canRedo }`（file 转相对 projectRoots 的 posix 路径）
- [x] 1.4 实现 `redo()`：与 `undo()` 对称（redoStack 弹栈 → 盘上内容 push 回 undoStack → 写回 redo 快照内容）
- [x] 1.5 实现 `getHistory()`：返回 `{ canUndo, canRedo, entries: 最近 10 条 {file,label,at} }`
- [x] 1.6 `packages/client/src/index.ts` 按需导出 history 公开 API（`writeTracked` 供 server 内部用可不导出，路由处理器导出）

## 2. 路由接入（packages/client/src/server.ts）

- [x] 2.1 `ROUTES` 表新增 `/undo` / `/redo` / `/get-history` 三条 POST 路由，处理器直接调 history 模块并 `json(res, 200, ...)`
- [x] 2.2 把 7 个写路由的 `fs.writeFileSync(ctx.absolutePath, result, 'utf-8')` 逐个替换为 `writeTracked(ctx.absolutePath, result, '<路由名>')`：update-props / delete-element / duplicate-element / insert-component / move-element / update-block / update-child-text
- [x] 2.3 核对 insert-component 的 `ensureImports` 分支：最终写盘只走一次 `writeTracked`（imports 合并后的 result），避免同一次操作入栈两次

## 3. overlay 撤销/重做按钮（packages/overlay/src/）

- [x] 3.1 `state.ts`：新增 `historyBar` / `undoButton` / `redoButton` 元素引用字段（`null as HTMLDivElement | null`）
- [x] 3.2 `inspector.ts` `createUI()`：创建 `__vdi-history-bar` 容器（右上角 fixed）+ 两枚按钮（`↩ 撤销` / `↪ 重做`），默认 `display:none`，append 到 body 并写入 state
- [x] 3.3 `overlay.css`：`.__vdi-history-bar` 固定右上角（`top:16px; right:16px; z-index` 与既有浮层一致）+ 按钮静态样式（与 `__vdi-action-btn` 视觉风格统一）+ 置灰态 class（`opacity:.4; pointer-events:none`）
- [x] 3.4 `inspector.ts` `toggle()`：`state.inspecting` 为 true 时显示 history bar 并调 `/get-history` 刷新禁用态；false 时隐藏
- [x] 3.5 新建 `history.ts`（overlay 侧）：`requestUndo()` / `requestRedo()` / `refreshHistoryButtons()` 三个函数——前两者 POST 后用响应内嵌 `canUndo/canRedo` 刷新按钮禁用态 + 成功 `logInfo`、失败 `apiError` toast；`refreshHistoryButtons()` 调 `/get-history` 同步初始态
- [x] 3.6 `events.ts`：history bar 两按钮的 onclick 绑定（`swallow` + 调 requestUndo/requestRedo）
- [x] 3.7 `events.ts` keydown 处理器：`state.inspecting && e.ctrlKey && e.code === 'KeyZ'` 时，若事件目标不在 `input, textarea, [contenteditable], .__vdi-code-editor` 内则 `preventDefault` 并触发撤销（`e.shiftKey` 时为重做）；审查模式关闭时不拦截

## 4. 写操作后的按钮状态联动

- [x] 4.1 overlay 各写操作成功回调（属性保存 `panel/index.ts`、删除 `menu.ts`、复制 `inspector.ts`、插入 `comp-drawer.ts`、move `events.ts`、代码抽屉保存 `code-drawer.ts`）统一在成功分支调 `refreshHistoryButtons()`——封装成小函数避免七处复制粘贴
- [x] 4.2 验证按钮禁用态流转：无历史时双按钮置灰 → 写一次后撤销可用 → 撤销后重做可用 → 新写操作后重做置灰

## 5. 构建与验证

- [x] 5.1 `pnpm -C packages/client build` 重建 client
- [x] 5.2 `pnpm -C packages/overlay build` 重建 overlay（IIFE 产物）
- [x] 5.3 `pnpm typecheck` 通过
- [x] 5.4 `pnpm lint` 通过
- [ ] 5.5 用户手动验证（PC demo）：改属性 → Ctrl+Z 撤销 → 页面热更新回旧值 → Ctrl+Shift+Z 重做恢复；删除元素 → 撤销后元素回来；连续 3 次操作连续 3 次撤销终态与初始一致；Monaco/输入框内 Ctrl+Z 仍是原生文本撤销；关闭审查模式再开启后撤销仍可用；**拖动把手按住拖动整个历史条（含边界夹紧）**
- [x] 5.6 运行 `pnpm run prettier` 格式化修改的代码

## 6. 迭代：按钮竖排 + 可拖动（跟随用户反馈）

- [x] 6.1 `overlay.css`：`.__vdi-history-bar` 改 `flex-direction: column`（撤销在上、重做在下），grab/grabbing 光标挂在 bar 整体
- [x] 6.2 `inspector.ts` `createUI()`：新增 `installHistoryDrag(bar)` —— 在 bar 自身（含按钮区域）mousedown 冻结几何（top/right → left/top 内联）、位移超 3px 才进入拖动、document mousemove 夹紧视口内（8px 余量）跟随、mouseup 摘除监听；拖动收尾置 `suppressNextClick`，capture 阶段拦掉随之而来的 click，避免拖完误触撤销/重做
- [x] 6.3 重建 overlay/core/uni dist 并 `pnpm typecheck` / `pnpm lint` / `pnpm run prettier` 通过
- [x] 6.4 迭代：移除独立 `__vdi-history-grip` 把手元素，拖动句柄改为 `__vdi-history-bar` 整体（CSS grip 规则删除，光标改挂在 bar 上），更新 6.1/6.2 描述与本条记录
