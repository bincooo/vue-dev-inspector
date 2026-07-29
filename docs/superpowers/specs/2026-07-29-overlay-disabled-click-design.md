# overlay disabled 元素点击 / 右键接管 - 设计文档

> 日期：2026-07-29
> 范围：`packages/overlay/src/{inspector.ts, events.ts}`
> 目标：让带 `disabled` 属性的元素仍可被审查层点击选中、右键菜单、Ctrl 拖拽、双击编辑属性，且不引入 hover 抖动、不干扰父组件中子组件的 hover 命中。

## 一、问题

带 `disabled` 的元素（`<button disabled>`、`a-button[disabled]`、`a-input[disabled]`）按浏览器规范不派发 `click` / `mousedown` / `contextmenu` / `dblclick`。

现有 `document` 捕获监听靠 `findInspectableElement(e.target)` 向上冒泡查找被审查元素：
- 点不中：disabled 元素根本不冒泡这些事件。
- 误选父元素：事件被父节点"代收"，`e.target` 可能是父容器，`findInspectableElement` 命中父组件而非用户视觉上 hover 的 disabled 子元素。

## 二、核心机制：hoverOverlay / selectOverlay 的 pointer-events 时序切换

两个 overlay 本体由 CSS 静态声明 `pointer-events: none`，运行时通过 JS 在两个状态间切换：

| 状态 | pointer-events | 作用 |
|---|---|---|
| **追踪态** | `none` | 鼠标可穿透 overlay 命中下方元素，hover / mousemove 正常更新 `hoveredElement` |
| **接驳态** | `auto` | overlay 接住 click / mousedown / contextmenu / dblclick，绕过 disabled 拦截 |

**默认 = 追踪态**（`none`）。仅在 hover 稳定后才短暂切到接驳态。

### 时序（hoveredElement 从 A 切到 B）

```
mousemove 命中 B (hoveredElement 变化)
  -> hoverOverlay 立即切 pointer-events:none  （强制重新走命中判定）
  -> 立即定位 hoverOverlay 到 B （沿用现 hover() 的 positionOverlay）
  -> 下一帧 rAF -> hoverOverlay 切 pointer-events:auto （接住后续点击）
```

### 抖动防御

- overlay 只在"超前/滞后一帧 none -> auto"切换。
- 过渡那一帧鼠标从穿透命中下移到 overlay，但此时 overlay 已贴合到新 B，鼠标仍落在 B 的盒区。
- `findInspectableElement` 只对带 `data-source-file` 的真实被审查元素响应，overlay 自身无此属性，不会被误判。
- 父组件中子组件的 hover 不受干扰：mouse move 到子组件时 `findInspectableElement` 正常向上找到子组件（overlay 切 none 让鼠标穿透），不会"锁死"在父组件。

## 三、状态管理：新增 enableOverlayCapture / disableOverlayCapture

集中放在 `inspector.ts`，不新增 state 字段。

```ts
/** rAF 帧号，保证中途取消不重叠 */
let hoverPointerTick = 0;

/** 把 overlay 从"追踪 none"切到"接驳 auto"--仅在 hover 稳定后，下一帧生效 */
function enableOverlayCapture(overlay: HTMLDivElement): void {
  cancelOverlayCapture(overlay);
  const tick = ++hoverPointerTick;
  requestAnimationFrame(() => {
    if (tick !== hoverPointerTick) return; // 被后续取消
    overlay.style.pointerEvents = "auto";
  });
}

/** overlay 切回追踪态（none），并取消挂起的 rAF */
function disableOverlayCapture(overlay: HTMLDivElement): void {
  ++hoverPointerTick; // 作废挂起的 enable
  overlay.style.pointerEvents = "none";
}
```

### hover() / hide() / redrawSelection() 改写

- `hover(el)`：定位 hoverOverlay 到 el -> `disableOverlayCapture` -> `enableOverlayCapture`（先 none 立即生效，auto 延一帧）。
- `hide()`：直接 `disableOverlayCapture`。
- `redrawSelection()`：选中稳定 -> 对 selectOverlay `enableOverlayCapture`；选中取消 -> `disableOverlayCapture`。

## 四、selectOverlay 处理"已选中元素再点击取消 / Ctrl 拖拽"

selectOverlay 也走同样时序切换：

- `setSelectedElement(el)` 后 `redrawSelection()` 内对 selectOverlay `enableOverlayCapture`，使 disabled 元素被选中后再次点击 overlay 能命中并走"取消选中"分支。
- Ctrl + mousedown 命中 overlay：在 mousedown capture 里识别 `e.target === selectOverlay`，直接用 `state.selectedElement` 交给现有 `startDrag` 逻辑。

## 五、事件改写（events.ts）

`document` 上的 click / contextmenu / mousedown / dblclick **全部保留**（兜底非 disabled 元素正常冒泡路径不变）。**新增 target 命中 overlay 的旁路**：

### 命中解析

```ts
function resolveOverlayHit(e: Event): HTMLElement | null {
  const t = e.target as HTMLElement | null;
  if (t === state.hoverOverlay) return state.hoveredElement;
  if (t === state.selectOverlay) return state.selectedElement;
  return null;
}
```

### 各事件分支

- **click**：命中 hoverOverlay -> 用 `hoveredElement` 走"选中 / 取消选中"分支；命中 selectOverlay -> 走"已选中元素再点击取消"分支。
- **mousedown**：命中 selectOverlay + Ctrl -> `startDrag(state.selectedElement)`。
- **contextmenu**：命中 overlay -> 用对应元素 `showMenu`，不依赖 `e.target` 冒泡。
- **dblclick**：命中 overlay -> `openPanel`。

### 防止 overlay 事件冒泡到 document 触发重复处理

overlay 的事件分支 `swallow(e)` 后 return，不进下面的冒泡兜底逻辑。

## 六、清场场景

- `toggle(false)` / `closeAll()` / `hide()`：两 overlay 一并 `disableOverlayCapture`。
- `scroll` / `resize` 重绘：**先 disable（让出），几何重算后再 enable**，避免重绘瞬间 overlay 盖错位置又挡住鼠标。

## 七、CSS 改动

`overlay.css` 里两条保持现状（默认 `pointer-events: none`），JS 内联覆盖切换。**零 CSS 改动**。

## 八、不变量

- `findInspectableElement` 仍只对真实被审查元素响应，overlay 自身在它向上的 parent 链里不具 `data-source-file`，不会被误判。
- 现有"操作按钮区域 `isOverActionButton` 早退"逻辑不变：按钮 `pointer-events: auto` 高于 overlay，鼠标到了按钮 `e.target = 按钮`先处理。
- Ctrl + 拖拽进入 drag mode 后 overlay 透明且 capture 态，drag 用的是 `selectOverlay.opacity: 0.35` 提示--drag 期间 selectOverlay 保持当前态不动（drag 不改 hover）。

## 九、影响面

- 仅改 `packages/overlay/src/{inspector.ts, events.ts}`，加 < 30 行。
- CSS 零改。
- 不动 server / pluginkit。
- 改完按 CLAUDE.md 约定要重建 overlay 源码产物后由用户重启 demo 验证：
  1. disabled 组件点击选中
  2. 父中子 hover 命中
  3. Ctrl 拖拽
  4. 右键菜单
