/**
 * 审查层 — overlay UI 创建与状态机。
 *
 *   createUI              创建所有固定定位浮层（hover/select/tag/menu/复制/删除/±/drop indicator）
 *   duplicateElement      复制选中元素（调 /duplicate-element）
 *   deleteElement         删除选中元素（调 /delete-element）
 *   positionActionButtons 定位「复制/删除」两按钮与「± 同级插入」两按钮
 *   hover / hide          hover-overlay 显隐
 *   redrawSelection       重绘选中框 + 联动按钮
 *   toggle                开关审查模式
 *   redrawDropIndicator   拖拽中按 dropTarget/dropDirection 重绘放置指示器
 *   startDrag / endDrag   drag mode 进出
 */
import { state, actionButtons, setSelectedElement } from "./state";
import {
  parsePosition,
  apiRequest,
  createElement,
  formatPosition,
  getElementTagName,
  getLayoutBox,
  positionOverlay,
  logInfo,
  logError,
  errMsg,
} from "./utils";
import { openDrawer } from "./comp-drawer";
import { deleteElementViaApi } from "./menu";
import { emitInspect } from "./extensibility";
import { renderIcon } from "./icon";

/** 创建所有 UI 浮层并挂到 DOM */
export function createUI(): void {
  state.hoverOverlay = createElement<HTMLDivElement>(
    "div",
    "__vdi-hover-overlay",
  );
  state.selectOverlay = createElement<HTMLDivElement>(
    "div",
    "__vdi-select-overlay",
  );
  state.tagTip = createElement<HTMLDivElement>("div", "__vdi-tag-tip");
  state.contextMenu = createElement<HTMLDivElement>(
    "div",
    "__vdi-context-menu",
  );
  state.deleteButton = createActionBtn(
    "__vdi-action-btn __vdi-delete-btn",
    "×",
    "#dc2626",
    "#ef4444",
    "删除组件",
  );
  state.copyButton = createActionBtn(
    "__vdi-action-btn __vdi-copy-btn",
    "⧉",
    "#2563eb",
    "#3b82f6",
    "复制组件",
  );
  state.insertBeforeButton = makeInsertButton(() => openDrawer("before"));
  state.insertBeforeButton.title = "在同级上方插入组件";
  state.insertAfterButton = makeInsertButton(() => openDrawer("after"));
  state.insertAfterButton.title = "在同级下方插入组件";
  state.dropIndicator = createElement<HTMLDivElement>(
    "div",
    "__vdi-drop-indicator",
  );
  state.dropIndicator.style.display = "none";

  for (const el of [
    state.hoverOverlay,
    state.selectOverlay,
    state.tagTip,
    state.contextMenu,
    state.deleteButton,
    state.copyButton,
    state.insertBeforeButton,
    state.insertAfterButton,
    state.dropIndicator,
  ]) {
    if (el) document.body.appendChild(el);
  }
}

/** 构造一个固定定位小按钮，hover 切换背景色。 */
function createActionBtn(
  className: string,
  text: string,
  hoverColor: string,
  baseColor: string,
  title?: string,
): HTMLDivElement {
  const btn = createElement("div", className, text);
  if (title) {
    btn.title = title;
  }
  btn.onmouseenter = () => (btn.style.background = hoverColor);
  btn.onmouseleave = () => (btn.style.background = baseColor);
  return btn;
}

/** 构造一个 + 同级插入按钮 */
function makeInsertButton(onClick: () => void): HTMLDivElement {
  const btn = createElement("div", "__vdi-insert-btn", "+");
  btn.onclick = function (e) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    onClick();
  };
  return btn;
}

/** 复制元素 */
export function duplicateElement(element: HTMLElement): void {
  const pos = parsePosition(element.getAttribute(state.attrName)!)!;
  apiRequest("/duplicate-element", {
    method: "POST",
    body: JSON.stringify({
      file: formatPosition(pos),
      line: +pos.line,
      col: +pos.col,
    }),
  })
    .then((response) => {
      if (response && response.success) logInfo("元素已复制");
    })
    .catch((e: unknown) => {
      logError("复制失败", errMsg(e));
    });
}

/** 删除元素 — 服务端写盘后由 HMR 重渲染，本函数只清审查层选中态。 */
export function deleteElement(element: HTMLElement): void {
  void deleteElementViaApi(element);
}

/** 选中框旁的 4 个动作按钮同步显隐。 */
function setActionButtonsVisible(visible: boolean): void {
  for (const btn of actionButtons()) {
    if (btn) btn.style.display = visible ? "flex" : "none";
  }
}

/** 定位 复制/删除 按钮到选中框右下角；定位 +/- 同级插入按钮到上下边框中点；工具按钮沿复制按钮向左排开 */
export function positionActionButtons(): void {
  if (!state.selectedElement) {
    setActionButtonsVisible(false);
    return;
  }
  if (!state.selectOverlay || state.selectOverlay.style.display === "none") {
    setActionButtonsVisible(false);
    return;
  }
  const r = getLayoutBox(state.selectedElement)!.getBoundingClientRect();
  const del = state.deleteButton!;
  const cp = state.copyButton!;
  const before = state.insertBeforeButton!;
  const after = state.insertAfterButton!;

  const half = 7;

  del.style.display = "flex";
  del.style.left = r.right - 18 + "px";
  del.style.top = r.bottom - 18 + "px";
  cp.style.display = "flex";
  cp.style.left = r.right - 36 + "px";
  cp.style.top = r.bottom - 18 + "px";
  before.style.display = "flex";
  before.style.left = r.left + r.width / 2 - half + "px";
  before.style.top = r.top - half + "px";
  after.style.display = "flex";
  after.style.left = r.left + r.width / 2 - half + "px";
  after.style.top = r.bottom - half + "px";
  // 工具按钮：与复制按钮同行，沿用 18px 步长向左排列
  state.toolButtonsEls.forEach((btn, i) => {
    btn.style.display = "flex";
    btn.style.left = r.right - 36 - (i + 1) * 18 + "px";
    btn.style.top = r.bottom - 18 + "px";
  });
}

