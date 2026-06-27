/**
 * 审查层 — overlay UI 创建与状态机。
 *
 *   createUI              创建所有固定定位的浮层（悬停框/选中框/标签/菜单/删除/复制按钮）
 *   duplicateElement      复制选中元素（调 /duplicate-element，AST 同级副本）
 *   deleteElement         删除选中元素（调 /delete-element）
 *   positionActionButtons 定位「复制 / 删除」两按钮到选中框右下角
 *   hover                 悬停时更新虚线框与标签
 *   hide                  收起悬停态
 *   redrawSelection       重绘选中框 + 联动按钮显隐
 *   toggle                开关审查模式（关时清一切浮层，含 copyButton）
 */
import { state } from "./state";
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
  deleteButton.onmouseenter = function () {
    deleteButton.style.background = "#dc2626";
  };
  deleteButton.onmouseleave = function () {
    deleteButton.style.background = "#ef4444";
  };
  const copyButton = createElement(
    "div",
    "__vdi-action-btn __vdi-copy-btn",
    "⧉",
  );
  copyButton.onmouseenter = function () {
    copyButton.style.background = "#2563eb";
  };
  copyButton.onmouseleave = function () {
    copyButton.style.background = "#3b82f6";
  };

  /* 上方/下方同级插入按钮 */
  const insertBeforeButton = createInsertButton();
  insertBeforeButton.title = "在同级上方插入组件";
  insertBeforeButton.onclick = function (e) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    openDrawer("before");
  };
  const insertAfterButton = createInsertButton();
  insertAfterButton.title = "在同级下方插入组件";
  insertAfterButton.onclick = function (e) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    openDrawer("after");
  };
  [
    hoverOverlay,
    selectOverlay,
    tagTip,
    contextMenu,
    deleteButton,
    copyButton,
    insertBeforeButton,
    insertAfterButton,
  ].forEach(function (layer) {
    document.body.appendChild(layer);
  });

  state.hoverOverlay = hoverOverlay;
  state.selectOverlay = selectOverlay;
  state.tagTip = tagTip;
  state.contextMenu = contextMenu;
  state.deleteButton = deleteButton;
  state.copyButton = copyButton;
  state.insertBeforeButton = insertBeforeButton;
  state.insertAfterButton = insertAfterButton;
}

/** 构造一个 + 插入按钮 */
function createInsertButton(): HTMLDivElement {
  return createElement("div", "__vdi-insert-btn", "+");
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
      state.selectedElement = null;
      redrawSelection();
    }
    element.remove();
  });
}

/** 定位 复制/删除 按钮到选中框右下角；定位 +/- 同级插入按钮到上下边框中点 */
export function positionActionButtons(): void {
  if (
    !state.selectedElement ||
    !state.selectOverlay ||
    state.selectOverlay.style.display === "none"
  ) {
    hideAllActionButtons();
    return;
  }
  const selectionRect = getLayoutBox(
    state.selectedElement,
  )!.getBoundingClientRect();
  /* 复制/删除：右下角 */
  state.deleteButton!.style.display = "flex";
  state.deleteButton!.style.left = selectionRect.right - 18 + "px";
  state.deleteButton!.style.top = selectionRect.bottom - 18 + "px";
  state.copyButton!.style.display = "flex";
  state.copyButton!.style.left = selectionRect.right - 36 + "px";
  state.copyButton!.style.top = selectionRect.bottom - 18 + "px";
  /* 同级插入：上边框中点 / 下边框中点 */
  state.insertBeforeButton!.style.display = "flex";
  state.insertBeforeButton!.style.left =
    selectionRect.left + selectionRect.width / 2 - 9 + "px";
  state.insertBeforeButton!.style.top = selectionRect.top - 9 + "px";
  state.insertAfterButton!.style.display = "flex";
  state.insertAfterButton!.style.left =
    selectionRect.left + selectionRect.width / 2 - 9 + "px";
  state.insertAfterButton!.style.top = selectionRect.bottom - 9 + "px";
}

/** 隐藏全部操作按钮（删除/复制/同级上下插入） */
function hideAllActionButtons(): void {
  state.deleteButton!.style.display = "none";
  state.copyButton!.style.display = "none";
  state.insertBeforeButton!.style.display = "none";
  state.insertAfterButton!.style.display = "none";
}

/** 悬停态 */
export function hover(element: HTMLElement): void {
  if (!element || !state.hoverOverlay) return;
  if (element === state.selectedElement)
    state.hoverOverlay.style.display = "none";
  else positionOverlay(state.hoverOverlay, element, 1);
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

/** 选中框重绘 */
export function redrawSelection(): void {
  if (!state.selectOverlay) return;
  if (state.selectedElement && document.body.contains(state.selectedElement)) {
    positionOverlay(state.selectOverlay, state.selectedElement, 1);
    positionActionButtons();
  } else {
    state.selectOverlay.style.display = "none";
    hideAllActionButtons();
    state.selectedElement = null;
  }
}

/** 审查开关 */
export function toggle(force?: boolean): void {
  state.inspecting = force !== undefined ? force : !state.inspecting;
  if (!state.inspecting) {
    hide();
    state.selectedElement = null;
    state.selectOverlay!.style.display = "none";
    hideAllActionButtons();
  }
  /* 齿轮按钮：审查开启时隐藏，关闭时显示 */
  if (state.gearButton)
    state.gearButton.style.display = state.inspecting ? "none" : "flex";
}
