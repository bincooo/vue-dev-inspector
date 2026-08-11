/**
 * 属性选择抽屉（右侧滑入面板）。
 *
 * 从 ComponentConfig 的 attrs 元数据中读取当前选中元素对应组件的
 * 属性描述清单，用户点选即可将属性追加到「编辑属性」面板的编辑列表。
 *
 * 抽屉 z-index（10001）高于 prop panel mask（9999），覆盖在 prop panel
 * 之上；遮罩 z-index 10000。打开期间 prop panel 仍可见但被遮罩挡住不可交互。
 */
import { state } from '../state';
import { createElement } from '../utils';
import { rerenderPropList } from './index';
import type { ComponentAttr } from '@vue-dev-inspector/shared';

/** 抽屉遮罩（点击非面板区域关闭） */
let attrBackdrop: HTMLDivElement | null = null;
let closeTimer: ReturnType<typeof setTimeout> | null = null;

/** 关闭抽屉（先动画滑出，200ms 后移除 DOM；同时移除遮罩） */
export function closeAttrDrawer(): void {
  if (!state.attrDrawer) return;
  if (closeTimer) clearTimeout(closeTimer);
  state.attrDrawer.style.transform = 'translateX(100%)';
  const drawer = state.attrDrawer;
  state.attrDrawer = null;
  if (attrBackdrop) {
    attrBackdrop.remove();
    attrBackdrop = null;
  }
  closeTimer = setTimeout(() => {
    closeTimer = null;
    drawer.remove();
  }, 200);
}

/** 打开抽屉（已打开则先关闭再开） */
export function openAttrDrawer(): void {
  if (state.attrDrawer) {
    closeAttrDrawer();
    return;
  }
  buildAttrDrawer();
}

/** 在 componentEntries 中查找与当前元素 tag 匹配的 attrs 清单 */
function findAttrList(): ComponentAttr[] | null {
  const tag = (state.panelData.tag || '').toLowerCase();
  if (!tag) return null;
  for (const entry of state.componentEntries) {
    for (const group of entry.groups) {
      for (const item of group.items) {
        if (item.tag.toLowerCase() === tag) {
          return item.attrs ?? null;
        }
      }
    }
  }
  return null;
}

/** 构造抽屉 */
function buildAttrDrawer(): void {
  // 遮罩
  const backdrop = createElement('div', '__vdi-attr-backdrop');
  backdrop.onclick = (e) => {
    if (e.target === backdrop) closeAttrDrawer();
  };
  document.body.appendChild(backdrop);
  attrBackdrop = backdrop;

  const drawer = createElement('div', '__vdi-attr-drawer');
  drawer.onclick = (e) => e.stopPropagation();
  document.body.appendChild(drawer);
  state.attrDrawer = drawer;
  requestAnimationFrame(() => {
    drawer.style.transform = 'translateX(0)';
  });

  // 头部
  const title = createElement('div', '__vdi-attr-drawer-title', '📋 组件属性');
  const subtitle = createElement(
    'div',
    '__vdi-attr-drawer-subtitle',
    state.panelData.tag || '',
  );
  const closeButton = createElement<HTMLButtonElement>(
    'button',
    '__vdi-close-btn',
    '✕',
  );
  closeButton.onclick = closeAttrDrawer;
  const headerLeft = createElement('div');
  headerLeft.append(title, subtitle);
  const header = createElement('div', '__vdi-attr-drawer-header');
  header.append(headerLeft, closeButton);
  drawer.appendChild(header);

  // 搜索框
  const searchInput = createElement<HTMLInputElement>(
    'input',
    '__vdi-attr-drawer-search-input',
  );
  searchInput.placeholder = '搜索属性…';
  const searchWrap = createElement('div', '__vdi-attr-drawer-search');
  searchWrap.appendChild(searchInput);
  drawer.appendChild(searchWrap);

  // 列表
  const list = createElement('div', '__vdi-attr-drawer-list');
  drawer.appendChild(list);

  // 取当前组件的 attrs 清单
  const attrs = findAttrList();

  // 当前搜索关键词（闭包变量，供点击添加后重渲染复用）
  let currentFilter = '';

  function render() {
    list.innerHTML = '';
    if (!attrs || !attrs.length) {
      list.appendChild(
        createElement('div', '__vdi-attr-drawer-empty', '无可用属性描述'),
      );
      return;
    }

    // 按 group 分组（缺省归「其它」），保持首次出现顺序
    const groupOrder: string[] = [];
    const grouped = new Map<string, ComponentAttr[]>();
    attrs.forEach((attr) => {
      const g = attr.group || '其它';
      if (!grouped.has(g)) {
        groupOrder.push(g);
        grouped.set(g, []);
      }
      grouped.get(g)!.push(attr);
    });

    let any = false;
    groupOrder.forEach((g) => {
      const matched = grouped
        .get(g)!
        .filter(
          (attr) =>
            !currentFilter ||
            attr.name.toLowerCase().includes(currentFilter) ||
            (attr.label && attr.label.toLowerCase().includes(currentFilter)),
        );
      if (!matched.length) return;
      any = true;
      const groupTitle = createElement('div', '__vdi-attr-drawer-group', g);
      list.appendChild(groupTitle);
      matched.forEach((attr) => {
        const row = createElement('div', '__vdi-attr-drawer-item');

        const nameEl = createElement(
          'span',
          '__vdi-attr-drawer-item-name',
          attr.name,
        );
        const labelEl = attr.label
          ? createElement('span', '__vdi-attr-drawer-item-label', attr.label)
          : null;
        const valueEl = attr.defaultValue
          ? createElement(
              'span',
              '__vdi-attr-drawer-item-value',
              attr.defaultValue,
            )
          : null;

        // name + label 包裹进 title 容器（上下布局）
        const titleEl = createElement('div', '__vdi-attr-drawer-item-title');
        titleEl.append(nameEl);
        if (labelEl) titleEl.append(labelEl);

        row.append(titleEl);
        if (valueEl) row.append(valueEl);

        // 已添加的属性显示 ✓ 标记
        const added = state.panelData.entries.some((e) => e.key === attr.name);
        row.append(
          createElement(
            'span',
            '__vdi-attr-drawer-item-check',
            added ? '✓' : '',
          ),
        );

        row.onclick = () => {
          // 已存在则不重复添加（实时检查）
          const exists = state.panelData.entries.some(
            (e) => e.key === attr.name,
          );
          if (exists) return;
          state.panelData.entries.push({
            key: attr.name,
            value: attr.defaultValue ?? '',
          });
          rerenderPropList();
          render();
        };
        list.appendChild(row);
      });
    });

    if (!any) {
      list.appendChild(
        createElement('div', '__vdi-attr-drawer-empty', '无匹配属性'),
      );
    }
  }

  render();
  searchInput.oninput = () => {
    currentFilter = searchInput.value.trim().toLowerCase();
    render();
  };
}