// ─── 自定义工具按钮（注册式） ────────────────────────────────

/** 与 __vdi-copy-btn 一致的默认配色，保持视觉风格统一。 */
const DEFAULT_TOOL_BASE = "#3b82f6";
const DEFAULT_TOOL_HOVER = "#2563eb";

/** 把当前所有 toolButtons 渲染为与复制/删除按钮同行的 action-btn。空集合直接返回。 */
export function renderToolButtons(selectedEl: HTMLElement): void {
  clearToolButtons();
  if (state.toolButtons.size === 0) return;

  for (const def of state.toolButtons.values()) {
    const btn = createElement<HTMLDivElement>(
      "div",
      "__vdi-action-btn __vdi-tool-btn",
    );
    // icon 支持 emoji / 短文本 / iconify(`i-prefix:name`) / 内联 SVG，
    // 与抽屉一致走 renderIcon；iconify 未命中缓存或 fetch 失败时用 label
    // 首字符占位（label 恒为字符串，空串/空白回退 "•"）。
    const iconFallback = (def.label && def.label.trim().charAt(0)) || "•";
    renderIcon(btn, def.icon, iconFallback);
    btn.title = def.label;
    btn.setAttribute("data-tool-btn-id", def.id);
    btn.onmouseenter = () =>
      (btn.style.background = def.hoverColor ?? DEFAULT_TOOL_HOVER);
    btn.onmouseleave = () =>
      (btn.style.background = def.baseColor ?? DEFAULT_TOOL_BASE);
    btn.onclick = (ev) => {
      ev.stopPropagation();
      const raw = selectedEl.getAttribute(state.attrName);
      const parsed = raw ? parsePosition(raw) : null;
      def.onClick({
        kind: "select",
        at: Date.now(),
        target: selectedEl,
        source: parsed
          ? {
              rootIndex: parsed.rootIndex,
              file: parsed.file,
              line: Number(parsed.line),
              col: Number(parsed.col),
            }
          : null,
      });
    };
    state.toolButtonsEls.push(btn);
    document.body.appendChild(btn);
  }

  positionActionButtons();
}

/** 卸载所有工具按钮 DOM；保留 Map 注册表以便下次选中时重新渲染。 */
export function clearToolButtons(): void {
  for (const el of state.toolButtonsEls) {
    el.remove();
  }
  state.toolButtonsEls.length = 0;
}

/** 悬停态 */
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

/** 收起悬停态 */
export function hide(): void {
  state.hoverOverlay!.style.display = "none";
  state.tagTip!.style.display = "none";
  state.hoveredElement = null;
}

/** 选中框重绘（节点不在 DOM 时一并清掉选中态） */
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

/** 审查开关 */
export function toggle(force?: boolean): void {
  state.inspecting = force !== undefined ? force : !state.inspecting;
  if (!state.inspecting) {
    hide();
    setSelectedElement(null);
    state.selectOverlay!.style.display = "none";
    setActionButtonsVisible(false);
    if (state.dragging) endDrag();
  }
  if (state.gearButton)
    state.gearButton.style.display = state.inspecting ? "none" : "flex";

  if (state.inspecting) {
    emitInspect();
  } else if (state.selectedElement) {
    setSelectedElement(null);
  }
}

/**
 * 按 state.dropTarget / state.dropDirection 重绘放置指示器。
 * 空 → 隐藏；before/after → 2px 蓝线；inside → 黄色虚线内框。
 */
export function redrawDropIndicator(): void {
  const target = state.dropTarget;
  const dir = state.dropDirection;
  if (!target || !dir) {
    if (state.dropIndicator) state.dropIndicator.style.display = "none";
    return;
  }
  const rect = getLayoutBox(target)!.getBoundingClientRect();
  const indicator = state.dropIndicator!;
  indicator.className = "__vdi-drop-indicator __vdi-drop-indicator--" + dir;
  indicator.style.display = "block";
  indicator.style.left = rect.left - 2 + "px";
  indicator.style.width = rect.width + 4 + "px";
  if (dir === "before" || dir === "after") {
    indicator.style.top =
      (dir === "before" ? rect.top : rect.bottom) - 1 + "px";
    indicator.style.height = "2px";
  } else {
    indicator.style.top = rect.top - 2 + "px";
    indicator.style.height = rect.height + 4 + "px";
  }
}

/** 退出 drag mode：清 drop indicator / dragSource（不改动 selectedElement） */
export function endDrag(): void {
  state.dragging = false;
  state.dragSource = null;
  state.dropTarget = null;
  state.dropDirection = null;
  if (state.dropIndicator) state.dropIndicator.style.display = "none";
  document.body.classList.remove("__vdi-dragging");
  if (state.selectOverlay) state.selectOverlay.style.opacity = "1";
}

/** 进入 drag mode：调暗原 select overlay，源由调用方传入 */
export function startDrag(source: HTMLElement): void {
  state.dragging = true;
  state.dragSource = source;
  document.body.classList.add("__vdi-dragging");
  if (state.selectOverlay) state.selectOverlay.style.opacity = "0.35";
}
