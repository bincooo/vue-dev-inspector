/**
 * 属性编辑面板。
 *
 * 每条属性的值控件由 setter 注册表决定。用户可在 ComponentAttr.setter
 * 声明的多个 setter 之间自由切换（点击切换按钮循环）。
 * 内置 setter：TextSetter / CodeSetter / SelectSetter / BoolSetter。
 */
import { state } from "./state";
import {
  parsePosition,
  apiRequest,
  getElementTagName,
  createElement,
  formatPosition,
  logSuccess,
  apiError,
  errMsg,
} from "./utils";
import { openAttrDrawer, closeAttrDrawer } from "./attr-drawer";
import { loadMonaco } from "./monaco";
import type { ComponentAttr } from "@vue-dev-inspector/shared";
import type { PropEntry } from "./types";

/** 当前 prop panel 的属性行列表容器，供 attr-drawer 触发重渲染 */
let currentListEl: HTMLDivElement | null = null;

/* ─── setter 注册表 ─── */
/** setter 工厂：根据 entry + attr 构造值控件，绑定 entry.value。 */
interface SetterDef {
  icon: string;
  label: string;
  build(entry: PropEntry, attr: ComponentAttr | null): HTMLElement;
}

const setters: Record<string, SetterDef> = {
  TextSetter: {
    icon: "Aa",
    label: "文本",
    build(entry) {
      const input = createElement<HTMLInputElement>(
        "input",
        "__vdi-prop-input __vdi-prop-value",
      );
      input.value = entry.value;
      input.placeholder = "值（可空）";
      input.oninput = () => (entry.value = input.value);
      return input;
    },
  },
  CodeSetter: {
    icon: "{ }",
    label: "代码",
    build(entry) {
      const container = createElement("div", "__vdi-prop-code-wrap");
      const loading = createElement(
        "div",
        "__vdi-prop-code-loading",
        "加载编辑器…",
      );
      container.appendChild(loading);
      const disposed = false;
      loadMonaco()
        .then((monaco) => {
          if (disposed) return;
          const model = monaco.editor.createModel(entry.value, "javascript");
          model.updateOptions({ tabSize: 2 });
          const editor = monaco.editor.create(container, {
            model,
            automaticLayout: true,
            theme: "vs-dark",
            fontSize: 12,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
            lineNumbers: "off",
          });
          model.onDidChangeContent(() => {
            entry.value = editor.getValue();
          });
          loading.remove();
          (container as unknown as { __vdiCleanup: () => void }).__vdiCleanup =
            () => {
              editor.dispose();
              model.dispose();
            };
        })
        .catch(() => {
          loading.textContent = "编辑器加载失败";
        });
      return container;
    },
  },
  SelectSetter: {
    icon: "☰",
    label: "下拉选择",
    build(entry, attr) {
      const options = attr?.options ?? [];
      const select = createElement<HTMLSelectElement>(
        "select",
        "__vdi-prop-input __vdi-prop-value __vdi-prop-select",
      );
      const emptyOpt = createElement<HTMLOptionElement>(
        "option",
        undefined,
        "（选择值）",
      );
      emptyOpt.value = "";
      select.appendChild(emptyOpt);
      // 当前值不在 options 中时额外追加一条，避免 select 显示空白
      if (entry.value && !options.includes(entry.value)) {
        const curOpt = createElement<HTMLOptionElement>(
          "option",
          undefined,
          entry.value,
        );
        curOpt.value = entry.value;
        select.appendChild(curOpt);
      }
      options.forEach((opt) => {
        const option = createElement<HTMLOptionElement>(
          "option",
          undefined,
          opt,
        );
        option.value = opt;
        select.appendChild(option);
      });
      select.value = entry.value;
      select.onchange = () => (entry.value = select.value);
      if (!options.length) select.disabled = true;
      return select;
    },
  },
  BoolSetter: {
    icon: "◉",
    label: "开关",
    build(entry) {
      const wrap = createElement("div", "__vdi-prop-bool-wrap");
      const btn = createElement<HTMLButtonElement>(
        "button",
        "__vdi-prop-bool-btn",
      );
      const sync = () => {
        const on = entry.value === "true";
        btn.textContent = on ? "true" : "false";
        btn.classList.toggle("__vdi-prop-bool-btn--on", on);
      };
      sync();
      btn.onclick = (e) => {
        e.stopPropagation();
        entry.value = entry.value === "true" ? "false" : "true";
        sync();
      };
      wrap.appendChild(btn);
      return wrap;
    },
  },
};

