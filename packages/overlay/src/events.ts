/**
 * 全局事件绑定 + 初始化。
 *
 *   mousemove    悬停追踪（跳过操作按钮区域，免闪烁）；drag mode 时更新 drop target
 *   mousedown    拦截所有可审查元素（防文本选区 / 阻断原生控件副作用）；
 *                Ctrl+命中选中元素 → 进入 drag mode
 *   click        菜单关闭 / 复制 / 删除 / 选中切换（detail>=2 让位给 dblclick）
 *   dblclick     命中已选中元素 → 打开属性面板
 *   contextmenu  右键弹出菜单
 *   mouseup      drag mode 提交 /move-element
 *   keydown      Esc 逐级关闭（drag / drawer / panel / 审查）+ 快捷键开关
 *   scroll/resize 重绘 overlay 与 drop indicator
 */
import { state, clientConfig } from "./state";
import {
  findInspectableElement,
  createElement,
  computeDropDirection,
  getLayoutBox,
  parsePosition,
  apiRequest,
} from "./utils";
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
} from "./inspector";
import { showMenu } from "./menu";
import { closePanel, openPanel } from "./panel";
import { closeDrawer } from "./drawer";

/** Heroicons (MIT) 齿轮 SVG path */
const GEAR_SVG = `<svg xmlns="http://www.w3.org/2000/svg"
       width="20" height="20"
       viewBox="0 0 24 24"
       fill="rgb(226, 232, 240)">
    <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
  </svg>`;

/** 单击已选中元素的「取消选中」挂起计时器：等待是否紧跟 dblclick，
 *  避免双击序列里的第一次 click 把红框先收起再亮起 */
let cancelSelectionTimer: ReturnType<typeof setTimeout> | null = null;

/** Ctrl 键是否按住：驱动 body.__vdi-ctrl 类切换，让可审查元素光标变 grab */
let ctrlHeld = false;

/** 操作按钮区域判定：避免 mousemove 在按钮上时切换悬停态造成红框闪烁 */
function isOverActionButton(target: EventTarget | null): boolean {
  for (const btn of [
    state.deleteButton,
    state.copyButton,
    state.insertBeforeButton,
    state.insertAfterButton,
  ]) {
    if (btn && btn.style.display === "flex" && btn.contains(target as Node)) {
      return true;
    }
  }
  return false;
}

/** 彻底拦下事件，不再冒泡且不再触发现存捕获监听器 */
function swallow(e: Event): void {
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();
}

/** 快捷键判定 */
function isShortcut(e: KeyboardEvent): boolean {
  const shortcut = clientConfig.shortcut;
  return (
    !!shortcut.altKey === e.altKey &&
    !!shortcut.shiftKey === e.shiftKey &&
    !!shortcut.ctrlKey === e.ctrlKey &&
    !!shortcut.metaKey === e.metaKey &&
    e.code === shortcut.code
  );
}

/** Esc 关闭的优先级：drag → drawer → panel → 审查 */
function handleEscape(): void {
  clearPendingCancel();
  if (state.dragging) {
    endDrag();
    return;
  }
  if (state.componentDrawer) {
    closeDrawer();
    return;
  }
  if (state.propPanel) {
    closePanel();
    return;
  }
  closeAll();
  toggle(false);
}

/** 审查关闭时清掉所有浮层与选中态。 */
function closeAll(): void {
  state.contextMenu!.style.display = "none";
  state.selectedElement = null;
  state.selectOverlay!.style.display = "none";
  for (const btn of [
    state.deleteButton,
    state.copyButton,
    state.insertBeforeButton,
    state.insertAfterButton,
  ]) {
    if (btn) btn.style.display = "none";
  }
}

function clearPendingCancel(): void {
  if (cancelSelectionTimer) {
    clearTimeout(cancelSelectionTimer);
    cancelSelectionTimer = null;
  }
}

