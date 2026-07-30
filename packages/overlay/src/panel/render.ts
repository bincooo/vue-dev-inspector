/**
 * 列表渲染 -- 属性行 + 新增行。
 *
 * 从原 prop-panel.ts 抽取，由 panel/index.ts 的 openPanel / rerenderPropList 调用。
 */
import { state } from "../state";
import { createElement } from "../utils";
import type { ComponentAttr } from "@vue-dev-inspector/shared";
import type { PropEntry } from "../types";
import {
  createValueControl,
  cleanupValueControl,
  makeSetterSwitcher,
  getEntrySetter,
} from "./control";

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
