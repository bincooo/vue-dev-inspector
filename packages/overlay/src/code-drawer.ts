/**
 * 「编辑代码」抽屉（右侧滑出面板）。
 *
 * 右键菜单点击「✏️ 编辑代码」时触发。抽屉内同时包含 Script 与 CSS 两个
 * 编辑区，分别对应选中元素所在 .vue 文件的 <script> 与 <style> 块。
 * 每个块自带「💾 保存」按钮，互不影响。
 *
 * 布局：
 *   - 抽屉宽 560px（用户拖动调整后跨会话保留）。
 *   - 抽屉高 100vh，body 内部 Script / CSS 上下两半，中间 6px 可拖动 splitter。
 *   - 拖动条在抽屉左边缘，水平拖动改 width；鼠标往左拖 = 加宽，往右拖 = 收窄。
 *
 * 高亮：
 *   - 用 highlight.js（jsdelivr CDN）作为语法高亮；textarea 上层 + 高亮
 *     <pre> 下层叠放，textarea 文本透明 + caret-color 可见。
 *   - 用户在 textarea 编辑时触发 input 事件 → 重新调 highlight 渲染 <pre>。
 *
 * v1 简化：
 *   - 不做 Monaco / CodeMirror。
 *   - 不做未保存提示；每次 openCodeDrawer 都从服务端拉取最新内容覆盖本地编辑。
 *   - 仅支持单 <script> 与单 <style>（多块 SFC 由服务端优先返回 scriptSetup / styles[0]）。
 */
import { state } from "./state";
import {
  apiRequest,
  createElement,
  formatPosition,
  parsePosition,
} from "./utils";
import type { CodeBlockData, GetBlocksResponse } from "./types";
import { loadHighlighter, languageFor } from "./cdn";

/** 抽屉滑出/滑入动画时长（与组件抽屉一致）。 */
const SLIDE_MS = 200;
/** 抽屉宽度边界。 */
const MIN_WIDTH = 320;
/** 单个 block 高度占比边界。splitter 不允许把任一块压得太小。 */
const MIN_BLOCK_RATIO = 0.15;
const MAX_BLOCK_RATIO = 0.85;
/** 状态条默认提示。 */
const STATUS_LOADING = "加载中…";

let codeBackdrop: HTMLDivElement | null = null;
let closeTimer: ReturnType<typeof setTimeout> | null = null;
/** 抽屉打开期间高亮器；首次需要时加载，后续复用。 */
let highlighterPromise: ReturnType<typeof loadHighlighter> | null = null;

/** 关闭抽屉（先动画滑出，再 200ms 后移除 DOM，同时移除遮罩）。 */
export function closeCodeDrawer(): void {
  if (!state.codeDrawer) return;
  if (closeTimer) clearTimeout(closeTimer);
  state.codeDrawer.style.transform = "translateX(100%)";
  const drawer = state.codeDrawer;
  state.codeDrawer = null;
  state.codeDrawerContext = null;
  state.codeDrawerBlocks = { script: null, style: null };
  if (codeBackdrop) {
    codeBackdrop.remove();
    codeBackdrop = null;
  }
  closeTimer = setTimeout(() => {
    closeTimer = null;
    drawer.remove();
  }, SLIDE_MS);
}

