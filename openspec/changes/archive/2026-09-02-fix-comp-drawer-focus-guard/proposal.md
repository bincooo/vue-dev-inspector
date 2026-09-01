## Why

宿主页面的 antdv `a-drawer` 通过 `@v-c/util` 的 `useLockFocus` 在 `window` 上注册 `focusin` 焦点陷阱。当该宿主抽屉处于打开状态时，用户进入审查模式并打开组件面板（comp-drawer），点击面板内「搜索组件…」输入框后焦点被 `syncFocus` 立即抢回宿主抽屉内的第一个可聚焦节点，导致无法聚焦、无法输入。prop panel 与 CodeSetter 弹窗已有同型修复（`events.ts` / `code-setter.ts` 的 capture 阶段 `focusin` 拦截），唯独 comp-drawer 遗漏，属同一缺陷家族的第三处实例。

## What Changes

- 为组件抽屉（`__vdi-drawer` / `__vdi-backdrop`）补齐 focus-guard：抽屉打开期间，capture 阶段拦截抽屉子树内的 `focusin` 并 `stopImmediatePropagation`，阻断 antdv `useLockFocus` 的焦点回拉。
- 属性选择抽屉（`__vdi-attr-drawer` / `__vdi-attr-backdrop`）与「编辑代码」抽屉（`__vdi-code-drawer`）存在相同结构风险，一并纳入守卫范围，消除逐个浮层补丁的模式。
- 将守卫条件重构为「所有已打开的 `__vdi-` 顶层浮层子树」的统一判定，替代 `events.ts` 中逐个 `if` 判断 prop panel / code drawer 的写法，后续新增浮层自动获得保护。

## Capabilities

### New Capabilities

- `overlay-focus-guard`: overlay 顶层浮层（组件抽屉、属性抽屉、编辑代码抽屉、prop panel、CodeSetter 弹窗）在宿主组件库焦点陷阱（focus-trap）打开期间，自身内部的可聚焦控件必须能正常聚焦与接收输入；守卫对宿主页面原有焦点行为零干扰（浮层外不拦截）。

### Modified Capabilities

（无 —— `openspec/specs/` 当前为空，无既有 spec 需要修改。）

## Impact

- **代码**：`packages/overlay/src/events.ts`（全局 `focusin` capture 拦截器重构）；`packages/overlay/src/panel/comp-drawer.ts`（如需在 state 上暴露当前抽屉元素则微调，复用既有 `state.componentDrawer` / `state.attrDrawer` 字段）；`packages/overlay/src/setters/code-setter.ts`（可复用统一守卫，移除局部 `focusGuard`）。
- **构建**：修改 `packages/overlay/src/*` 后需 `pnpm -C packages/overlay build` 重建 IIFE，并重启 demo 验证（插件启动时一次性从磁盘读取 `dist/overlay.iife.js`）。
- **不受影响**：服务端 API、编译期 transform、core/uni 插件层均无改动。