/** 绑定所有事件 + 初始化 UI */
export function init(): void {
  document.addEventListener(
    "mousemove",
    function (e) {
      if (!state.inspecting) return;

      /* drag mode：跟随光标、更新 drop target / 方向 */
      if (state.dragging) {
        const target = findInspectableElement(e.target);
        /* 目标无效 或 目标就是拖拽源本身：清指示器 */
        if (!target || target === state.dragSource) {
          if (state.dropTarget !== null) {
            state.dropTarget = null;
            state.dropDirection = null;
            redrawDropIndicator();
          }
          return;
        }
        const rect = getLayoutBox(target)!.getBoundingClientRect();
        const direction = computeDropDirection(rect, e.clientY);
        if (state.dropTarget !== target || state.dropDirection !== direction) {
          state.dropTarget = target;
          state.dropDirection = direction;
          redrawDropIndicator();
        }
        return;
      }

      const el = findInspectableElement(e.target);
      /* 鼠标在操作按钮上时不触发悬停切换，避免闪烁 */
      if (isOverActionButton(e.target)) return;
      if (el !== state.hoveredElement) {
        state.hoveredElement = el;
        if (el) {
          hover(el);
        } else {
          hide();
        }
      }
    },
    true,
  );

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

  document.addEventListener(
    "click",
    function (e) {
      /* drag mode 中不响应 click：mousedown 已 stopImmediatePropagation，
       兜底再挡一层，防止用户拖到非 inspectable 区域释放触发 click */
      if (state.dragging) {
        swallow(e);
        return;
      }
      /* 点击菜单内部先处理菜单关闭 */
      if (state.contextMenu!.style.display === "block") {
        if (state.contextMenu!.contains(e.target as Node)) {
          state.contextMenu!.style.display = "none";
          return;
        }
        state.contextMenu!.style.display = "none";
      }
      if (!state.inspecting || !state.hoveredElement) return;

      /* 复制按钮 */
      if (
        state.copyButton!.style.display === "flex" &&
        state.copyButton!.contains(e.target as Node)
      ) {
        swallow(e);
        duplicateElement(state.selectedElement!);
        return;
      }
      /* 删除按钮 */
      if (
        state.deleteButton!.style.display === "flex" &&
        state.deleteButton!.contains(e.target as Node)
      ) {
        swallow(e);
        deleteElement(state.selectedElement!);
        return;
      }
      /* 同级插入 + 按钮（上方/下方）— 动作在按钮自身 onclick 中触发，
       捕获阶段只 return，不能 stopImmediatePropagation，
       否则按钮的冒泡阶段 onclick 会被阻断，抽屉打不开 */
      if (isOverActionButton(e.target)) return;

      /* 双击序列中的 click（detail >= 2）：由 dblclick 处理器独占响应，
       避免第二次 click 把选中态切回 null；同时必须阻止冒泡，
       否则原生 checkbox 等会被切换 */
      if (e.detail >= 2) {
        swallow(e);
        return;
      }

      swallow(e);

      /* 命中「已选中元素」的单击：双击的第一击。延迟执行取消选中，
         若 ~250ms 内紧跟 dblclick 则清掉计时器（dblclick 处理器里清），
         避免红框先闪一下再亮起 */
      if (state.selectedElement === state.hoveredElement) {
        clearPendingCancel();
        cancelSelectionTimer = setTimeout(function () {
          cancelSelectionTimer = null;
          state.selectedElement = null;
          redrawSelection();
        }, 250);
        return;
      }

      /* 普通单击：选中一个新元素；若之前挂着未执行的取消计时器，一并清掉 */
      clearPendingCancel();
      state.selectedElement = state.hoveredElement;
      redrawSelection();
    },
    true,
  );

  document.addEventListener(
    "contextmenu",
    function (e) {
      if (!state.inspecting) return;
      const el = findInspectableElement(e.target);
      if (!el) return;
      e.preventDefault();
      state.hoveredElement = el;
      hover(el);
      showMenu(e.clientX, e.clientY, el);
    },
    true,
  );

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
      /* 命中可审查元素：先把所有透传停掉，再走业务分支，
       避免早返回路径漏拦导致宿主原生控件（checkbox 等）状态被切换 */
      swallow(e);
      if (state.selectedElement !== el) {
        state.selectedElement = el;
        redrawSelection();
      }
      /* 双击命中：把尚未到期的「取消选中」挂起任务吞掉，保持红框稳定 */
      clearPendingCancel();
      openPanel(el);
    },
    true,
  );

  /** drag mode 提交：mouseup 在捕获阶段处理，先清场再异步提交 */
  document.addEventListener(
    "mouseup",
    function () {
      const source = state.dragSource;
      const target = state.dropTarget;
      const direction = state.dropDirection;
      /* 提前清场（endDrag），再异步提交；即使提交失败 UI 状态也已恢复 */
      endDrag();
      if (!source || !target || !direction) return;
      const src = parsePosition(source.getAttribute(state.attrName)!);
      const tgt = parsePosition(target.getAttribute(state.attrName)!);
      apiRequest("/move-element", {
        method: "POST",
        body: JSON.stringify({
          file: src.file,
          line: +src.line,
          col: +src.col,
          target: {
            file: tgt.file,
            line: +tgt.line,
            col: +tgt.col,
          },
          direction,
        }),
      }).then(function (response: { success?: boolean; error?: string }) {
        if (response && response.success) {
          console.log(
            "%c[Vue DevInspector]%c 元素已移动",
            "color:#3b82f6;font-weight:bold",
            "color:inherit",
          );
        } else {
          console.warn(
            "[Vue DevInspector] move 失败：",
            (response && response.error) || "未知错误",
          );
        }
      });
    },
    true,
  );

  document.addEventListener("keydown", function (e) {
    if (e.key === "Control" && !ctrlHeld) {
      ctrlHeld = true;
      document.body.classList.add("__vdi-ctrl");
    }
    if (e.code === "Escape") {
      handleEscape();
      return;
    }
    if (isShortcut(e)) {
      e.preventDefault();
      toggle();
    }
  });

  document.addEventListener("keyup", function (e) {
    if (e.key === "Control" && ctrlHeld) {
      ctrlHeld = false;
      document.body.classList.remove("__vdi-ctrl");
    }
  });

  /* 切窗/失焦时清掉 Ctrl 状态，避免持续显示 grab 光标 */
  window.addEventListener("blur", function () {
    if (ctrlHeld) {
      ctrlHeld = false;
      document.body.classList.remove("__vdi-ctrl");
    }
  });

  /* 滚动/缩放时：刷新 hover / 选中框 / drop indicator（drag 中） */
  function refreshOverlays(): void {
    if (!state.inspecting) return;
    if (state.hoveredElement) hover(state.hoveredElement);
    redrawSelection();
    if (state.dragging) redrawDropIndicator();
  }
  window.addEventListener("scroll", refreshOverlays, true);
  window.addEventListener("resize", refreshOverlays);

  /* 启动 */
  createUI();

  /* 右下角齿轮按钮（配置可控） */
  if (clientConfig.toggleBtn) {
    const gearButton = createElement("div", "__vdi-gear-btn");
    gearButton.title = "开启审查模式";
    gearButton.innerHTML = GEAR_SVG;
    gearButton.style = "opacity: 0.7;transform: scale(1)";
    gearButton.onmouseenter = function () {
      gearButton.style.opacity = "1";
      gearButton.style.transform = "scale(1.1)";
    };
    gearButton.onmouseleave = function () {
      gearButton.style.opacity = ".7";
      gearButton.style.transform = "scale(1)";
    };
    gearButton.onclick = function (e) {
      swallow(e);
      toggle();
    };
    document.body.appendChild(gearButton);
    state.gearButton = gearButton;
  }

  console.log(
    "%c[Vue Dev Inspector]%c Ready — Alt+Shift+I to inspect",
    "color:#10b981;font-weight:bold",
    "color:inherit",
  );
}
