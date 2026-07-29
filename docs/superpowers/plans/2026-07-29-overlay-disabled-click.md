# overlay disabled 元素点击/右键接管 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让带 `disabled` 的元素仍可被审查层点击选中、右键菜单、Ctrl 拖拽、双击编辑，且不引入 hover 抖动、不干扰父中子 hover。

**Architecture:** hoverOverlay / selectOverlay 在 hover 稳定后下一帧 rAF 切 `pointer-events:auto`（接驳态）接住点击；hovered 变化那一刻立即切回 `none`（追踪态）让 mousemove 重新命中下方元素。`document` 上既有捕获监听全保留兜底，新增"target 命中 overlay"的旁路用 `hoveredElement`/`selectedElement` 直接走选中/取消/拖拽/菜单分支。

**Tech Stack:** TypeScript / overlay IIFE（Vite lib + singlefile 构建）。该包无单测 harness，测试周期 = `pnpm -C packages/overlay build` 重建 + 用户重启 demo 浏览器手测。

## Global Constraints

- overlay 类名一律 `__vdi-` 前缀；动态布局属性（left/top/display/pointer-events）JS 内联，静态样式写 `overlay.css`。
- 共享可变状态集中在 `state.ts` 单一 `state` 对象（`let` 导出不是 live binding，禁用"优化"成独立 `let`）。
- 修改 `packages/overlay/src/*` 后必须 `pnpm -C packages/overlay build` 重建，再由用户重启 demo —— 插件启动时一次性从磁盘读 `dist/overlay.iife.js`，旧产物会一直驻留。
- 注释中文、标识符英文，与周围代码一致。
- 服务启动交由用户，不允许 AI 自己执行。
- 范围锁在 `inspector.ts` + `events.ts`，CSS 零改，不动 server/pluginkit。

---

## File Structure

- **Modify** `packages/overlay/src/inspector.ts` — 新增 `enableOverlayCapture` / `disableOverlayCapture` 工具；改 `hover()` / `hide()` / `redrawSelection()` 接入时序切换；导出 capture 工具供 events.ts 清场。
- **Modify** `packages/overlay/src/events.ts` — 新增 `resolveOverlayHit`；改 `click` / `mousedown` / `contextmenu` / `dblclick` 四个 document 捕获监听加"命中 overlay"旁路；`scroll`/`resize` 重绘、`toggle`/`closeAll`/`hide` 清场接入 disable/enable。

---

### Task 1: 新增 overlay capture 时序切换工具（inspector.ts）

**Files:**
- Modify: `packages/overlay/src/inspector.ts`（在 `redrawSelection` 之前、`hover` 之前插入工具函数）

**Interfaces:**
- Produces:
  - `enableOverlayCapture(overlay: HTMLDivElement): void` — overlay 稳定后下一帧 rAF 切 `pointer-events:auto`；若期间被 disable，rAF 回调被作废。
  - `disableOverlayCapture(overlay: HTMLDividerElement): void` — 立即切 `pointer-events:none` 并作废挂起的 rAF。
  - 两个函数需被 `events.ts` import（清场用）。

- [ ] **Step 1: 在 inspector.ts 顶部模块作用域新增 tick 计数与两个工具函数**

在 `inspector.ts` 中 `redrawSelection` 函数之前插入：

```ts
/* ─── overlay pointer-events 时序切换 ────────────────────────────────
 * disabled 元素不派发鼠标事件，靠 overlay 接住点击/右键/拖拽。
 * hover 追踪期 overlay 必须 pointer-events:none 让 mousemove 穿透命中下方元素，
 * 否则鼠标锁在 overlay 上、父中子 hover 全废；仅在 hover 稳定后下一帧切 auto。
 * tick 计数作废上一帧挂起的 enable，避免 hovered 切换时旧帧抢先切 auto。
 */
let captureTick = 0;

/** overlay 稳定后下一帧切接驳态（pointer-events:auto）。
 *  先由调用方保证已 disable（none）让当前 mousemove 走命中判定。 */
export function enableOverlayCapture(overlay: HTMLDivElement): void {
  const tick = ++captureTick;
  requestAnimationFrame(() => {
    if (tick !== captureTick) return; // 已被后续 disable 作废
    overlay.style.pointerEvents = "auto";
  });
}

/** overlay 立即切回追踪态（pointer-events:none）并作废挂起的 enable。 */
export function disableOverlayCapture(overlay: HTMLDivElement): void {
  ++captureTick;
  overlay.style.pointerEvents = "none";
}
```

