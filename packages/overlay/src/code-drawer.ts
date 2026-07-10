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
 * 编辑器：用 Monaco（jsDelivr CDN 运行时加载，见 ./monaco.ts）。每个块懒加载
 * 一个 Monaco 编辑器实例，挂在 __vdi-code-editor 容器内；关闭抽屉 / 折叠
 * 子节点文本时 dispose，避免跨次重开泄漏。
 *   - script/style：applyBlock 拿到服务端内容时建编辑器。
 *   - childtext：「📝 编辑」按钮触发 loadChildText 取子节点源码后建编辑器，
 *     保存成功折叠时 dispose（多数时间折叠，不常驻第三个编辑器）。
 *   - Monaco 自带滚动同步 / 语法高亮 / Tab 缩进，无需手动叠层。
 */
import { state } from "./state";
import {
  apiRequest,
  createElement,
  formatPosition,
  parsePosition,
} from "./utils";
import type { CodeBlockData, GetBlocksResponse, ChildTextData } from "./types";
import type { MonacoAPI, MonacoEditor, MonacoModel } from "./monaco";
import { loadMonaco, monacoLanguageFor } from "./monaco";

/** 抽屉滑出/滑入动画时长（与组件抽屉一致）。 */
const SLIDE_MS = 200;
/** 抽屉宽度边界。 */
const MIN_WIDTH = 320;
/** 单个 block 高度占比边界。splitter 不允许把任一块压得太小。 */
const MIN_BLOCK_RATIO = 0.15;
const MAX_BLOCK_RATIO = 0.85;
/** 状态条默认提示。 */
const STATUS_LOADING = "加载中…";

/** 编辑器等宽字体栈（与原 highlight 层一致，跨平台命中同一宽度）。 */
const MONO_FONT =
  '"JetBrains Mono", "Fira Code", ui-monospace, "SF Mono", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
/** Monaco 加载失败时的兜底提示。 */
const MONACO_LOAD_FAIL = "Monaco 加载失败（检查网络）";

let codeBackdrop: HTMLDivElement | null = null;
let closeTimer: ReturnType<typeof setTimeout> | null = null;
/** 当前抽屉打开期间创建的 BlockPanel 列表，供 closeCodeDrawer 统一 dispose。 */
let activePanels: BlockPanel[] = [];

/** 关闭抽屉（先动画滑出，再 200ms 后移除 DOM，同时移除遮罩与 Monaco 编辑器）。 */
export function closeCodeDrawer(): void {
  if (!state.codeDrawer) return;
  if (closeTimer) clearTimeout(closeTimer);
  state.codeDrawer.style.transform = "translateX(100%)";
  const drawer = state.codeDrawer;
  state.codeDrawer = null;
  state.codeDrawerContext = null;
  state.codeDrawerBlocks = { script: null, style: null, childText: null };
  if (codeBackdrop) {
    codeBackdrop.remove();
    codeBackdrop = null;
  }
  // 统一 dispose Monaco 编辑器与模型，避免跨次重开泄漏。
  for (const panel of activePanels) disposeEditor(panel);
  activePanels = [];
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
  // 第三个区域：子节点文本（懒加载，初始折叠成窄条，不参与 script/style 的 2 路 splitter）。
  const childPanel = buildBlockPanel("子节点文本", "childtext");
  body.append(scriptPanel.root, splitter, stylePanel.root, childPanel.root);
  applySplitRatio(
    body,
    scriptPanel.root,
    stylePanel.root,
    state.codeDrawerSplit,
  );
  installSplitter(splitter, body, scriptPanel.root, stylePanel.root);
  activePanels = [scriptPanel, stylePanel, childPanel];

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
      // 缺块也保留 ref（面板始终显示）；childText 面板常驻，ref 直接存。
      state.codeDrawerBlocks = {
        script: scriptPanel.ref,
        style: stylePanel.ref,
        childText: childPanel.ref,
      };
      // 缺块时 applyBlock 已在面板内提示「保存将新建」，状态栏统一引导文案。
      status.textContent = "编辑后点击对应保存按钮回写源码（HMR 自动刷新）";
    })
    .catch(() => {
      status.textContent = "网络错误";
    });
}

