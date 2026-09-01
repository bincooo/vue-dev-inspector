## Context

overlay 已有两处针对 antdv `useLockFocus` 焦点回拉的补丁，均为「capture 阶段拦截浮层子树内 `focusin` + `stopImmediatePropagation`」模式：

- `packages/overlay/src/events.ts:189` — 全局注册一次，逐个 `if` 判断 `state.propPanel` / `state.codeDrawer` 两棵子树（commit 42b1143）。
- `packages/overlay/src/setters/code-setter.ts:31` — CodeSetter 弹窗局部注册，随弹窗关闭移除。

`@v-c/util` 的 `lockFocus` 以 `window.addEventListener("focusin", syncFocus)`（冒泡阶段）注册回调，`syncFocus` 检查 `document.activeElement` 是否在锁定的容器内，不在则强制 `.focus()` 回第一个可聚焦节点。overlay 浮层挂在 `document.body` 下、处于宿主抽屉 DOM 之外，因此浮层内 input 的 `focusin` 一路冒泡到 window 就会被抢焦。

组件抽屉（`packages/overlay/src/panel/comp-drawer.ts`）与属性选择抽屉（`attr-drawer.ts`）没有纳入 `events.ts` 的判定列表——这就是本次缺陷：宿主抽屉开着时打开组件面板，搜索框点不进去。

所有顶层浮层的宿主元素已经在 `state` 上有对应字段：`state.componentDrawer` / `state.attrDrawer` / `state.codeDrawer` / `state.propPanel`（CodeSetter 弹窗为局部变量，无 state 字段）。

## Goals / Non-Goals

**Goals:**

- 组件抽屉、属性选择抽屉在宿主焦点陷阱激活时内部控件可正常聚焦输入。
- 统一守卫判定：一处代码覆盖现在与未来的所有顶层浮层，消除「逐浮层打补丁」。
- 浮层外的 `focusin` 零拦截，宿主行为不变。

**Non-Goals:**

- 不解决宿主自身多个焦点陷阱之间的冲突（那是宿主应用的问题）。
- 不引入 `@v-c/util` 的 `registerAllowedElement` 白名单协作机制——那要求拿到宿主 hook 的返回值，overlay 作为外挂脚本拿不到。
- 不处理键盘 Tab 循环（`onWindowKeyDown` capture 拦截）：现有 prop panel 修复也只拦 `focusin`，Tab 循环被抽屉接管属可接受行为，保持一致。

## Decisions

### D1：扩展现有全局拦截器（events.ts），而非每浮层局部注册

`events.ts` 的全局 `focusin` capture 拦截器已存在且只注册一次，把判定列表从 `{propPanel, codeDrawer}` 扩成 `{componentDrawer, attrDrawer, codeDrawer, propPanel}`（加上 CodeSetter 弹窗，见 D2）。

- 备选 A：comp-drawer 仿照 code-setter 局部注册/注销。被否——第三个浮层已经说明「每开一个浮层记得打补丁」不可持续，且局部注册需要处理关闭时序（`closeTimer` 200ms 后才移除 DOM）。
- 备选 B：用 `elementsFromPoint` / `document.activeElement` 最近的 `__vdi-` 前缀祖先做通用判定。被否——依赖 className 字符串判断太脆（SVG 元素 className 是 `SVGAnimatedString`），且把守卫范围从「已知顶层浮层」扩大到「任意 `__vdi-` 元素」，可能误伤审查模式自己的红框/按钮（它们没有输入需求但也没有害处——实际风险是语义扩散，难以推理）。显式列表 + state 字段是当前代码库已有的表达方式（`Esc 优先级` `handleEscape` 就是这样罗列的）。

### D2：CodeSetter 弹窗的局部 focusGuard 迁移到统一守卫

CodeSetter 弹窗是唯一没有 state 字段的浮层。两个选择：

- **选定**：给 `state` 加 `codePopout: HTMLDivElement | null`（或复用既有命名风格），`openPopout` 赋值、`close` 清空；`code-setter.ts` 删除局部 `focusGuard`，统一走 events.ts 守卫。单一机制，行为不变。
- 备选：保留局部注册不动。被否——两套同型机制并存，下次新增浮层时仍要回答「走哪套」，这就是本缺陷的成因。

### D3：拦截器保持 capture + stopImmediatePropagation

`@v-c/util` 的 `syncFocus` 注册在冒泡阶段；capture 阶段先于它执行，`stopImmediatePropagation` 会阻断**同元素同阶段**的后续监听器并终止整个传播。注意：`stopImmediatePropagation` 在 capture 阶段调用时同样会阻止事件到达 target 与冒泡阶段——这正是我们要的（prop panel 修复已验证 `input`/`beforeinput` 事件流不受影响，因为它们是独立事件，不是 `focusin` 的传播延续）。

保留既有写法（`e.stopImmediatePropagation()` 而非 `stopPropagation()`）：防的是未来有第三方在 window capture 上也挂回调的边角情况，且与两处既有补丁语义一致。

### D4：判定用「任一已打开浮层 contains(target)」

```ts
const guards = [state.propPanel, state.codeDrawer, state.componentDrawer, state.attrDrawer, state.codePopout];
for (const g of guards) {
  if (g && g.contains(e.target)) { e.stopImmediatePropagation(); return; }
}
```

`contains` 对 DOM 子树判定 O(深度)，五个浮层全开的情况可忽略不计；浮层间互斥/叠放的组合（prop panel + attr drawer 并存）天然被覆盖。

## Risks / Trade-offs

- [浮层开着时，宿主焦点陷阱的 Tab 循环逻辑失效] → 接受。浮层本来就是临时的开发期工具，Tab 循环被浮层劫持比焦点被抢更符合直觉；与 prop panel 既有行为一致。
- [state 新增 `codePopout` 字段，code-setter 的 close 时序（editor.dispose → remove）若在守卫读取前执行] → `close()` 同步置 null，守卫下一帧读不到即放行；不会出现「弹窗已关仍拦截」的悬挂。
- [宿主将来改用 capture 阶段注册] → `stopImmediatePropagation` 只保证先注册的 capture 监听器先执行；overlay 的 IIFE 在 `</body>` 前注入、监听器在 `init()` 时注册，通常早于宿主交互后打开的抽屉。若真出现同阶段竞争，注册顺序（先注入先注册）对 overlay 有利。风险低，接受。
- [未来新增浮层忘记加进 guards 列表] → 列表集中在拦截器一处，比散落各文件的局部注册更容易被看到；在 state 字段注释与 CLAUDE.md 的 invariant 段落补一句提示。

## Migration Plan

1. 修改 `events.ts` 拦截器 + `state.ts` 加字段 + `code-setter.ts` 移除局部 guard（见 tasks.md）。
2. `pnpm -C packages/overlay build` 重建 IIFE。
3. 重启 PC demo（插件启动时一次性读取 `dist/overlay.iife.js`，旧产物驻留）。
4. 验证：AntdTest.vue 点「Open Drawer」→ 进入审查 → 右键/菜单打开组件面板 → 点击搜索框输入文字。回归验证：prop panel 输入、CodeSetter 弹窗 Monaco 输入、无浮层时宿主抽屉内输入均正常。
5. 回滚即 revert 三个源文件改动 + 重建 overlay，无数据/配置迁移。

## Open Questions

（无——修复模式已被两处既有补丁验证，本设计只是把同一机制扩展到全部浮层。）