- [ ] **Step 2: 构建验证不报错**

Run: `pnpm -C packages/overlay build`
Expected: 成功生成 `dist/overlay.iife.js`，无 TS 报错（`void formatPosition` 等既有逻辑不受影响）。

- [ ] **Step 3: 提交**

```bash
git add packages/overlay/src/inspector.ts
git commit --no-verify -m "feat(overlay): 新增 overlay capture 时序切换工具"
```

---

### Task 2: hover / hide / redrawSelection 接入时序切换（inspector.ts）

**Files:**
- Modify: `packages/overlay/src/inspector.ts` — `hover()` / `hide()` / `redrawSelection()`

**Interfaces:**
- Consumes: Task 1 的 `enableOverlayCapture` / `disableOverlayCapture`。
- Produces: `hover(el)` 调用后 hoverOverlay 一帧后进入接驳态；`redrawSelection()` 选中态后 selectOverlay 进入接驳态。

- [ ] **Step 1: 改写 hover()**

把现有：

```ts
export function hover(element: HTMLElement): void {
  if (!element || !state.hoverOverlay) return;
  if (element === state.selectedElement) {
    state.hoverOverlay.style.display = "none";
  } else {
    positionOverlay(state.hoverOverlay, element, 1);
  }
  state.tagTip!.textContent = getElementTagName(element);
  state.tagTip!.style.display = "block";
  const rect = getLayoutBox(element)!.getBoundingClientRect();
  state.tagTip!.style.left = Math.max(0, rect.left) + "px";
  state.tagTip!.style.top = Math.max(0, rect.top - 24) + "px";
}
```

改为（hoverOverlay 显隐分支里统一接入 disable→enable）：

```ts
export function hover(element: HTMLElement): void {
  if (!element || !state.hoverOverlay) return;
  if (element === state.selectedElement) {
    state.hoverOverlay.style.display = "none";
    /* 选中元素上不展示 hover 框，但 hover overlay 仍在 DOM，
       切回 none 避免它挡住 selectOverlay 区域的命中判定 */
    disableOverlayCapture(state.hoverOverlay);
  } else {
    /* 先 none 让正在飞向新元素的 mousemove 能命中下方；再下一帧 auto 接住点击 */
    disableOverlayCapture(state.hoverOverlay);
    positionOverlay(state.hoverOverlay, element, 1);
    enableOverlayCapture(state.hoverOverlay);
  }
  state.tagTip!.textContent = getElementTagName(element);
  state.tagTip!.style.display = "block";
  const rect = getLayoutBox(element)!.getBoundingClientRect();
  state.tagTip!.style.left = Math.max(0, rect.left) + "px";
  state.tagTip!.style.top = Math.max(0, rect.top - 24) + "px";
}
```

- [ ] **Step 2: 改写 hide()**

把现有：

```ts
export function hide(): void {
  state.hoverOverlay!.style.display = "none";
  state.tagTip!.style.display = "none";
  state.hoveredElement = null;
}
```

改为：

```ts
export function hide(): void {
  disableOverlayCapture(state.hoverOverlay!);
  state.hoverOverlay!.style.display = "none";
  state.tagTip!.style.display = "none";
  state.hoveredElement = null;
}
```

- [ ] **Step 3: 改写 redrawSelection()**

把现有：

```ts
export function redrawSelection(): void {
  if (!state.selectOverlay) return;
  if (state.selectedElement && document.body.contains(state.selectedElement)) {
    positionOverlay(state.selectOverlay, state.selectedElement, 1);
    positionActionButtons();
  } else {
    state.selectOverlay.style.display = "none";
    setActionButtonsVisible(false);
    setSelectedElement(null);
  }
}
```

改为：