/** 单个块面板的 DOM 引用 + Monaco 编辑器实例。 */
interface BlockPanel {
  root: HTMLDivElement;
  titleEl: HTMLDivElement;
  editorWrap: HTMLDivElement;
  /** 懒加载的 Monaco 编辑器实例（applyBlock / loadChildText 时由 ensureEditor 建）。 */
  editor: MonacoEditor | null;
  /** 编辑器绑定的文本模型（dispose 时一并释放）。 */
  model: MonacoModel | null;
  saveBtn: HTMLButtonElement;
  ref: { editorWrap: HTMLDivElement };
  hintEl: HTMLDivElement;
  /** style 块新建时是否 scoped 的复选框；仅 style 面板非 null。 */
  scopedCheckbox: HTMLInputElement | null;
  /** 子节点文本面板的「📝 编辑」按钮（懒加载入口）；仅 childtext 面板非 null。 */
  editBtn: HTMLButtonElement | null;
  /** 子节点文本面板的「✕ 取消」按钮（放弃编辑、折叠回窄条）；仅 childtext 面板非 null。 */
  cancelBtn: HTMLButtonElement | null;
}

/**
 * 构造一个 __vdi-code-block 面板。
 *
 * DOM 结构：
 *   root
 *   ├─ title (Script / CSS / 子节点文本)
 *   ├─ editor-wrap  (Monaco 编辑器挂载容器，position: relative)
 *   └─ actions (hint + [scoped 复选框] + [编辑按钮] + Save 按钮)
 *
 * 仅组装 DOM 骨架；Monaco 编辑器由 ensureEditor 在拿到内容后懒加载创建。
 * - style 面板：多一个 scoped 复选框（仅块缺失、新建时显示）。
 * - childtext 面板：多一个「📝 编辑」按钮（懒加载入口），初始折叠成窄条
 *   （editor-wrap / saveBtn 隐藏，root 收缩为 0 0 auto），点编辑后展开。
 */
