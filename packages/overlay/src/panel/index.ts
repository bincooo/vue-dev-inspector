/**
 * 属性编辑面板 -- 面板生命周期（打开/关闭）+ 提交回写。
 *
 * 公开 API：openPanel / closePanel / rerenderPropList。
 * 值控件管理在 ./control，列表渲染在 ./render，setter 实现在 ../setters。
 */
import { state } from "../state";
import {
  parsePosition,
  apiRequest,
  getElementTagName,
  createElement,
  formatPosition,
  logSuccess,
  apiError,
  errMsg,
} from "../utils";
import { openAttrDrawer, closeAttrDrawer } from "./attr-drawer";
import { renderList } from "./render";
import { cleanupValueControl } from "./control";

/** 当前 prop panel 的属性行列表容器，供 attr-drawer 触发重渲染 */
let currentListEl: HTMLDivElement | null = null;

/** 供 attr-drawer 在追加属性后触发 prop panel 列表重渲染 */
export function rerenderPropList(): void {
  if (currentListEl) renderList(currentListEl);
}

/** 关闭浮层 */
export function closePanel(): void {
  closeAttrDrawer();
  // 释放 prop panel 内所有 Monaco 编辑器
  if (state.propPanel) {
    state.propPanel.querySelectorAll(".__vdi-prop-code-wrap").forEach((el) => {
      cleanupValueControl(el as HTMLElement);
    });
  }
  if (state.propPanel) {
    state.propPanel.remove();
    state.propPanel = null;
  }
  currentListEl = null;
}

/** 弹出属性编辑模态 */
export function openPanel(el: HTMLElement): void {
  closePanel();
  state.contextMenu!.style.display = "none";
  const pos = parsePosition(el.getAttribute(state.attrName)!)!;
  state.panelData = {
    rootIndex: pos.rootIndex,
    file: pos.file,
    line: +pos.line,
    col: +pos.col,
    tag: getElementTagName(el),
    entries: [],
  };

  const mask = createElement("div", "__vdi-panel-mask");
  mask.onmousedown = (e) => {
    if (e.target === mask) closePanel();
  };

  const card = createElement("div", "__vdi-prop-card");

  const headerTitle = createElement("div", "__vdi-prop-title", "⚙️ 编辑属性");
  const tagSpan = createElement(
    "span",
    "__vdi-prop-subtitle-tag",
    getElementTagName(el),
  );
  const subtitle = createElement("div", "__vdi-prop-subtitle");
  const fileSpan = createElement("span", undefined, formatPosition(pos));
  const loadingHint = createElement("span", "__vdi-loading-hint", "  加载中…");
  subtitle.append(
    tagSpan,
    document.createTextNode(" - "),
    fileSpan,
    loadingHint,
  );
  const headerLeft = createElement("div");
  headerLeft.append(headerTitle, subtitle);

  const closeButton = createElement<HTMLButtonElement>(
    "button",
    "__vdi-close-btn",
    "✕",
  );
  closeButton.onclick = closePanel;
  const header = createElement("div", "__vdi-prop-header");
  header.append(headerLeft, closeButton);

  const list = createElement("div", "__vdi-prop-body");

  const footer = createElement("div", "__vdi-prop-footer");
  const hint = createElement(
    "span",
    "__vdi-prop-hint",
    "修改后基于 AST 回写源码，Vite 自动热更新",
  );
  const attrButton = createElement<HTMLButtonElement>(
    "button",
    "__vdi-attr-btn",
    "📋 属性",
  );
  attrButton.onclick = () => openAttrDrawer();
  const saveButton = createElement<HTMLButtonElement>(
    "button",
    "__vdi-save-btn",
    "💾 保存",
  );
  saveButton.onclick = () => submit();
  footer.append(hint, attrButton, saveButton);

  card.append(header, list, footer);
  mask.appendChild(card);
  document.body.appendChild(mask);
  state.propPanel = mask;
  currentListEl = list;

  apiRequest("/get-props", {
    method: "POST",
    body: JSON.stringify({
      file: formatPosition(state.panelData),
      line: state.panelData.line,
      col: state.panelData.col,
    }),
  })
    .then((response) => {
      if (response && response.props)
        state.panelData.entries = [...response.props];
      renderList(list);
      loadingHint.remove();
    })
    .catch(() => {
      loadingHint.textContent = " 读取失败";
    });
}

/** 收集 entries 回写源码 */
function submit(): void {
  apiRequest("/update-props", {
    method: "POST",
    body: JSON.stringify({
      file: formatPosition(state.panelData),
      line: state.panelData.line,
      col: state.panelData.col,
      props: state.panelData.entries.map((entry) => ({
        key: entry.key,
        value: entry.value,
      })),
    }),
  })
    .then((response) => {
      if (response && response.success) {
        closePanel();
        logSuccess("属性已更新");
      }
    })
    .catch((e: unknown) => {
      apiError("属性更新失败", errMsg(e));
    });
}