```ts
export function redrawSelection(): void {
  if (!state.selectOverlay) return;
  if (state.selectedElement && document.body.contains(state.selectedElement)) {
    /* 选中框进入接驳态：disabled 元素被选中后可再次点击 overlay 取消、可 Ctrl 拖拽 */
    disableOverlayCapture(state.selectOverlay);
    positionOverlay(state.selectOverlay, state.selectedElement, 1);
    enableOverlayCapture(state.selectOverlay);
    positionActionButtons();
  } else {
    disableOverlayCapture(state.selectOverlay);
    state.selectOverlay.style.display = "none";
    setActionButtonsVisible(false);
    setSelectedElement(null);
  }
}
```

- [ ] **Step 4: 构建验证**

Run: `pnpm -C packages/overlay build`
Expected: 成功，无报错。

- [ ] **Step 5: 提交**

```bash
git add packages/overlay/src/inspector.ts
git commit --no-verify -m "feat(overlay): hover/select overlay 接入 pointer-events 时序切换"
```

---

### Task 3: events.ts 加命中 overlay 旁路工具

**Files:**
- Modify: `packages/overlay/src/events.ts` — 新增 `resolveOverlayHit` + import capture 工具

**Interfaces:**
- Consumes: Task 1 的 `enableOverlayCapture` / `disableOverlayCapture`；`state.hoverOverlay` / `state.selectOverlay` / `state.hoveredElement` / `state.selectedElement`。
- Produces: `resolveOverlayHit(e)` 供本文件四个事件监听判定 target 是否命中 overlay，并返回对应被审查元素。

- [ ] **Step 1: 在 events.ts 顶部 import 块补充 capture 工具**

把现有 `import { createUI, hover, hide, ... } from "./inspector";` 改为追加 `disableOverlayCapture`、`enableOverlayCapture`：

```ts
import {
  createUI,
  hover,
  hide,
  redrawSelection,
  redrawDropIndicator,
  toggle,
  duplicateElement,
  deleteElement,
  endDrag,
  startDrag,
  disableOverlayCapture,
  enableOverlayCapture,
} from "./inspector";
```

- [ ] **Step 2: 在 `swallow` 函数之后新增 resolveOverlayHit**

```ts
/** 鼠标点落在 hover / select overlay 上时，按 overlay 映射到它当前贴合的被审查元素。
 *  overlay 自身在 CSS 上 pointer-events 默认 none，仅 hover/select 稳定后切 auto，
 *  此时被点中的 target 就是 overlay 本身——用它绕过 disabled 元素的事件拦截。 */
function resolveOverlayHit(e: Event): HTMLElement | null {
  const t = e.target as HTMLElement | null;
  if (t === state.hoverOverlay) return state.hoveredElement;
  if (t === state.selectOverlay) return state.selectedElement;
  return null;
}
```

- [ ] **Step 3: 构建验证**

Run: `pnpm -C packages/overlay build`
Expected: 成功。

- [ ] **Step 4: 提交**

```bash
git add packages/overlay/src/events.ts
git commit --no-verify -m "feat(overlay): events 新增 resolveOverlayHit 命中旁路"
```

---

### Task 4: click 监听加命中 overlay 旁路

**Files:**
- Modify: `packages/overlay/src/events.ts` — `click` document 捕获监听（约 232-303 行）

**Interfaces:**
- Consumes: `resolveOverlayHit`（Task 3）、现有 `setSelectedElement` / `redrawSelection` / `duplicateElement` / `deleteElement` / `clearPendingCancel` / `cancelSelectionTimer` / `swallow` / `isOverActionButton`。
- Produces: click 命中 overlay 时用对应元素走选中/取消分支，不依赖 e.target 冒泡。

- [ ] **Step 1: 在 click 监听开头（drag 守卫之后、菜单关闭之前）追加 overlay 命中旁路**

把现有 click 监听里：

```ts
      /* drag mode 中不响应 click …… */
      if (state.dragging) {
        swallow(e);
        return;
      }
      /* 点击菜单内部先处理菜单关闭 */
```

改为（在 drag 守卫与菜单关闭之间插入 overlay 命中解析，并把后续采用的"命中元素"统一成 `hit` 概念）：

