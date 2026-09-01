/**
 * 全局事件绑定 + 初始化。
 *
 *   mousemove    悬停追踪（跳过操作按钮区域，免闪烁）；drag mode 时更新 drop target
 *   mousedown    拦截所有可审查元素（防文本选区 / 阻断原生控件副作用）；
 *                Ctrl+命中选中元素 → 进入 drag mode
 *   click        菜单关闭 / 复制 / 删除 / 选中切换（detail>=2 让位给 dblclick）
 *   dblclick     命中已选中元素 → 打开属性面板
 *   contextmenu  右键弹出菜单（命中可审查元素时完整拦截不透传宿主监听器；
 *                菜单可见时右键菜单自身 = 关闭菜单不穿透）
 *   mouseup      drag mode 提交 /move-element
 *   keydown      Esc 逐级关闭（drag / drawer / panel / 审查）+ 快捷键开关
 *   scroll/resize 重绘 overlay 与 drop indicator
 */
import {
  state,
  clientConfig,
  actionButtons,
  setSelectedElement,
} from './state';
import {
  findInspectableElement,
  createElement,
  computeDropDirection,
  getLayoutBox,
  parsePosition,
  apiRequest,
  formatPosition,
  logInfo,
  logSuccess,
  apiError,
} from './utils';
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
} from './inspector';
import { showMenu } from './menu';
import { closePanel, openPanel } from './panel';
import { closeDrawer } from './panel/comp-drawer';
import { closeCodeDrawer } from './panel/code-drawer';

/** Heroicons (MIT) 齿轮 SVG path */
const GEAR_SVG = `<svg xmlns="http://www.w3.org/2000/svg"
       width="20" height="20"
       viewBox="0 0 24 24"
       fill="rgb(226, 232, 240)">
    <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
  </svg>`;

/** 把 user-config 的 shortcut 翻成可读的展示字符串，例如 "Alt+Shift+I"。 */
function formatShortcut(s: typeof clientConfig.shortcut): string {
  return [
    s.altKey && 'Alt',
    s.shiftKey && 'Shift',
    s.ctrlKey && 'Ctrl',
    s.metaKey && 'Meta',
    s.code.replace(/^Key/, ''),
  ]
    .filter(Boolean)
    .join('+');
}

/** 单击已选中元素的「取消选中」挂起计时器：等待是否紧跟 dblclick，
 *  避免双击序列里的第一次 click 把红框先收起再亮起 */
let cancelSelectionTimer: ReturnType<typeof setTimeout> | null = null;

/** Ctrl 键是否按住：驱动 body.__vdi-ctrl 类切换，让可审查元素光标变 grab */
function setCtrlHeld(active: boolean): void {
  document.body.classList.toggle('__vdi-ctrl', active);
}

