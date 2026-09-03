## Context

7 个写路由（`update-props` / `delete-element` / `insert-component` / `duplicate-element` / `move-element` / `update-block` / `update-child-text`）在 `packages/client/src/server.ts` 中各自 `fs.writeFileSync(ctx.absolutePath, result)`，彼此独立、无共享写入口。写盘后 Vite HMR 自动热更新。

overlay 侧 `state.ts` 用单一可变 `state` 对象管理浮层元素引用；`inspector.ts` `createUI()` 创建所有常驻浮层；`events.ts` 集中绑定全局监听器（keydown 已有 Ctrl 键跟踪 `setCtrlHeld`）；右上角无既有常驻 UI（齿轮按钮在右下角）。

约束：

- 全项目 ESM-only、中文注释英文标识符。
- client 构建为 tsup 单文件 bundle 进 core/uni，不能引入新外部依赖。
- 快照内容是 `.vue` 全文（典型 < 100KB），内存驻留可接受，但需上限防失控。

## Goals / Non-Goals

**Goals:**

- 服务端集中式历史：一处实现、7 个写路由一行接入，避免每个 handler 重复栈逻辑
- 撤销/重做语义简单可预测：文件级快照回滚，HMR 兜底重渲染
- overlay 按钮与快捷键共用同一请求函数，禁用态由 `/get-history` 结果驱动

**Non-Goals:**

- 不做编辑器级（细粒度 diff/patch）撤销——文件快照足够
- 不做持久化磁盘历史（`.git` 已是最终安全网；重启 dev server 清空可接受）
- 不做多标签页历史同步（与 `currentSelection` 同语义，最后写入者胜）
- 不做跨文件事务分组（move v1 已限定同文件，无原子性问题）

## Decisions

### D1: 快照记「旧全文」而非「新全文」或 diff

**决定**：写盘前 push `{ absolutePath, content: 旧全文, label: 动作, at }`。

**理由**：撤销 = 直接把旧全文写回，无逆操作计算（删除的逆是插入、move 的逆是反向 move……每种都要单独实现且易错）。redo 则在 undo 时 push「撤销前全文」到重做栈，同样零逆计算。

**替代方案**：
- 记 diff（magic-string patch）：内存最小，但回放需要实现 patch 逆序应用，复杂度高收益低。
- 记新全文：undo 时需要「当前盘上内容」当旧值，语义绕（栈里存的是"结果"而非"起点"）。

### D2: 双栈线性模型（undoStack / redoStack），新写操作清空 redoStack

**决定**：`undoStack: Snapshot[]`（可撤销，全局按时间序混排多文件）+ `redoStack: Snapshot[]`。undo 弹栈顶 → 写回 `content` → 把「写回前盘上内容」push 进 redoStack；任何新的写操作 push undoStack 时 `redoStack.length = 0`。

**理由**：全局时间线（而非 per-file 栈）与用户心智一致——"撤销我刚才那一下"，不管那一下改的是哪个文件。per-file 栈在连续改两个文件时撤销顺序会错乱。

**替代方案**：per-file 双栈——多文件交替编辑时撤销顺序不符合直觉，弃。

### D3: 每文件快照上限（默认 50 条），FIFO 淘汰

**决定**：push 时按 `absolutePath` 统计栈内既有快照数，超过上限（`HISTORY_MAX_PER_FILE = 50`）则删掉该文件最旧的一条。上限只约束 undoStack；redoStack 天然短（一次新写操作即清空）。

**理由**：防长会话 + 大文件场景内存膨胀（50 × 100KB × 多文件仍在 MB 级）。FIFO 淘汰最旧快照意味着该次操作永久不可撤销——可接受，`label` 摘要让用户知道撤销的是什么。

### D4: 历史模块独立文件 `packages/client/src/history.ts`，写路由一行接入

**决定**：导出 `pushHistory(absolutePath, label)`（读盘上旧内容并压栈，在 `writeFileSync` **之前**调用）与 `undo()` / `redo()` / `getHistory()`。server.ts 各写路由在 `fs.writeFileSync` 前插一行 `pushHistory(ctx.absolutePath, 'update-props')`。

**理由**：7 处接入点保持一行、零重复；纯函数式模块便于单测。label 直接用路由名（如 `'update-props'`），前端 toast 展示时映射中文。

**替代方案**：包装 `writeTracked(path, content, label)` 替换 7 处 `writeFileSync`——同样一行接入且把「入栈 + 写盘」绑死更难漏；但 handler 里有「result === null 先 return 404 不写盘」的分支，包装函数会把这些早退分支的判断挪进闭包，可读性降。最终取折中：**导出 `writeTracked`，但入栈失败不阻断写盘**，7 处调用点形态为 `writeTracked(ctx.absolutePath, result, 'update-props')` 替换原 `fs.writeFileSync(ctx.absolutePath, result, 'utf-8')`——仍是单点替换、不会漏入栈，且写盘语义完全不变。

