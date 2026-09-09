## 1. pluginkit: 合并 getDiskTemplateLine / getDiskTemplate 重复

- [x] 1.1 `packages/pluginkit/src/template.ts` 中 `getDiskTemplateLine`（约 57-69 行）的读盘→parse→错误守卫→`offsetToLine` 前置流程与 `getDiskTemplate`（约 78-93 行）逐字重复。将 `getDiskTemplateLine` 改为委托 `getDiskTemplate`：`const d = getDiskTemplate(...); return d ? d.line : -1;`，删除其内部重复的读盘+parse 块。签名、返回值、错误语义（解析失败/无 template → -1）保持不变。

## 2. shared: 合并 host-bridge 的 addToolBtn/onInspect/onSelect 重复

- [x] 2.1 `packages/shared/src/host-bridge.ts` 中 `addToolBtn`/`onInspect`/`onSelect`（约 62-95 行）共享同一"查 host→直派发，否则 push task + startPolling + 返回 removePending"骨架，仅 kind 字段与 host 派发方法不同。在文件内新增私有 helper（如 `queueTask(task, dispatch)`）封装 push/startPolling/返回 removePending，三个导出函数改为调用它。导出签名、返回的取消函数、`startPolling`/`removePending` 调用时序不变。
- [x] 2.2 `flushPending`（约 124-139 行）的三分支派发（btn→registerBtn / inspect→onInspect / else→onSelect）若与 2.1 的派发闭包可共用则一并收拢，否则保持原样。不得改变派发顺序与 host 缺失时的 no-op 行为。

## 3. overlay: 消除面板内 DOM 构建重复（待排查结果确认后执行）

- [x] 3.1 根据 overlay 排查结果，对 `packages/overlay/src/*` 中确认的逐字重复 DOM 构建/事件绑定块（≥2 处、每处 ≥5 行）抽文件内私有函数。不动 `state.ts` 单一可变 `state` 对象约定，不动 `__vdi-` class 前缀，不动动态布局 JS 内联约定。改完跑 `pnpm typecheck` + `pnpm lint`。
- [x] 3.2 overlay 改动后执行 `pnpm -C packages/overlay build`，由用户重启 demo 做人工回归（hover/选中/右键菜单/属性面板/撤销重做）。

## 4. client: 消除 server/editor 重复（待排查结果确认后执行）

- [x] 4.1 根据 client 排查结果，对 `packages/client/src/server.ts`、`editor.ts`、`history.ts` 中确认的逐字重复逻辑（如路由处理器的读盘-解析-定位-写盘流程、错误响应塑形）抽文件内私有函数。**不触碰** CLAUDE.md 标注的 invariant：`prependRight` vs `overwrite` 零长度区间、`findCloseTagStart`、`expandSelfClosing`、`removeElementRange`。改完跑 `pnpm typecheck` + `pnpm lint`。
- [x] 4.2 跑 `packages/client` 既有测试（`pnpm -C packages/client test` 或对应脚本）确认 `editor.ts` 区间操作与属性引号转义等行为不变。
- [x] 4.3 `packages/overlay/src/history.ts` 中 `requestUndo`/`requestRedo` 已合并为 `requestHistory(path, kind)`（工作区已有未提交改动）——确认其归属本变更，纳入提交；若排查发现 client 侧 `history.ts` 有类似重复一并处理。

## 5. 收尾验证

- [x] 5.1 `pnpm typecheck` 全绿。
- [x] 5.2 `pnpm lint` 全绿。
- [x] 5.3 `pnpm -C packages/client test` 与 `pnpm -C packages/utils test` 通过（既有用例作回归基线）。
- [x] 5.4 `pnpm run prettier` 格式化本次改动的文件。
- [x] 5.5 自检清单（CLAUDE.md 第十三条）：未改无关代码/业务逻辑/返回结果/新增抽象/新增文件/新增依赖/影响他模块/保持原架构——逐项确认。