function buildBlockPanel(
  label: string,
  kind: "script" | "style" | "childtext",
): BlockPanel {
  const root = createElement("div", "__vdi-code-block");
  const titleEl = createElement("div", "__vdi-code-block-title", label);

  // Monaco 挂载容器；空 div 即可，monaco.editor.create 会把自身 DOM 挂进来。
  const editorWrap = createElement("div", "__vdi-code-editor");

  const hintEl = createElement("div", "__vdi-code-block-hint", "点击「编辑」加载子节点源码");

  // style 面板：scoped 复选框（新建块时勾选用）。
  let scopedCheckbox: HTMLInputElement | null = null;
  if (kind === "style") {
    scopedCheckbox = document.createElement("input");
    scopedCheckbox.type = "checkbox";
    scopedCheckbox.checked = true;
    scopedCheckbox.className = "__vdi-code-scoped-input";
    const scopedLabel = createElement<HTMLLabelElement>(
      "label",
      "__vdi-code-scoped",
    );
    scopedLabel.append(scopedCheckbox, document.createTextNode(" scoped"));
    // 默认隐藏：块已存在时不显示（由 applyBlock 控制可见性）。
    scopedLabel.style.display = "none";
    hintEl.after(scopedLabel);
  }

  const saveBtn = createElement<HTMLButtonElement>(
    "button",
    "__vdi-save-btn __vdi-code-save-btn",
    "💾 保存",
  );

  // childtext 面板：懒加载「📝 编辑」按钮 + 「✕ 取消」按钮 + 初始折叠态。
  let editBtn: HTMLButtonElement | null = null;
  let cancelBtn: HTMLButtonElement | null = null;
  if (kind === "childtext") {
    editBtn = createElement<HTMLButtonElement>(
      "button",
      "__vdi-save-btn __vdi-code-edit-btn",
      "📝 编辑",
    );
    cancelBtn = createElement<HTMLButtonElement>(
      "button",
      "__vdi-save-btn __vdi-code-cancel-btn",
      "✕ 取消",
    );
    // 取消按钮在 saveBtn 左侧；初始折叠态随 saveBtn 一起隐藏。
    cancelBtn.style.display = "none";
    editorWrap.style.display = "none";
    saveBtn.style.display = "none";
    root.style.flex = "0 0 auto";
  }

  // 取消按钮：放弃编辑，折叠回只显示「📝 编辑」的窄条（与保存成功后的折叠一致）。
  if (cancelBtn) {
    cancelBtn.onclick = () => collapseChildText(panel);
  }

  // 保存按钮：script/style 走 submitBlock（style 透传 scoped）；childtext 走 submitChildText。
  saveBtn.onclick = () => {
    const content = panel.editor?.getValue() ?? "";
    if (kind === "childtext") {
      void submitChildText(content, saveBtn, panel);
    } else {
      const scoped = kind === "style" ? scopedCheckbox?.checked : undefined;
      void submitBlock(kind, content, saveBtn, scoped);
    }
  };

  // 编辑按钮：懒加载子节点源码并展开面板。
  if (editBtn) {
    editBtn.onclick = () => {
      void loadChildText(panel);
    };
  }


  const actions = createElement("div", "__vdi-code-block-actions");
  const warp = createElement("div");
  warp.append(...[cancelBtn, saveBtn].filter(i => !!i));
  actions.append(hintEl, warp);

  if (editBtn) actions.appendChild(editBtn);

  root.append(titleEl, editorWrap, actions);

  const panel: BlockPanel = {
    root,
    titleEl,
    editorWrap,
    editor: null,
    model: null,
    saveBtn,
    ref: { editorWrap },
    hintEl,
    scopedCheckbox,
    editBtn,
    cancelBtn,
  };
  return panel;
}

/**
 * 懒加载 / 复用 Monaco 编辑器并写入内容。
 *
 * - 首次：建 model（带语言 + tabSize=2）-> 建编辑器（automaticLayout 内部用
 *   ResizeObserver，覆盖 splitter / 宽度拖拽 / 展开等容器尺寸变化）。
 * - 后续：直接 setValue 覆盖内容（不重建编辑器）。
 *
 * monaco 实例由调用方通过 loadMonaco() 取得并传入（便于失败时统一兜底）。
 */
async function ensureEditor(
  panel: BlockPanel,
  kind: "script" | "style" | "childtext",
  content: string,
  monaco: MonacoAPI,
): Promise<void> {
  if (panel.editor) {
    panel.editor.setValue(content);
    return;
  }
  const model = monaco.editor.createModel(content, monacoLanguageFor(kind));
  model.updateOptions({ tabSize: 2 });
  const editor = monaco.editor.create(panel.editorWrap, {
    model,
    automaticLayout: true,
    theme: "vs",
    fontSize: 12,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    fontFamily: MONO_FONT,
  });
  panel.model = model;
  panel.editor = editor;
}

/** 释放面板的 Monaco 编辑器与模型（dispose 幂等，已释放则空操作）。 */
function disposeEditor(panel: BlockPanel): void {
  panel.editor?.dispose();
  panel.model?.dispose();
  panel.editor = null;
  panel.model = null;
}

/** 应用服务端响应到块面板：写入内容、设置可见性、首次渲染高亮。
 *
 * 缺块时不再隐藏整面板 —— 仍显示空编辑区 + 保存按钮，让用户能新增块。
 * style 面板在缺块时显示 scoped 复选框（块已存在时按原 attrs 保留，隐藏复选框）。 */