/**
 * 根据属性特征推断可用的 setter 列表。
 *
 * 推断规则：
 * - 始终包含 TextSetter 和 CodeSetter（通用兜底）
 * - 有 options -> 追加 SelectSetter
 * - options 为 [true, false] 或当前值为 true/false -> 追加 BoolSetter
 * - 显式声明 attr.setter 时直接使用，跳过推断
 */
function getSetters(attr: ComponentAttr | null, entry: PropEntry): string[] {
  if (attr?.setter?.length) return attr.setter;
  const options = attr?.options ?? [];
  const isBoolOptions =
    options.length === 2 &&
    options.includes("true") &&
    options.includes("false");
  const isBoolValue = entry.value === "true" || entry.value === "false";
  const list = ["TextSetter", "CodeSetter"];
  if (options.length) list.push("SelectSetter");
  if (isBoolOptions || isBoolValue) list.push("BoolSetter");
  return list;
}

/**
 * 根据属性特征推断默认 setter。
 *
 * 优先级：
 * 1. 属性名以 : / @ / v-model 开头 -> CodeSetter（Vue 绑定/事件表达式）
 * 2. 当前值为 true/false -> BoolSetter
 * 3. 有 options -> SelectSetter
 * 4. 其他 -> TextSetter
 */
function inferDefaultSetter(
  attr: ComponentAttr | null,
  entry: PropEntry,
): string {
  const name = entry.key;
  if (
    name.startsWith(":") ||
    name.startsWith("@") ||
    name.startsWith("v-model")
  )
    return "CodeSetter";
  if (entry.value === "true" || entry.value === "false") return "BoolSetter";
  if (attr?.options?.length) return "SelectSetter";
  return "TextSetter";
}

/** 每条 entry 当前选中的 setter 名（UI 状态，不参与回写） */
const entrySetter = new WeakMap<PropEntry, string>();

function getEntrySetter(entry: PropEntry, attr: ComponentAttr | null): string {
  const list = getSetters(attr, entry);
  const cur = entrySetter.get(entry);
  if (cur && list.includes(cur)) return cur;
  const def = inferDefaultSetter(attr, entry);
  const resolved = list.includes(def) ? def : list[0];
  entrySetter.set(entry, resolved);
  return resolved;
}

/** 供 attr-drawer 在追加属性后触发 prop panel 列表重渲染 */
export function rerenderPropList(): void {
  if (currentListEl) renderList(currentListEl);
}

/** 在 componentEntries 中查找当前元素指定属性名的 ComponentAttr 元数据 */
function findAttrByName(name: string): ComponentAttr | null {
  const tag = (state.panelData.tag || "").toLowerCase();
  if (!tag) return null;
  for (const entry of state.componentEntries) {
    for (const group of entry.groups) {
      for (const item of group.items) {
        if (item.tag.toLowerCase() === tag) {
          return item.attrs?.find((a) => a.name === name) ?? null;
        }
      }
    }
  }
  return null;
}