/** 操作按钮区域判定：避免 mousemove 在按钮上时切换悬停态造成红框闪烁 */
function isOverActionButton(target: EventTarget | null): boolean {
  for (const btn of actionButtons()) {
    if (btn && btn.style.display === 'flex' && btn.contains(target as Node)) {
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

/** 判断 e.target 是否为 overlay 自身（pointer-events:auto 时） */
function isOverlayTarget(target: EventTarget | null): boolean {
  return target === state.hoverOverlay || target === state.selectOverlay;
}

/** 用 elementsFromPoint 穿透 overlay 找下方真实可审查元素 */
function findElementUnderOverlay(x: number, y: number): HTMLElement | null {
  for (const el of document.elementsFromPoint(x, y)) {
    const node = el as HTMLElement;
    if (
      node.id === '__vdi-overlay-style__' ||
      node === document.documentElement ||
      node === document.body
    )
      continue;
    if (
      typeof node.className === 'string' &&
      node.className.startsWith('__vdi-')
    )
      continue;
    /* 统一走 findInspectableElement：它会在祖先链上优先返回 portal 根
     （a-modal / a-drawer），避免点到内部 <p> 时短路返回子节点 */
    const inspected = findInspectableElement(node);
    if (inspected) return inspected;
  }
  return null;
}

/** 从鼠标事件解析命中元素：overlay -> 穿透；否则 -> 直接查找 */
function resolveHitElement(e: MouseEvent): HTMLElement | null {
  return isOverlayTarget(e.target)
    ? findElementUnderOverlay(e.clientX, e.clientY)
    : findInspectableElement(e.target);
}

/** wheel 透传：找到下方可滚动容器手动滚动，再刷新 overlay 定位 */
function forwardWheel(e: WheelEvent): void {
  const under = findElementUnderOverlay(e.clientX, e.clientY);
  if (!under) return;
  let scroller: HTMLElement | null = under;
  while (scroller && scroller !== document.documentElement) {
    const style = getComputedStyle(scroller);
    if (
      (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
      scroller.scrollHeight > scroller.clientHeight
    ) {
      scroller.scrollTop += e.deltaY;
      e.preventDefault();
      return;
    }
    scroller = scroller.parentElement;
  }
  window.scrollBy(0, e.deltaY);
  e.preventDefault();
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

/** Esc 关闭的优先级：drag → drawer → code-drawer → panel → 审查 */
function handleEscape(): void {
  clearPendingCancel();
  if (state.dragging) return endDrag();
  if (state.componentDrawer) return closeDrawer();
  if (state.codeDrawer) return closeCodeDrawer();
  if (state.propPanel) return closePanel();
  closeAll();
  toggle(false);
}

/**
 * 落焦时把宿主抽屉全局 focus-trap 与 overlay 浮层隔离。
 *
 * 宿主 antdv-next 的 a-drawer / a-modal 等通过 @v-c/util 的 useLockFocus
 * 在 window focusin / keydown 上注册全局回调（focus-trap + 焦点回拉）。
 * overlay 的顶层浮层都是 body 上的独立 div，处于宿主抽屉 DOM 之外，
 * 浮层内 input 的 focusin 冒泡到 window 后会被 syncFocus 立即抢回
 * 抽屉内的第一个可聚焦节点，造成「浮层内无法输入字符」的 bug
 * （其他场景无第三方焦点陷阱，故正常）。
 *
 * 这里在 capture 阶段对所有已打开顶层浮层（prop panel / 编辑代码抽屉 /
 * 组件抽屉 / 属性选择抽屉 / CodeSetter 弹窗）子树内的 focusin 调用
 * stopImmediatePropagation，拦截后续同 capture 阶段的抽屉回调；input
 * 本身的 input / beforeinput 事件流不受影响，输入恢复正常。
 * 新增顶层浮层时需把宿主元素加进下方 guards 列表（state 上有对应字段）。
 *
 * 浮层外的 focusin 不会被拦截，原有焦点行为不变。
 */
window.addEventListener(
  'focusin',
  (e) => {
    if (!(e.target instanceof Node)) return;
    const guards = [
      state.propPanel,
      state.codeDrawer,
      state.componentDrawer,
      state.attrDrawer,
      state.codePopout,
    ];
    for (const g of guards) {
      if (g && g.contains(e.target)) {
        e.stopImmediatePropagation();
        return;
      }
    }
  },
  true,
);

/** 审查关闭时清掉所有浮层与选中态。 */
function closeAll(): void {
  state.contextMenu!.style.display = 'none';
  setSelectedElement(null);
  state.selectOverlay!.style.display = 'none';
  for (const btn of actionButtons()) {
    if (btn) btn.style.display = 'none';
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
    'mousemove',
    function (e) {
      if (!state.inspecting) return;

      /* drag mode：跟随光标、更新 drop target / 方向 */
      if (state.dragging) {
        const target = resolveHitElement(e);
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
        const dropDir = computeDropDirection(rect, e.clientY);
        if (state.dropTarget !== target || state.dropDirection !== dropDir) {
          state.dropTarget = target;
          state.dropDirection = dropDir;
          redrawDropIndicator();
        }
        return;
      }

      const el = resolveHitElement(e);
      /* 鼠标在操作按钮上时不触发悬停切换，避免闪烁 */
      if (isOverActionButton(e.target)) return;
      if (el !== state.hoveredElement) {
        state.hoveredElement = el;
        if (el) hover(el);
        else hide();
      }
    },
    true,
  );

  document.addEventListener(
    'mousedown',
    function (e) {
      if (!state.inspecting) return;
      const target = resolveHitElement(e);
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
    'click',
    function (e) {
      /* drag mode 中不响应 click：mousedown 已 stopImmediatePropagation，
       兜底再挡一层，防止用户拖到非 inspectable 区域释放触发 click */
      if (state.dragging) {
        swallow(e);
        return;
      }
      /* 点击菜单内部先处理菜单关闭 */
      if (state.contextMenu!.style.display === 'block') {
        if (state.contextMenu!.contains(e.target as Node)) {
          state.contextMenu!.style.display = 'none';
          return;
        }
        state.contextMenu!.style.display = 'none';
      }
      if (!state.inspecting || !state.hoveredElement) return;

      /* 复制按钮 */
      if (
        state.copyButton!.style.display === 'flex' &&
        state.copyButton!.contains(e.target as Node)
      ) {
        swallow(e);
        duplicateElement(state.selectedElement!);
        return;
      }
      /* 删除按钮 */
      if (
        state.deleteButton!.style.display === 'flex' &&
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
          setSelectedElement(null);
          redrawSelection();
        }, 250);
        return;
      }

      /* 普通单击：选中一个新元素；若之前挂着未执行的取消计时器，一并清掉 */
      clearPendingCancel();
      setSelectedElement(state.hoveredElement);
      redrawSelection();
    },
    true,
  );

  document.addEventListener(
    'contextmenu',
    function (e) {
      if (!state.inspecting) return;
      /* 菜单可见时右键点在菜单自身上：关闭菜单（与 click 处理器
       「点菜单内部先处理菜单关闭」语义对齐），不穿透菜单命中
       下方元素 —— 否则菜单会闪现到新位置且选中态被意外切换 */
      if (
        state.contextMenu!.style.display === 'block' &&
        state.contextMenu!.contains(e.target as Node)
      ) {
        swallow(e);
        state.contextMenu!.style.display = 'none';
        return;
      }
      const el = resolveHitElement(e);
      if (!el) return;
      /* 完整拦截（与 mousedown / click / dblclick 语义对齐）：
       preventDefault 压原生菜单之外还必须阻断传播，否则事件
       继续冒泡到宿主的 contextmenu 监听器（antdv a-tree 等），
       宿主自定义右键逻辑会与 overlay 菜单叠加触发 */
      swallow(e);
      state.hoveredElement = el;
      hover(el);
      /* 右键命中即视作选中 —— 让后续「组件面板 / 删除」等读
       * state.selectedElement 的分支都对齐到右键命中的元素，
       避免抽屉里点组件插到了上次单击的旧元素里。 */
      setSelectedElement(el);
      redrawSelection();
      showMenu(e.clientX, e.clientY, el);
    },
    true,
  );

  document.addEventListener(
    'dblclick',
    function (e) {
      if (state.dragging) {
        swallow(e);
        return;
      }
      if (!state.inspecting) return;
      const el = resolveHitElement(e);
      if (!el) return;
      /* 命中可审查元素：先把所有透传停掉，再走业务分支，
       避免早返回路径漏拦导致宿主原生控件（checkbox 等）状态被切换 */
      swallow(e);
      /* 双击命中：把尚未到期的「取消选中」挂起任务吞掉，保持红框稳定 */
      clearPendingCancel();
      setSelectedElement(el);
      openPanel(el);
    },
    true,
  );

  /** drag mode 提交：mouseup 在捕获阶段处理，先清场再异步提交 */
  document.addEventListener(
    'mouseup',
    function () {
      const source = state.dragSource;
      const target = state.dropTarget;
      const dropDir = state.dropDirection;
      /* 提前清场（endDrag），再异步提交；即使提交失败 UI 状态也已恢复 */
      endDrag();
      if (!source || !target || !dropDir) return;
      const src = parsePosition(source.getAttribute(state.attrName)!)!;
      const tgt = parsePosition(target.getAttribute(state.attrName)!)!;
      apiRequest('/move-element', {
        method: 'POST',
        body: JSON.stringify({
          file: formatPosition(src),
          line: +src.line,
          col: +src.col,
          target: { file: formatPosition(tgt), line: +tgt.line, col: +tgt.col },
          direction: dropDir,
        }),
      })
        .then((response) => {
          if (response && response.success) logInfo('元素已移动');
          else
            apiError('move 失败', (response && response.error) || '未知错误');
        })
        .catch(() => apiError('move 失败', '网络错误'));
    },
    true,
  );

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Control') setCtrlHeld(true);
    if (e.code === 'Escape') {
      handleEscape();
      return;
    }
    if (isShortcut(e)) {
      e.preventDefault();
      toggle();
    }
  });

  document.addEventListener('keyup', function (e) {
    if (e.key === 'Control') setCtrlHeld(false);
  });

  /* 切窗/失焦时清掉 Ctrl 状态，避免持续显示 grab 光标 */
  window.addEventListener('blur', () => setCtrlHeld(false));

  /* 滚动/缩放时：刷新 hover / 选中框 / drop indicator（drag 中） */
  function refreshOverlays(): void {
    if (!state.inspecting) return;
    if (state.hoveredElement) hover(state.hoveredElement);
    redrawSelection();
    if (state.dragging) redrawDropIndicator();
  }
  window.addEventListener('scroll', refreshOverlays, true);
  window.addEventListener('resize', refreshOverlays);

  /* 启动 */
  createUI();

  /* overlay pointer-events:auto 会拦截 wheel 导致页面无法滚动。
     绑 wheel 透传：找到下方可滚动容器手动滚动 + 刷新 overlay 定位。 */
  for (const overlay of [state.hoverOverlay!, state.selectOverlay!]) {
    overlay.addEventListener('wheel', (e) => {
      forwardWheel(e);
      refreshOverlays();
    });
  }

  /* 右下角齿轮按钮（配置可控） */
  if (clientConfig.toggleBtn) {
    const gearButton = createElement('div', '__vdi-gear-btn');
    gearButton.title = '开启审查模式';
    gearButton.innerHTML = GEAR_SVG;
    gearButton.style = 'opacity: 0.7;transform: scale(1)';
    gearButton.onmouseenter = () => {
      gearButton.style.opacity = '1';
      gearButton.style.transform = 'scale(1.1)';
    };
    gearButton.onmouseleave = () => {
      gearButton.style.opacity = '.7';
      gearButton.style.transform = 'scale(1)';
    };
    gearButton.onclick = (e) => {
      swallow(e);
      toggle();
    };
    document.body.appendChild(gearButton);
    state.gearButton = gearButton;
  }

  logSuccess(
    'Ready — ' + formatShortcut(clientConfig.shortcut) + ' to inspect',
  );
  // 抑制可能的 unused 警告
  void formatPosition;
}
