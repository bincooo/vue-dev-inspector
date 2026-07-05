/**
 * 属性编辑面板。
 */
import { state } from "./state";
import {
  parsePosition,
  apiRequest,
  getElementTagName,
  createElement,
  formatPosition,
  logSuccess,
  logError,
  errMsg,
} from "./utils";
import type { PropEntry } from "./types";

/** 关闭浮层 */
export function closePanel(): void {
  if (state.propPanel) {
    state.propPanel.remove();
    state.propPanel = null;
  }
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
    tag: el.tagName.toLowerCase(),
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
  const loadingHint = createElement(
    "span",
    "__vdi-loading-hint",
    "  加载中…",
  );
  subtitle.append(tagSpan, document.createTextNode(" - "), fileSpan, loadingHint);
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
  const saveButton = createElement<HTMLButtonElement>(
    "button",
    "__vdi-save-btn",
    "💾 保存",
  );
  saveButton.onclick = () => submit();
  footer.append(hint, saveButton);

  card.append(header, list, footer);
  mask.appendChild(card);
  document.body.appendChild(mask);
  state.propPanel = mask;

  apiRequest("/get-props", {
    method: "POST",
    body: JSON.stringify({
      file: formatPosition(state.panelData),
      line: state.panelData.line,
      col: state.panelData.col,
    }),
  })
    .then((response) => {
      if (response && response.props) state.panelData.entries = [...response.props];
      renderList(list);
      loadingHint.remove();
    })
    .catch(() => {
      loadingHint.textContent = "  读取失败";
    });
}

/** 单个属性行：key 输入 + = + value 输入 + 删除按钮 */
function makePropRow(
  entry: PropEntry,
  list: HTMLDivElement,
  onRemove: () => void,
): HTMLDivElement {
  const row = createElement("div", "__vdi-prop-row");
  const keyInput = createElement<HTMLInputElement>(
    "input",
    "__vdi-prop-input __vdi-prop-key",
  );
  keyInput.value = entry.key;
  keyInput.placeholder = "属性名";
  keyInput.oninput = () => (entry.key = keyInput.value);
  const equalsSign = createElement("span", "__vdi-prop-eq", "=");
  const valueInput = createElement<HTMLInputElement>(
    "input",
    "__vdi-prop-input __vdi-prop-value",
  );
  valueInput.value = entry.value;
  valueInput.placeholder = "值（可空）";
  valueInput.oninput = () => (entry.value = valueInput.value);
  const removeButton = createElement<HTMLButtonElement>(
    "button",
    "__vdi-prop-remove",
    "✕",
  );
  removeButton.onclick = onRemove;
  row.append(keyInput, equalsSign, valueInput, removeButton);
  list.appendChild(row);
  return row;
}

/** 渲染属性行 */
export function renderList(list: HTMLDivElement): void {
  list.innerHTML = "";
  if (!state.panelData.entries.length) {
    list.appendChild(
      createElement("div", "__vdi-prop-empty-hint", "暂无属性，点击下方添加"),
    );
  } else {
    state.panelData.entries.forEach((entry, index) => {
      makePropRow(entry, list, () => {
        state.panelData.entries.splice(index, 1);
        renderList(list);
      });
    });
  }

  const newKeyInput = createElement<HTMLInputElement>(
    "input",
    "__vdi-prop-input __vdi-new-input",
  );
  newKeyInput.placeholder = "新属性名";
  const equalsSign = createElement("span", "__vdi-prop-eq", "=");
  const newValueInput = createElement<HTMLInputElement>(
    "input",
    "__vdi-prop-input __vdi-prop-value __vdi-new-input",
  );
  newValueInput.placeholder = "值";
  const addButton = createElement<HTMLButtonElement>(
    "button",
    "__vdi-add-btn",
    "＋ 添加",
  );
  const addRow = createElement("div", "__vdi-prop-add-row");

  const doAdd = () => {
    if (!newKeyInput.value.trim()) return;
    state.panelData.entries.push({
      key: newKeyInput.value.trim(),
      value: newValueInput.value,
    });
    newKeyInput.value = "";
    newValueInput.value = "";
    renderList(list);
  };
  addButton.onclick = doAdd;
  const onEnter = (e: KeyboardEvent) => {
    if (e.key === "Enter") doAdd();
  };
  newKeyInput.onkeydown = onEnter;
  newValueInput.onkeydown = onEnter;

  addRow.append(newKeyInput, equalsSign, newValueInput, addButton);
  list.appendChild(addRow);
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
      logError("属性更新失败", errMsg(e));
    });
}