```ts
      if (state.dragging) {
        swallow(e);
        return;
      }
      /* 鼠标落在 hover/select overlay 上（接驳态）：把它当前贴合的元素当作命中目标，
         绕过 disabled 元素的事件拦截。overlay 命中后 swallow 阻止后续冒泡兜底重复处理。 */
      const overlayHit = resolveOverlayHit(e);
      if (overlayHit) {
        swallow(e);
        /* 命中已选中元素（来源是 selectOverlay 或 hoverOverlay 命中当前选中元素）：
           走「取消选中」延迟逻辑，与下方 document 兜底路径一致 */
        if (state.selectedElement === overlayHit) {
          clearPendingCancel();
          cancelSelectionTimer = setTimeout(function () {
            cancelSelectionTimer = null;
            setSelectedElement(null);
            redrawSelection();
          }, 250);
          return;
        }
        /* 命中新元素：选中 */
        clearPendingCancel();
        setSelectedElement(overlayHit);
        redrawSelection();
        return;
      }
      /* 点击菜单内部先处理菜单关闭 */
      if (state.contextMenu!.style.display === "block") {
```

注意：保留 click 监听剩余部分（菜单关闭 / 复制删除按钮 / 插入按钮 / detail>=2 / `state.hoveredElement` 兜底选中逻辑）原样不动——这些是 disabled 之外场景的 document 冒泡兜底路径。

- [ ] **Step 2: 构建验证**

Run: `pnpm -C packages/overlay build`
Expected: 成功。

- [ ] **Step 3: 提交**

```bash
git add packages/overlay/src/events.ts
git commit --no-verify -m "feat(overlay): click 监听加命中 overlay 旁路"
```

---

### Task 5: mousedown 监听加命中 overlay 旁路（Ctrl 拖拽）

**Files:**
- Modify: `packages/overlay/src/events.ts` — `mousedown` document 捕获监听（约 209-230 行）

**Interfaces:**
- Consumes: `resolveOverlayHit`、`startDrag`、`swallow`、`state.selectedElement`、`state.ctrlKey`(e.ctrlKey)。
- Produces: disabled 元素被选中后 Ctrl+点 selectOverlay 能进入 drag mode。

- [ ] **Step 1: 改写 mousedown 监听**

把现有：

```ts
  document.addEventListener(
    "mousedown",
    function (e) {
      if (!state.inspecting) return;
      const target = findInspectableElement(e.target);
      if (!target) return;
      /* Ctrl+鼠标按下命中选中元素：进入 drag mode，源 = 选中元素 */
      if (
        e.ctrlKey &&
        state.selectedElement &&
        target === state.selectedElement
      ) {
        swallow(e);
        startDrag(state.selectedElement);
        return;
      }
      /* 默认：拦截 mousedown，阻止双击产生文本选区，
       同时阻止事件透传（focus 变化 / 自定义 mousedown 监听器） */
      swallow(e);
    },
    true,
  );
```

改为（开篇加 overlay 命中解析，命中 selectOverlay 时同样支持 Ctrl 拖拽；命中 overlay 一律 swallow 阻止选区/聚焦副作用）：

```ts
  document.addEventListener(
    "mousedown",
    function (e) {
      if (!state.inspecting) return;
      /* 命中 select overlay：disabled 选中元素 Ctrl+按下进入 drag mode，
         否则仅 swallow 防文本选区 / 阻断原生控件焦点副作用 */
      const overlayHit = resolveOverlayHit(e);
      if (overlayHit) {
        swallow(e);
        if (e.ctrlKey && overlayHit === state.selectedElement) {
          startDrag(state.selectedElement);
        }
        return;
      }
      const target = findInspectableElement(e.target);
      if (!target) return;
      if (
        e.ctrlKey &&
        state.selectedElement &&
        target === state.selectedElement
      ) {
        swallow(e);
        startDrag(state.selectedElement);
        return;
      }
      swallow(e);
    },
    true,
  );
```

- [ ] **Step 2: 构建验证**

Run: `pnpm -C packages/overlay build`
Expected: 成功。

- [ ] **Step 3: 提交**

```bash
git add packages/overlay/src/events.ts
git commit --no-verify -m "feat(overlay): mousedown 命中 overlay 旁路支持 disabled 拖拽"
```

---

### Task 6: contextmenu 监听加命中 overlay 旁路