/** 打开抽屉（已打开则关闭后重开，确保从服务端重新拉取最新内容）。 */
export function openCodeDrawer(element: HTMLElement): void {
  state.contextMenu!.style.display = "none";
  if (state.codeDrawer) closeCodeDrawer();

  const pos = parsePosition(element.getAttribute(state.attrName)!)!;
  state.codeDrawerContext = {
    rootIndex: pos.rootIndex,
    file: pos.file,
    line: +pos.line,
    col: +pos.col,
  };

  // 遮罩
  const backdrop = createElement("div", "__vdi-backdrop");
  backdrop.onclick = (e) => {
    if (e.target === backdrop) closeCodeDrawer();
  };
  document.body.appendChild(backdrop);
  codeBackdrop = backdrop;

  // 抽屉容器
  const drawer = createElement("div", "__vdi-code-drawer");
  drawer.style.width = state.codeDrawerWidth + "px";
  drawer.onclick = (e) => e.stopPropagation();
  document.body.appendChild(drawer);
  state.codeDrawer = drawer;
  requestAnimationFrame(() => {
    drawer.style.transform = "translateX(0)";
  });

  // 右边缘拖动条
  const resizer = createElement("div", "__vdi-code-drawer-resizer");
  drawer.appendChild(resizer);
  installResize(resizer, drawer);

  // 头部
  const title = createElement("div", "__vdi-code-drawer-title", "✏️ 编辑代码");
  const subtitle = createElement(
    "div",
    "__vdi-code-drawer-subtitle",
    formatPosition(pos),
  );
  const closeBtn = createElement<HTMLButtonElement>(
    "button",
    "__vdi-close-btn",
    "✕",
  );
  closeBtn.onclick = closeCodeDrawer;
  const header = createElement("div", "__vdi-code-drawer-header");
  const left = createElement("div");
  left.append(title, subtitle);
  header.append(left, closeBtn);
  drawer.appendChild(header);

  // 主体：split layout（Script 占上，CSS 占下；中间 6px splitter）
  const body = createElement("div", "__vdi-code-drawer-body");
  drawer.appendChild(body);

  // 底部状态
  const footer = createElement("div", "__vdi-code-drawer-footer");
  const status = createElement("span", "__vdi-code-status", STATUS_LOADING);
  footer.appendChild(status);
  drawer.appendChild(footer);

  const scriptPanel = buildBlockPanel("Script", "script");
  const splitter = createElement("div", "__vdi-code-splitter");
  const stylePanel = buildBlockPanel("CSS", "style");
  body.append(scriptPanel.root, splitter, stylePanel.root);
  applySplitRatio(body, scriptPanel.root, stylePanel.root, state.codeDrawerSplit);
  installSplitter(splitter, body, scriptPanel.root, stylePanel.root);

  // 拉取
  apiRequest<GetBlocksResponse>("/get-block", {
    method: "POST",
    body: JSON.stringify({
      file: formatPosition(state.codeDrawerContext!),
    }),
  })
    .then((response) => {
      if (!response || (response as { error?: string }).error) {
        status.textContent =
          (response as { error?: string }).error || "加载失败";
        return;
      }
      applyBlock(scriptPanel, response.script, "script");
      applyBlock(stylePanel, response.style, "style");
      state.codeDrawerBlocks = {
        script: response.script ? scriptPanel.ref : null,
        style: response.style ? stylePanel.ref : null,
      };
      const hasAny = !!(response.script || response.style);
      status.textContent = hasAny
        ? "编辑后点击对应保存按钮回写源码（HMR 自动刷新）"
        : "该文件没有 <script> 或 <style> 块";
    })
    .catch(() => {
      status.textContent = "网络错误";
    });
}

/** 单个块面板的 DOM 引用 + 缓存。 */
interface BlockPanel {
  root: HTMLDivElement;
  titleEl: HTMLDivElement;
  editorWrap: HTMLDivElement;
  textarea: HTMLTextAreaElement;
  highlight: HTMLPreElement;
  /** 高亮层内层 <code>，在 buildBlockPanel 时一次建好，scroll 同步直接复用，避免每帧 firstElementChild。 */
  codeEl: HTMLElement;
  /** 闭包形式的滚动镜像：捕获 codeEl / textarea 引用，scroll 事件直接调用。 */
  syncScroll: () => void;
  saveBtn: HTMLButtonElement;
  ref: { textarea: HTMLTextAreaElement; saveBtn: HTMLButtonElement };
  hintEl: HTMLDivElement;
}

/**
 * 构造一个 __vdi-code-block 面板。
 *
 * DOM 结构：
 *   root
 *   ├─ title (Script / CSS)
 *   ├─ editor-wrap  (position: relative)
 *   │   ├─ highlight <pre><code>  (底层，渲染高亮 HTML；pointer-events: none)
 *   │   └─ textarea              (上层，文本透明 + caret 可见)
 *   └─ actions (hint + Save 按钮)
 *
 * 仅组装 DOM 骨架；高亮由 installHighlight 在拿到内容后渲染。
 */