/** 构造 setter 切换按钮：在 attr.setter 列表中循环切换 */
function makeSetterSwitcher(
  entry: PropEntry,
  attr: ComponentAttr | null,
  rebuild: () => void,
): HTMLButtonElement {
  const btn = createElement<HTMLButtonElement>("button", "__vdi-prop-mode-btn");
  const refresh = () => {
    const name = getEntrySetter(entry, attr);
    const def = setters[name] ?? setters.TextSetter;
    btn.textContent = def.icon;
    btn.title = `输入器：${def.label}（点击切换）`;
    btn.disabled = getSetters(attr, entry).length <= 1;
  };
  refresh();
  btn.onclick = (e) => {
    e.stopPropagation();
    const list = getSetters(attr, entry);
    if (list.length <= 1) return;
    const cur = getEntrySetter(entry, attr);
    const next = list[(list.indexOf(cur) + 1) % list.length];
    entrySetter.set(entry, next);
    refresh();
    rebuild();
  };
  return btn;
}

/** 根据 entry 当前 setter 构造值控件 */
function createValueControl(
  entry: PropEntry,
  attr: ComponentAttr | null,
): HTMLElement {
  const name = getEntrySetter(entry, attr);
  const def = setters[name] ?? setters.TextSetter;
  return def.build(entry, attr);
}

/** 释放值控件可能持有的 Monaco 编辑器（切换 setter / 关闭面板时调用） */
function cleanupValueControl(el: HTMLElement): void {
  const cleanup = (el as unknown as { __vdiCleanup?: () => void }).__vdiCleanup;
  if (cleanup) cleanup();
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

/** 单个属性行：key 输入 + = + setter 切换 + value 控件 + 删除按钮 */
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
  const equalsSign = createElement("span", "__vdi-prop-eq", "=");

  let valueControl = createValueControl(entry, findAttrByName(entry.key));
  function rebuild() {
    const fresh = createValueControl(entry, findAttrByName(entry.key));
    cleanupValueControl(valueControl);
    valueControl.replaceWith(fresh);
    valueControl = fresh;
  }
  const modeBtn = makeSetterSwitcher(entry, findAttrByName(entry.key), rebuild);
  // 属性名变化时重建值控件 + 切换按钮（setter 可能不同）
  keyInput.oninput = () => {
    entry.key = keyInput.value;
    const attr = findAttrByName(entry.key);
    const freshSwitcher = makeSetterSwitcher(entry, attr, rebuild);
    modeBtn.replaceWith(freshSwitcher);
    rebuild();
  };

  const removeButton = createElement<HTMLButtonElement>(
    "button",
    "__vdi-prop-remove",
    "✕",
  );
  removeButton.onclick = onRemove;
  row.append(keyInput, equalsSign, modeBtn, valueControl, removeButton);
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
  // 用一个 draft entry 复用 createValueControl / makeSetterSwitcher 机制
  const draft: PropEntry = { key: "", value: "" };
  let newValueControl = createValueControl(draft, null);
  function rebuildDraft() {
    const fresh = createValueControl(draft, findAttrByName(draft.key));
    cleanupValueControl(newValueControl);
    newValueControl.replaceWith(fresh);
    newValueControl = fresh;
  }
  let modeBtn = makeSetterSwitcher(draft, null, rebuildDraft);
  const onEnter = (e: KeyboardEvent) => {
    // CodeSetter 下 Enter 换行，不触发添加
    if (getEntrySetter(draft, findAttrByName(draft.key)) === "CodeSetter")
      return;
    if (e.key === "Enter") doAdd();
  };
  // 属性名输入时，根据 key 的 setter 重建值控件 + 切换按钮
  newKeyInput.oninput = () => {
    draft.key = newKeyInput.value;
    const attr = findAttrByName(draft.key);
    const freshSwitcher = makeSetterSwitcher(draft, attr, rebuildDraft);
    modeBtn.replaceWith(freshSwitcher);
    modeBtn = freshSwitcher;
    rebuildDraft();
  };
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
      value: draft.value,
    });
    // 重置 draft（保留对象引用以保持 setter 选择）
    draft.key = "";
    draft.value = "";
    newKeyInput.value = "";
    renderList(list);
  };
  addButton.onclick = doAdd;
  newKeyInput.onkeydown = onEnter;

  addRow.append(newKeyInput, equalsSign, modeBtn, newValueControl, addButton);
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
      apiError("属性更新失败", errMsg(e));
    });
}