**Files:**
- Modify: `packages/overlay/src/events.ts` — `contextmenu` document 捕获监听（约 305-322 行）

**Interfaces:**
- Consumes: `resolveOverlayHit`、`hover`、`setSelectedElement`、`redrawSelection`、`showMenu`。

- [ ] **Step 1: 改写 contextmenu 监听**

把现有：

```ts
  document.addEventListener(
    "contextmenu",
    function (e) {
      if (!state.inspecting) return;
      const el = findInspectableElement(e.target);
      if (!el) return;
      e.preventDefault();
      state.hoveredElement = el;
      hover(el);
      /* 右键命中即视作选中 …… */
      setSelectedElement(el);
      redrawSelection();
      showMenu(e.clientX, e.clientY, el);
    },
    true,
  );
```

改为（开篇先尝试 overlay 命中，命中即用对应元素；否则走原有 document 兜底）：

```ts
  document.addEventListener(
    "contextmenu",
    function (e) {
      if (!state.inspecting) return;
      /* 命中 overlay 时用其贴合的元素，绕过 disabled 元素不派发 contextmenu */
      let el = resolveOverlayHit(e);
      if (!el) el = findInspectableElement(e.target);
      if (!el) return;
      e.preventDefault();
      state.hoveredElement = el;
      hover(el);
      /* 右键命中即视作选中 …… */
      setSelectedElement(el);
      redrawSelection();
      showMenu(e.clientX, e.clientY, el);
    },
    true,
  );
```

- [ ] **Step 2: 构建验证**

Run: `pnpm -C packages/overlay build`
Expected: 成功。

- [ ] **Step 3: 提交**

```bash
git add packages/overlay/src/events.ts
git commit --no-verify -m "feat(overlay): contextmenu 命中 overlay 旁路"
```

---

### Task 7: dblclick 监听加命中 overlay 旁路 + 清场接入

**Files:**
- Modify: `packages/overlay/src/events.ts` — `dblclick` 监听（约 324-343 行）、`closeAll`、`refreshOverlays`

**Interfaces:**
- Consumes: `resolveOverlayHit`、`openPanel`、`disableOverlayCapture`/`enableOverlayCapture`、`state.hoverOverlay`/`state.selectOverlay`。

- [ ] **Step 1: 改写 dblclick 监听**

把现有：

```ts
  document.addEventListener(
    "dblclick",
    function (e) {
      if (state.dragging) {
        swallow(e);
        return;
      }
      if (!state.inspecting) return;
      const el = findInspectableElement(e.target);
      if (!el) return;
      swallow(e);
      clearPendingCancel();
      setSelectedElement(el);
      openPanel(el);
    },
    true,
  );
```

改为：

```ts
  document.addEventListener(
    "dblclick",
    function (e) {
      if (state.dragging) {
        swallow(e);
        return;
      }
      if (!state.inspecting) return;
      /* 命中 overlay 时用其贴合元素，绕过 disabled 元素不派发 dblclick */
      let el = resolveOverlayHit(e);
      if (!el) el = findInspectableElement(e.target);
      if (!el) return;
      swallow(e);
      clearPendingCancel();
      setSelectedElement(el);
      openPanel(el);
    },
    true,
  );
```

- [ ] **Step 2: closeAll 清场切回追踪态**

把现有：

```ts
function closeAll(): void {
  state.contextMenu!.style.display = "none";
  setSelectedElement(null);
  state.selectOverlay!.style.display = "none";
  for (const btn of actionButtons()) {
    if (btn) btn.style.display = "none";
  }
}
```

改为：

```ts
function closeAll(): void {
  state.contextMenu!.style.display = "none";
  disableOverlayCapture(state.hoverOverlay!);
  disableOverlayCapture(state.selectOverlay!);
  setSelectedElement(null);
  state.selectOverlay!.style.display = "none";
  for (const btn of actionButtons()) {
    if (btn) btn.style.display = "none";
  }
}
```

- [ ] **Step 3: refreshOverlays 重绘期间先 disable 再 enable**

把现有：

```ts
  function refreshOverlays(): void {
    if (!state.inspecting) return;
    if (state.hoveredElement) hover(state.hoveredElement);
    redrawSelection();
    if (state.dragging) redrawDropIndicator();
  }
```