function buildBlockPanel(label: string, kind: "script" | "style"): BlockPanel {
  const root = createElement("div", "__vdi-code-block");
  const titleEl = createElement("div", "__vdi-code-block-title", label);

  const editorWrap = createElement("div", "__vdi-code-editor");

  const highlight = document.createElement("pre");
  highlight.className = "__vdi-code-highlight hljs";
  const codeEl = document.createElement("code");
  highlight.appendChild(codeEl);

  const textarea = createElement<HTMLTextAreaElement>(
    "textarea",
    "__vdi-code-textarea",
  );
  textarea.spellcheck = false;
  textarea.wrap = "off";
  textarea.dataset.kind = kind;

  editorWrap.append(highlight, textarea);

  const hintEl = createElement("div", "__vdi-code-block-hint", "");

  const saveBtn = createElement<HTMLButtonElement>(
    "button",
    "__vdi-save-btn __vdi-code-save-btn",
    "💾 保存",
  );
  saveBtn.onclick = () => {
    void submitBlock(kind, textarea.value, saveBtn);
  };
  const actions = createElement("div", "__vdi-code-block-actions");
  actions.append(hintEl, saveBtn);

  root.append(titleEl, editorWrap, actions);

  // 滚动同步：textarea scroll → 高亮层 inner <code> 用 translate3d 仿 scroll
  // （因为 <pre> 是 overflow:hidden，scrollTop/Left 写入无效，必须用 transform 镜像位置）。
  const syncScroll = () => {
    codeEl.style.transform = `translate3d(${-textarea.scrollLeft}px, ${-textarea.scrollTop}px, 0)`;
  };
  textarea.addEventListener("scroll", syncScroll);
  // 输入时重新高亮（节流由浏览器渲染节奏隐式提供；高频输入下性能可接受）
  textarea.addEventListener("input", () => {
    void rerenderHighlight(textarea, codeEl, syncScroll);
  });
  // Tab 键：在 caret 处插入 2 个空格（与 CSS tab-size 一致），
  // 阻止默认的「焦点跳到下一可聚焦元素」行为，避免编辑中断。
  // Shift+Tab 保留浏览器默认（focus 下一节点），与常规编辑器习惯一致。
  textarea.addEventListener("keydown", (e) => {
    if (e.key !== "Tab" || e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) {
      return;
    }
    e.preventDefault();
    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? textarea.value.length;
    const value = textarea.value;
    const insert = "  ";
    textarea.value = value.slice(0, start) + insert + value.slice(end);
    const caret = start + insert.length;
    textarea.selectionStart = textarea.selectionEnd = caret;
    // 同步触发 input 监听，复用 rerenderHighlight。
    textarea.dispatchEvent(new Event("input"));
  });

  return {
    root,
    titleEl,
    editorWrap,
    textarea,
    highlight,
    codeEl,
    syncScroll,
    saveBtn,
    ref: { textarea, saveBtn },
    hintEl,
  };
}

/** 应用服务端响应到块面板：写入内容、设置可见性、首次渲染高亮。 */
function applyBlock(
  panel: BlockPanel,
  block: CodeBlockData | undefined,
  kind: "script" | "style",
): void {
  if (!block) {
    panel.root.style.display = "none";
    return;
  }
  panel.root.style.display = "";
  panel.textarea.value = block.content;
  panel.hintEl.textContent =
    kind === "script" ? "对应 <script> 块" : "对应 <style> 块";
  void rerenderHighlight(panel.textarea, panel.codeEl, panel.syncScroll);
}

/**
 * 重新渲染 highlight 层。
 *
 * 1. 取得共享的 highlighter（首次需要时 await 网络加载）。
 * 2. 调 highlight(code, { language }) 把代码转成 HTML 串。
 * 3. 为防御注入：服务端响应是 .vue 源文件内容，理论上不含 <script>，
 *    但 hljs 输出本身是 HTML，必须包在文本节点或通过 textContent 路径；
 *    这里直接 innerHTML 设置（hljs 已转义），不做额外过滤。
 * 4. 高亮加载失败 / 抛错时回退到纯文本（<pre> 仍显示，但不染色）。
 */
async function rerenderHighlight(
  textarea: HTMLTextAreaElement,
  codeEl: HTMLElement,
  syncScroll: () => void,
): Promise<void> {
  const value = textarea.value;
  try {
    if (!highlighterPromise) highlighterPromise = loadHighlighter();
    const hljs = await highlighterPromise;
    const out = hljs.highlight(value, {
      language: languageFor(textarea.dataset.kind === "style" ? "style" : "script"),
      ignoreIllegals: true,
    });
    codeEl.innerHTML = out.value;
  } catch {
    codeEl.textContent = value;
  }
  // 同步滚动位置（避免用户输入后高亮行与 caret 错位）
  syncScroll();
}

/**
 * 把单个块的最新内容提交到服务端。复用 /update-block，按 kind 路由。
 *
 * 服务端写盘成功 → 状态栏显示「已保存（HMR 刷新中）」；失败显示 error。
 * 保存期间禁用按钮，避免重复点击。
 */