function applyBlock(
  panel: BlockPanel,
  block: CodeBlockData | undefined,
  kind: "script" | "style",
): void {
  panel.root.style.display = "";
  const content = block?.content ?? "";
  if (!block) {
    panel.hintEl.textContent =
      kind === "script"
        ? '无 <script> 块，保存将新建 <script setup lang="ts">'
        : "无 <style> 块，保存将新建";
    if (kind === "style" && panel.scopedCheckbox) {
      panel.scopedCheckbox.parentElement!.style.display = "";
    }
  } else {
    panel.hintEl.textContent =
      kind === "script" ? "对应 <script> 块" : "对应 <style> 块";
    if (kind === "style" && panel.scopedCheckbox) {
      panel.scopedCheckbox.parentElement!.style.display = "none";
    }
  }
  // 懒加载 Monaco 编辑器并写入内容；CDN 不可达时兜底提示。
  void loadMonaco()
    .then((monaco) => ensureEditor(panel, kind, content, monaco))
    .catch(() => {
      const status =
        state.codeDrawer?.querySelector<HTMLSpanElement>(
          ".__vdi-code-status",
        );
      panel.hintEl.textContent = MONACO_LOAD_FAIL;
      if (status) status.textContent = MONACO_LOAD_FAIL;
    });
}

/**
 * 把单个块的最新内容提交到服务端。复用 /update-block，按 kind 路由。
 *
 * 服务端写盘成功 → 状态栏显示「已保存（HMR 刷新中）」；失败显示 error。
 * 保存期间禁用按钮，避免重复点击。
 *
 * `scoped` 仅对 style 新建块生效：块已存在时服务端按原 attrs 保留，忽略该字段。
 */