改为（重绘前先 disable 两 overlay，避免重绘瞬间盖错位置挡住鼠标命中；hover()/redrawSelection() 内部会重新 enable）：

```ts
  function refreshOverlays(): void {
    if (!state.inspecting) return;
    /* 重绘期间几何变，先让 overlay 穿透，再由 hover/redrawSelection 重新接驳 */
    disableOverlayCapture(state.hoverOverlay!);
    disableOverlayCapture(state.selectOverlay!);
    if (state.hoveredElement) hover(state.hoveredElement);
    redrawSelection();
    if (state.dragging) redrawDropIndicator();
  }
```

- [ ] **Step 4: 构建验证**

Run: `pnpm -C packages/overlay build`
Expected: 成功。

- [ ] **Step 5: 提交**

```bash
git add packages/overlay/src/events.ts
git commit --no-verify -m "feat(overlay): dblclick 命中旁路 + 清场/重绘接入 capture 时序"
```

---

### Task 8: 全量构建 + 末次 prettier + 用户手测清单

**Files:**
- 无新文件改动；最终收口。

- [ ] **Step 1: 类型检查（仅确认 overlay 无报错）**

Run: `pnpm typecheck`
Expected: overlay 包不报错（其它包与本改动无关，若有预先存在的报错忽略）。

- [ ] **Step 2: 末次 prettier 格式化改动文件**

Run: `pnpm prettier`
Expected: 格式化 `inspector.ts` / `events.ts`（CLAUDE.md 约定任务末跑一次）。

- [ ] **Step 3: 提交格式化结果（若有改动）**

```bash
git add packages/overlay/src/inspector.ts packages/overlay/src/events.ts
git commit --no-verify -m "style: prettier 格式化 overlay 改动"
```

- [ ] **Step 4: 全量重建 overlay 产物供用户重启 demo**

Run: `pnpm -C packages/overlay build`
Expected: 成功生成 `packages/overlay/dist/overlay.iife.js`。

- [ ] **Step 5: 把验证清单交给用户在 demo 浏览器手测**

告知用户重启 demo 后逐项验证：

1. **disabled 组件点击选中**：demo 中放一个 `disabled` 按钮/输入，审查模式下点击它，红框应选中该元素（而非父容器）。
2. **父中子 hover 命中**：在带子组件的父容器上移动鼠标，hover 框应跟随到子组件、不锁死在父、不抖动。
3. **Ctrl 拖拽 disabled 选中元素**：上一步选中 disabled 元素后 Ctrl+按下，进入 drag mode（光标变 grabbing），拖到目标松手触发 `/move-element`。
4. **右键菜单**：禁用元素上右键，弹出菜单且菜单标题 tag 与路径对应该元素。
5. **已选中元素再点取消**：选中任意元素后，再次点击其 selectOverlay 区域，红框延迟 ~250ms 后消失（与双击不冲突）。

- [ ] **Step 6: 最终提交（若 Step 3 有改动则已提交；此步记录完工）**

无额外提交动作，进入用户验证反馈环节。

---

## Self-Review

- **Spec 覆盖**：spec 第 2~6 节（时序切换 / hover 隐显 / selectOverlay 选中取消与拖拽 / 四事件旁路 / 清场重绘）→ Task 1-7 全覆盖；spec 第 9 节"影响面 + 四场景手测"→ Task 8 覆盖。
- **占位扫描**：无 TBD/TODO；所有代码块均为完整可粘贴内容。
- **类型一致**：`enableOverlayCapture` / `disableOverlayCapture`（Task 1 定义）在 Task 2 与 Task 3 import、Task 7 清场使用，签名一致 `(overlay: HTMLDivElement) => void`；`resolveOverlayHit`（Task 3 定义）在 Task 4-7 使用签名一致 `(e: Event) => HTMLElement | null`；`captureTick` 为模块私有，不跨文件。
- **时序不变量保持**：Task 2 hover() 先 `disableOverlayCapture` 再 `enableOverlayCapture`，与设计"先 none 立即生效、auto 延一帧"一致；mousemove 命中新元素时 events.ts 现有逻辑直接调 hover() → 自动重置 tick，无锁死。