async function submitBlock(
  kind: "script" | "style",
  content: string,
  btn: HTMLButtonElement,
): Promise<void> {
  const ctx = state.codeDrawerContext;
  if (!ctx) return;
  const status = state.codeDrawer?.querySelector<HTMLSpanElement>(
    ".__vdi-code-status",
  );
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = "保存中…";
  try {
    const response = await apiRequest<{ success?: boolean; error?: string }>(
      "/update-block",
      {
        method: "POST",
        body: JSON.stringify({
          file: formatPosition(ctx),
          kind,
          content,
        }),
      },
    );
    if (response && response.success) {
      if (status) status.textContent = `${labelOf(kind)} 已保存（HMR 刷新中）`;
    } else {
      if (status) status.textContent = (response && response.error) || "保存失败";
    }
  } catch {
    if (status) status.textContent = "网络错误";
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
}

function labelOf(kind: "script" | "style"): string {
  return kind === "script" ? "Script" : "CSS";
}

/**
 * 按 ratio（0-1）分配两个 panel 的高度。脚本在上，CSS 在下。
 * splitter 固定 6px 高度。
 */
function applySplitRatio(
  body: HTMLDivElement,
  scriptPanel: HTMLDivElement,
  stylePanel: HTMLDivElement,
  ratio: number,
): void {
  const r = Math.max(MIN_BLOCK_RATIO, Math.min(MAX_BLOCK_RATIO, ratio));
  const splitterHeight = 6;
  // body 的总高度由 CSS grid 决定（1fr）；用 flex-basis + flex-grow 即可。
  // 计算时按可用高度减去 splitter。
  scriptPanel.style.flex = `${r} 1 0`;
  stylePanel.style.flex = `${1 - r} 1 0`;
  // splitter 固定占位，不参与 grow
  const splitter = body.querySelector<HTMLDivElement>(".__vdi-code-splitter");
  if (splitter) splitter.style.flex = `0 0 ${splitterHeight}px`;
}

/** 在 splitter 上挂垂直拖拽监听，实时调整上下两块比例。 */
function installSplitter(
  splitter: HTMLDivElement,
  body: HTMLDivElement,
  scriptPanel: HTMLDivElement,
  stylePanel: HTMLDivElement,
): void {
  let startY = 0;
  let startRatio = state.codeDrawerSplit;
  let dragging = false;
  let bodyHeight = 0;

  const onMove = (e: MouseEvent) => {
    if (!dragging) return;
    const dy = e.clientY - startY;
    const nextRatio = startRatio + dy / bodyHeight;
    state.codeDrawerSplit = Math.max(
      MIN_BLOCK_RATIO,
      Math.min(MAX_BLOCK_RATIO, nextRatio),
    );
    applySplitRatio(body, scriptPanel, stylePanel, state.codeDrawerSplit);
  };
  const onUp = () => {
    if (!dragging) return;
    dragging = false;
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onUp);
  };
  splitter.addEventListener("mousedown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    bodyHeight = body.getBoundingClientRect().height || 1;
    startY = e.clientY;
    startRatio = state.codeDrawerSplit;
    dragging = true;
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  });
}

/**
 * 在左边缘 6px 拖动条上挂水平拖拽监听。
 *
 * 抽屉 right:0 + 拖动条在左侧 → 抽屉左边跟随鼠标：鼠标往左拖
 * （dx 为负）→ 左边 x 减小 → 宽度 = rightEdge − leftEdge = 增大。
 * 公式 `startWidth - dx` 恰好实现：dx 为负时 -dx 为正，加宽；dx 为正时收窄。
 * 限制在 [MIN_WIDTH, 90vw]。
 */
function installResize(
  resizer: HTMLDivElement,
  drawer: HTMLDivElement,
): void {
  let startX = 0;
  let startWidth = 0;
  let dragging = false;

  const onMove = (e: MouseEvent) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const maxWidth = Math.floor(window.innerWidth * 0.9);
    const nextWidth = Math.max(
      MIN_WIDTH,
      Math.min(maxWidth, startWidth - dx),
    );
    drawer.style.width = nextWidth + "px";
  };

  const onUp = () => {
    if (!dragging) return;
    dragging = false;
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onUp);
    const w = parseInt(drawer.style.width || "0", 10);
    if (!isNaN(w) && w > 0) state.codeDrawerWidth = w;
  };

  resizer.addEventListener("mousedown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragging = true;
    startX = e.clientX;
    startWidth = parseInt(drawer.style.width || "0", 10) || state.codeDrawerWidth;
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  });
}
