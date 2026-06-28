/**
 * 组件抽屉（右侧滑入面板）。
 *
 * 搜索 → 分组列表 → 点击插入组件。
 * 插入方向由 openDrawer 的 direction 参数决定：
 *   'inside' (默认) 插入选中元素内部末尾
 *   'before'          插入选中元素同级上方
 *   'after'           插入选中元素同级下方
 */
import { state, type DropDirection } from "./state";
import { parsePosition, apiRequest, createElement } from "./utils";
import { renderIcon } from "./icon";
import type {
  ComponentConfigEntry,
  ComponentGroup,
} from "@vue-dev-inspector/shared";

/** 抽屉遮罩（点击非面板区域关闭） */
let drawerBackdrop: HTMLDivElement | null = null;
let closeTimer: ReturnType<typeof setTimeout> | null = null;

const HINT_BY_DIRECTION: Record<DropDirection, string> = {
  inside: "插入到选中元素的内部",
  before: "插入到选中元素的同级上方",
  after: "插入到选中元素的同级下方",
};

/** 关闭抽屉（先动画滑出，200ms 后移除 DOM；同时移除遮罩） */
export function closeDrawer(): void {
  if (!state.componentDrawer) return;
  if (closeTimer) clearTimeout(closeTimer);
  state.componentDrawer.style.transform = "translateX(100%)";
  const drawer = state.componentDrawer;
  state.componentDrawer = null;
  if (drawerBackdrop) {
    drawerBackdrop.remove();
    drawerBackdrop = null;
  }
  closeTimer = setTimeout(() => {
    closeTimer = null;
    drawer.remove();
  }, 200);
}

/** 打开抽屉（已打开则关闭） */
export function openDrawer(direction: DropDirection = "inside"): void {
  state.contextMenu!.style.display = "none";
  if (state.componentDrawer) {
    closeDrawer();
    return;
  }
  buildDrawer(direction, HINT_BY_DIRECTION[direction]);
}

