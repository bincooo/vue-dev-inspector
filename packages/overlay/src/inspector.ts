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
import { state, setSelectedElement } from "./state";
import {
  parsePosition,
  apiRequest,
  getElementTagName,
  createElement,
  getLayoutBox,
  positionOverlay,
} from "./utils";
import { openDrawer } from "./drawer";

/** 创建所有 UI 浮层并挂到 DOM */
export function createUI(): void {
  const hoverOverlay = createElement("div", "__vdi-hover-overlay");
  const selectOverlay = createElement("div", "__vdi-select-overlay");
  const tagTip = createElement("div", "__vdi-tag-tip");
  const contextMenu = createElement("div", "__vdi-context-menu");

  const deleteButton = createElement(
    "div",
    "__vdi-action-btn __vdi-delete-btn",
    "×",
  );
  deleteButton.onmouseenter = () => (deleteButton.style.background = "#dc2626");
  deleteButton.onmouseleave = () => (deleteButton.style.background = "#ef4444");

  const copyButton = createElement(
    "div",
    "__vdi-action-btn __vdi-copy-btn",
    "⧉",
  );
  copyButton.onmouseenter = () => (copyButton.style.background = "#2563eb");
  copyButton.onmouseleave = () => (copyButton.style.background = "#3b82f6");

  const insertBeforeButton = makeInsertButton(() => openDrawer("before"));
  insertBeforeButton.title = "在同级上方插入组件";
  const insertAfterButton = makeInsertButton(() => openDrawer("after"));
  insertAfterButton.title = "在同级下方插入组件";

  const dropIndicator = createElement("div", "__vdi-drop-indicator");
  dropIndicator.style.display = "none";

  /* appendChild 批量挂载 + state 一次性灌引用，避免重复 list */
  const layers: Record<string, HTMLDivElement> = {
    hoverOverlay,
    selectOverlay,
    tagTip,
    contextMenu,
    deleteButton,
    copyButton,
    insertBeforeButton,
    insertAfterButton,
    dropIndicator,
  };
  Object.values(layers).forEach((layer) => document.body.appendChild(layer));
  Object.assign(state, layers);
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
  const pos = parsePosition(element.getAttribute(state.attrName)!);
  apiRequest("/duplicate-element", {
    method: "POST",
    body: JSON.stringify({ file: pos.file, line: +pos.line, col: +pos.col }),
  }).then(function (response) {
    if (response && response.success)
      console.log(
        "%c[Vue DevInspector]%c 元素已复制",
        "color:#3b82f6;font-weight:bold",
        "color:inherit",
      );
  });
}

/** 删除元素 */
export function deleteElement(element: HTMLElement): void {
  const pos = parsePosition(element.getAttribute(state.attrName)!);
  const tag = getElementTagName(element);
  apiRequest("/delete-element", {
    method: "POST",
    body: JSON.stringify({
      file: pos.file,
      line: +pos.line,
      col: +pos.col,
      tag,
    }),
  }).then(function () {
    if (state.selectedElement === element) {
      setSelectedElement(null);
      redrawSelection();
    }
    element.remove();
  });
}

/** 4 个动作按钮共用同一份显示状态 */
function setActionButtonsVisible(visible: boolean): void {
  for (const btn of [
    state.deleteButton,
    state.copyButton,
    state.insertBeforeButton,
    state.insertAfterButton,
  ]) {
    if (btn) btn.style.display = visible ? "flex" : "none";
  }
}

/** 定位 复制/删除 按钮到选中框右下角；定位 +/- 同级插入按钮到上下边框中点 */
export function positionActionButtons(): void {
  if (
    !state.selectedElement ||
    !state.selectOverlay ||
    state.selectOverlay.style.display === "none"
  ) {
    setActionButtonsVisible(false);
    return;
  }
  const r = getLayoutBox(state.selectedElement)!.getBoundingClientRect();
  /* 复制/删除：右下角（复制偏左 18px） */
  state.deleteButton!.style.display = "flex";
  state.deleteButton!.style.left = r.right - 18 + "px";
  state.deleteButton!.style.top = r.bottom - 18 + "px";
  state.copyButton!.style.display = "flex";
  state.copyButton!.style.left = r.right - 36 + "px";
  state.copyButton!.style.top = r.bottom - 18 + "px";
  /* ± 插入：上下边框中点 */
  state.insertBeforeButton!.style.display = "flex";
  state.insertBeforeButton!.style.left = r.left + r.width / 2 - 9 + "px";
  state.insertBeforeButton!.style.top = r.top - 9 + "px";
  state.insertAfterButton!.style.display = "flex";
  state.insertAfterButton!.style.left = r.left + r.width / 2 - 9 + "px";
  state.insertAfterButton!.style.top = r.bottom - 9 + "px";
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
}

/**
 * 按 state.dropTarget / state.dropDirection 重绘放置指示器。
 * 空 → 隐藏；before/after → 2px 蓝线；inside → 黄色虚线内框。
 */
export function redrawDropIndicator(): void {
  const indicator = state.dropIndicator;
  if (!indicator) return;
  const target = state.dropTarget;
  const dir = state.dropDirection;
  if (!target || !dir) {
    indicator.style.display = "none";
    return;
  }
  const rect = getLayoutBox(target)!.getBoundingClientRect();
  indicator.className = "__vdi-drop-indicator __vdi-drop-indicator--" + dir;
  if (dir === "before" || dir === "after") {
    indicator.style.display = "block";
    indicator.style.left = rect.left - 2 + "px";
    indicator.style.top = (dir === "before" ? rect.top : rect.bottom) - 1 + "px";
    indicator.style.width = rect.width + 4 + "px";
    indicator.style.height = "2px";
  } else {
    indicator.style.display = "block";
    indicator.style.left = rect.left - 2 + "px";
    indicator.style.top = rect.top - 2 + "px";
    indicator.style.width = rect.width + 4 + "px";
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