async function submitBlock(
  kind: "script" | "style",
  content: string,
  btn: HTMLButtonElement,
  scoped?: boolean,
): Promise<void> {
  const ctx = state.codeDrawerContext;
  if (!ctx) return;
  const status =
    state.codeDrawer?.querySelector<HTMLSpanElement>(".__vdi-code-status");
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = "保存中…";
  try {
    const payload: Record<string, unknown> = {
      file: formatPosition(ctx),
      kind,
      content,
    };
    if (kind === "style" && scoped !== undefined) payload.scoped = scoped;
    const response = await apiRequest<{ success?: boolean; error?: string }>(
      "/update-block",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
    if (response && response.success) {
      if (status) status.textContent = `${labelOf(kind)} 已保存（HMR 刷新中）`;
    } else {
      if (status)
        status.textContent = (response && response.error) || "保存失败";
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
 * 懒加载选中元素的子节点源码并展开「子节点文本」面板。
 *
 * 点击「📝 编辑」按钮触发：调 /get-child-text 取 (file,line,col) 元素
 * 开标签与闭标签之间的源码 → 填入 Monaco 编辑器 → 展开 editorWrap + 保存按钮、
 * 收起编辑按钮、root 从折叠窄条（0 0 auto）切到共享纵向空间（1 1 0）。
 * 元素无子节点（自闭合 / 空配对）时 content 为空，提示「可输入后保存新增」。
 */
async function loadChildText(panel: BlockPanel): Promise<void> {
  const ctx = state.codeDrawerContext;
  if (!ctx) return;
  const status =
    state.codeDrawer?.querySelector<HTMLSpanElement>(".__vdi-code-status");
  const editBtn = panel.editBtn;
  if (!editBtn) return;
  const original = editBtn.textContent;
  editBtn.disabled = true;
  editBtn.textContent = "加载中…";
  try {
    const res = await apiRequest("/get-child-text", {
      method: "POST",
      body: JSON.stringify({
        file: formatPosition(ctx),
        line: ctx.line,
        col: ctx.col,
      }),
    });
    // 服务端成功直接返回 ChildTextData（{ content, start, end }），
    // 失败（404）已由 apiRequest reject；这里按原形态取字段。
    const data = res as unknown as ChildTextData;
    // 展开：显示编辑器与保存/取消按钮，收起编辑按钮，root 参与纵向 flex 分配。
    panel.editorWrap.style.display = "";
    panel.saveBtn.style.display = "";
    if (panel.cancelBtn) panel.cancelBtn.style.display = "";
    editBtn.style.display = "none";
    panel.root.style.flex = "1 1 0";
    panel.root.style.minHeight = "140px";
    panel.hintEl.textContent = data?.content
      ? "对应元素子节点源码，保存后整体替换"
      : "该元素无子节点源码（可输入后保存新增）";
    // 懒加载 Monaco 编辑器并写入内容；display:none→可见后 layout 一次兜底。
    const monaco = await loadMonaco();
    await ensureEditor(panel, "childtext", data?.content ?? "", monaco);
    requestAnimationFrame(() => panel.editor?.layout());
    if (status) status.textContent = "子节点源码已加载";
  } catch (e) {
    if (status) {
      status.textContent =
        e instanceof Error ? e.message : MONACO_LOAD_FAIL;
      panel.hintEl.textContent = MONACO_LOAD_FAIL;
    }
  } finally {
    editBtn.disabled = false;
    editBtn.textContent = original;
  }
}

/**
 * 把「子节点文本」面板的最新内容提交到服务端 /update-child-text。
 *
 * 服务端用 AST 定位 (line,col) 元素，整体替换其子节点源码区间；
 * 自闭合元素 + 非空内容会转为配对标签。保存交互模式与 submitBlock 一致。
 *
 * 保存成功后调用 collapseChildText 退出编辑态——折叠回只显示「📝 编辑」按钮的
 * 窄条，释放 Monaco 编辑器，下次点「编辑」重新从服务端拉取最新内容。
 * 保存失败则保持编辑态，方便用户改后重试。
 */
async function submitChildText(
  content: string,
  btn: HTMLButtonElement,
  panel: BlockPanel,
): Promise<void> {
  const ctx = state.codeDrawerContext;
  if (!ctx) return;
  const status =
    state.codeDrawer?.querySelector<HTMLSpanElement>(".__vdi-code-status");
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = "保存中…";
  try {
    const response = await apiRequest<{ success?: boolean; error?: string }>(
      "/update-child-text",
      {
        method: "POST",
        body: JSON.stringify({
          file: formatPosition(ctx),
          line: ctx.line,
          col: ctx.col,
          content,
        }),
      },
    );
    if (response && response.success) {
      if (status) status.textContent = "子节点源码已保存（HMR 刷新中）";
      collapseChildText(panel);
    } else {
      if (status)
        status.textContent = (response && response.error) || "保存失败";
    }
  } catch (e) {
    if (status)
      status.textContent = e instanceof Error ? e.message : "网络错误";
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
}

/**
 * 把「子节点文本」面板折叠回初始窄条态（退出编辑）。
 *
 * 隐藏 editorWrap + 保存/取消按钮、重新显示「📝 编辑」按钮、root 从 `1 1 0` 收回 `0 0 auto`、
 * dispose Monaco 编辑器与模型、hint 改回引导文案。由 submitChildText 在保存成功后，
 * 或「✕ 取消」按钮在放弃编辑时调用。
 */
function collapseChildText(panel: BlockPanel): void {
  panel.editorWrap.style.display = "none";
  panel.saveBtn.style.display = "none";
  if (panel.cancelBtn) panel.cancelBtn.style.display = "none";
  if (panel.editBtn) panel.editBtn.style.display = "";
  panel.root.style.flex = "0 0 auto";
  panel.root.style.minHeight = "";
  // childtext 多数时间折叠；释放编辑器，下次展开由 ensureEditor 重建。
  disposeEditor(panel);
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
function installResize(resizer: HTMLDivElement, drawer: HTMLDivElement): void {
  let startX = 0;
  let startWidth = 0;
  let dragging = false;

  const onMove = (e: MouseEvent) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const maxWidth = Math.floor(window.innerWidth * 0.9);
    const nextWidth = Math.max(MIN_WIDTH, Math.min(maxWidth, startWidth - dx));
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
    startWidth =
      parseInt(drawer.style.width || "0", 10) || state.codeDrawerWidth;
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  });
}