/** 构造抽屉。direction 决定「点击组件」时的插入语义 */
function buildDrawer(direction: DropDirection, hint: string): void {
  // 遮罩：覆盖全屏、位于抽屉之下；点击非面板区域（即遮罩本身）关闭抽屉
  const backdrop = createElement("div", "__vdi-backdrop");
  backdrop.onclick = (e) => {
    // 仅响应点击遮罩本身（点抽屉内部由抽屉的 stopPropagation 处理）
    if (e.target === backdrop) closeDrawer();
  };
  document.body.appendChild(backdrop);
  drawerBackdrop = backdrop;

  const drawer = createElement("div", "__vdi-drawer");
  // 点击抽屉内部不冒泡到遮罩的关闭逻辑
  drawer.onclick = (e) => e.stopPropagation();
  document.body.appendChild(drawer);
  state.componentDrawer = drawer;
  requestAnimationFrame(() => {
    drawer.style.transform = "translateX(0)";
  });

  // 当前激活的物料库（支持多 entry 切换）；
  // 未配置时仅渲染 FALLBACK_ENTRY（单 tab）。
  const entries: ComponentConfigEntry[] =
    state.componentEntries && state.componentEntries.length
      ? state.componentEntries
      : [];
  // 沿用上次打开的 tab 下标，溢出则回到 0
  if (state.activeEntryIndex >= entries.length) state.activeEntryIndex = 0;
  let activeIndex = state.activeEntryIndex;

  // 左侧竖列 tab 必须先 append —— CSS grid 用 grid-row: 1 / -1 让 tabs
  // 跨满整列，sibling 之间在 grid 中按 DOM 顺序自动占据行 / 列；
  // 如果 header / search / list 先于 tabs 出现，tabs 会被挤到下一行，
  // 不再「跨列」，整个两栏布局失效。
  const tabs = createElement("div", "__vdi-drawer-tabs");
  drawer.appendChild(tabs);

  // 当前激活的 groups（首次打开取默认 activeIndex 的 groups）
  const activeGroups: ComponentGroup[] = entries[activeIndex].groups;

  entries.forEach(function (entry, index) {
    const tab = createElement("div", "__vdi-drawer-tab");
    if (index === activeIndex) tab.classList.add("__vdi-drawer-tab--active");
    // 渲染左侧 icon（HTMLDivElement 容器），缺省回退到 name 首字符
    const iconBox = createElement("span", "__vdi-drawer-tab-icon");
    renderIcon(iconBox, entry.icon, (entry.name || "?").substring(0, 1));
    const nameLabel = createElement("span", "__vdi-drawer-tab-name", entry.name);
    tab.title = entry.name;
    tab.append(iconBox, nameLabel);
    tab.onmouseenter = () => {
      if (index !== activeIndex) tab.classList.add("__vdi-drawer-tab--hover");
    };
    tab.onmouseleave = () => {
      if (index !== activeIndex) tab.classList.remove("__vdi-drawer-tab--hover");
    };
    tab.onclick = function () {
      if (index === activeIndex) return;
      activeIndex = index;
      state.activeEntryIndex = index;
      // 刷新其它 tab 的 active 样式
      [...tabs.children].forEach(function (el, i) {
        (el as HTMLElement).classList.toggle(
          "__vdi-drawer-tab--active",
          i === activeIndex,
        );
        (el as HTMLElement).classList.remove("__vdi-drawer-tab--hover");
      });
      // 重设当前 activeGroups 并清空搜索框后重渲染
      activeGroups.length = 0;
      entry.groups.forEach((g) => activeGroups.push(g));
      searchInput.value = "";
      render("");
    };
    tabs.appendChild(tab);
  });

  // 右侧主体容器 ——
  // 头部
  const drawerTitle = createElement("div", "__vdi-drawer-title", "🧩 组件面板");
  const hintWrap = createElement("div", "__vdi-drawer-hint", hint);
  const closeButton = createElement<HTMLButtonElement>(
    "button",
    "__vdi-close-btn",
    "✕",
  );
  closeButton.onclick = closeDrawer;
  const titleWrap = createElement("div");
  titleWrap.append(drawerTitle, hintWrap);

  const header = createElement("div", "__vdi-drawer-header");
  header.append(titleWrap, closeButton);
  drawer.appendChild(header);

  // 搜索
  const searchInput = createElement(
    "input",
    "__vdi-drawer-search-input",
  ) as HTMLInputElement;
  searchInput.placeholder = "搜索组件…";
  const searchWrap = createElement("div", "__vdi-drawer-search");
  searchWrap.appendChild(searchInput);
  drawer.appendChild(searchWrap);

  // 列表
  const list = createElement("div", "__vdi-drawer-list");
  drawer.appendChild(list);

  const footer = createElement("div", "__vdi-drawer-footer");

  // 渲染：遍历当前激活 entry 的 groups，搜索作用于 groups 内 items
  function render(filter: string) {
    list.innerHTML = "";
    let any = false;
    activeGroups.forEach((group) => {
      const matched = group.items.filter(
        (item) =>
          !filter ||
          item.label.toLowerCase().includes(filter) ||
          item.tag.includes(filter),
      );
      if (!matched.length) return;
      any = true;
      const groupTitle = createElement(
        "div",
        "__vdi-drawer-group",
        group.group,
      );
      list.appendChild(groupTitle);
      matched.forEach((item) => {
        const row = createElement("div", "__vdi-drawer-item");

        const icon = createElement("div", "__vdi-drawer-item-icon");
        renderIcon(icon, item.icon, item.tag.substring(0, 2));
        const textWrap = createElement("div", "__vdi-drawer-item-text");
        const titleLabel = createElement(
          "div",
          "__vdi-drawer-item-label",
          item.label,
        );
        const tagLabel = createElement(
          "div",
          "__vdi-drawer-item-tag",
          item.tag,
        );
        textWrap.append(titleLabel, tagLabel);
        row.append(icon, textWrap);

        row.onclick = () => {
          if (!state.selectedElement) {
            footer.textContent = "请先选中一个元素再插入";
            return;
          }
          const pos = parsePosition(
            state.selectedElement.getAttribute(state.attrName)!,
          );
          apiRequest("/insert-component", {
            method: "POST",
            body: JSON.stringify({
              file: pos.file,
              line: +pos.line,
              col: +pos.col,
              componentTag: item.tag,
              direction,
            }),
          }).then((response) => {
            if (response && response.success) {
              footer.textContent = "已插入 " + item.tag + "（HMR 刷新中）";
            } else
              footer.textContent = (response && response.error) || "插入失败";
          });
        };
        list.appendChild(row);
      });
    });
    if (!any)
      list.appendChild(
        createElement("div", "__vdi-drawer-empty", "无匹配组件"),
      );
  }

  render("");
  searchInput.oninput = () => {
    render(searchInput.value.trim().toLowerCase());
  };
  drawer.appendChild(footer);
}