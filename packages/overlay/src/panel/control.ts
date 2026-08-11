/**
 * 值控件管理 -- setter 选择、值控件创建/释放/切换。
 *
 * 从原 prop-panel.ts 抽取，供 panel/render.ts 消费。
 */
import { createElement } from '../utils';
import type { ComponentAttr } from '@vue-dev-inspector/shared';
import type { PropEntry } from '../types';
import { setters, getSetters, inferDefaultSetter } from '../setters';

/** 每条 entry 当前选中的 setter 名（UI 状态，不参与回写） */
const entrySetter = new WeakMap<PropEntry, string>();

export function getEntrySetter(
  entry: PropEntry,
  attr: ComponentAttr | null,
): string {
  const list = getSetters(attr, entry);
  const cur = entrySetter.get(entry);
  if (cur && list.includes(cur)) return cur;
  const def = inferDefaultSetter(attr, entry);
  const resolved = list.includes(def) ? def : list[0];
  entrySetter.set(entry, resolved);
  return resolved;
}

/** 构造 setter 切换按钮：在 attr.setter 列表中循环切换 */
export function makeSetterSwitcher(
  entry: PropEntry,
  attr: ComponentAttr | null,
  rebuild: () => void,
): HTMLButtonElement {
  const btn = createElement<HTMLButtonElement>('button', '__vdi-prop-mode-btn');
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
export function createValueControl(
  entry: PropEntry,
  attr: ComponentAttr | null,
): HTMLElement {
  const name = getEntrySetter(entry, attr);
  const def = setters[name] ?? setters.TextSetter;
  return def.build(entry, attr);
}

/** 释放值控件可能持有的 Monaco 编辑器（切换 setter / 关闭面板时调用） */
export function cleanupValueControl(el: HTMLElement): void {
  const cleanup = (el as unknown as { __vdiCleanup?: () => void }).__vdiCleanup;
  if (cleanup) cleanup();
}