### D5: 路由 `/undo` `/redo` `/get-history`，响应统一携带双栈计数

**决定**：

```
POST /undo   -> { success, undo: { file, label, at } | null, canUndo, canRedo }
POST /redo   -> { success, undo: { file, label, at } | null, canUndo, canRedo }
POST /get-history -> { canUndo, canRedo, entries: [{ file, label, at }, ...] 最近 10 条 }
```

空栈 undo/redo 返回 200 + `success: false, error: '无可撤销条目'`（与既有路由「业务失败 200 + error 字段」风格一致的是 `json(res, 200, {...})`；但 apiRequest 对非 2xx 会 reject——为让按钮禁用逻辑简单，空栈返回 200 且 success:false，前端静默处理）。

`file` 用相对 `projectRoots[rootIndex]` 的 posix 路径（与 `/list-components` 一致），不泄漏服务端绝对路径。

**理由**：`canUndo/canRedo` 内嵌每次响应，撤销后无需再发 `/get-history` 即可刷新按钮禁用态。

### D6: overlay 按钮挂 body 右上角常驻条，仅审查模式显示；快捷键复用既有 keydown

**决定**：

- `createUI()` 创建 `__vdi-history-bar` 容器（内含两枚 `__vdi-action-btn` 风格按钮 `↩ 撤销` / `↪ 重做`），挂 body，默认 `display:none`；`toggle()` 里随 `state.inspecting` 显隐。
- 点击调 `apiRequest('/undo')` / `('/redo')`，成功后用响应内嵌的 `canUndo/canRedo` 刷新禁用态；失败弹 `apiError` toast。
- `events.ts` 既有 keydown 处理器加分支：`state.inspecting && e.ctrlKey && e.code === 'KeyZ'` → `preventDefault` + undo（`shiftKey` 区分 redo）。审查模式关闭时不拦截，浏览器原生 Ctrl+Z 不受影响。
- 开启审查模式（`toggle(true)`）与每次写操作成功回调后调 `/get-history` 刷新初始禁用态；历史条数为 0 时按钮置灰（`opacity:.4; pointer-events:none`）。
- 打开撤销时若 Monaco 抽屉正开着且内容已变（盘上内容被动过），Monaco model 显示旧内容——接受这种短暂不一致：用户关闭重开抽屉即重读。**不做**主动 invalidate（涉及跨模块通知，收益低）。

**理由**：右键菜单不适合高频连续操作；选中框旁按钮会随选中消失；右上角常驻条与审查模式生命周期一致、位置固定。

**替代方案**：
- 右键菜单加「撤销」项——菜单是元素上下文，撤销是全局操作，语义错位。
- 复用齿轮按钮旁——右下角已有 toggleBtn 语义，混入动作按钮易误触。

### D7: Ctrl+Z 与浏览器/宿主输入框冲突的处理

**决定**：keydown 处理器中，当 `state.inspecting` 为真且事件目标是可编辑元素（`input/textarea/contenteditable` 或 `.__vdi-code-editor` 内）时**不拦截** Ctrl+Z，让原生撤销在输入框内生效。仅当目标不是可编辑元素时才接管为全局撤销。

**理由**：审查模式下打开属性面板/代码抽屉在输入框里打错字是高频场景，全局吞掉 Ctrl+Z 会破坏输入体验。overlay 浮层都在 `__vdi-` 前缀 DOM 内，判定简单：`closest('input, textarea, [contenteditable], .__vdi-code-editor')`。

## Risks / Trade-offs

- [外部手动改文件导致快照脱钩] → 撤销仍按快照内容写回（最后写入者胜），HMR 重载后 UI 与磁盘一致；不做 mtime 校验（过度设计），文档明确「重启 dev server 清空历史」。
- [多标签页并发写] → 内存共享一个栈，两个标签页交替写时撤销顺序按服务端接收序——与单页多操作一致，无需额外处理。
- [大 SFC 文件 × 长会话内存] → D3 的每文件 50 条 FIFO 上限；实测 .vue 全文典型 < 100KB，峰值内存 < 数 MB。
- [Ctrl+Z 在 Monaco 编辑器内被全局拦截] → D7 的可编辑元素豁免；Monaco 容器加进豁免选择器。
- [undo 与正在打开的编辑面板状态不同步] → 接受短暂陈旧显示（D6），关闭重开即恢复；面板保存时服务端会按新内容再入栈，无数据丢失。

## Migration Plan

纯增量：新增 `history.ts` + 3 路由 + overlay 按钮。7 个写路由的 `writeFileSync` 逐个替换为 `writeTracked`，行为等价（入栈失败不阻断写盘）。回滚 = revert 提交，无数据迁移。

## Open Questions

（无——按钮样式细节、历史列表 UI（悬停显示最近操作清单）可后续迭代，不影响本次契约。）
