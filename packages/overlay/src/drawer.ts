/**
 * 组件抽屉（右侧滑入面板）。
 *
 * 搜索 → 分组列表 → 点击插入组件。
 * 插入方向由 state.insertDirection 决定：
 *   'inside' (默认) 插入选中元素内部末尾
 *   'before'          插入选中元素同级上方
 *   'after'           插入选中元素同级下方
 */
import { state } from "./state";
import { parsePosition, apiRequest, createElement } from "./utils";
import { redrawSelection } from "./inspector";

/** 抽屉遮罩（点击非面板区域关闭） */
let drawerBackdrop: HTMLDivElement | null = null;

/** 关闭抽屉（先动画滑出，200ms 后移除 DOM；同时移除遮罩） */
export function closeDrawer(): void {
  if (!state.componentDrawer) return;
  state.componentDrawer.style.transform = "translateX(100%)";
  const drawer = state.componentDrawer;
  state.componentDrawer = null;
  if (drawerBackdrop) {
    drawerBackdrop.remove();
    drawerBackdrop = null;
  }
  setTimeout(function () {
    drawer.remove();
  }, 200);
}

/** 打开抽屉（已打开则关闭） */
export function openDrawer(
  direction: "before" | "after" | "inside" = "inside",
): void {
  state.contextMenu!.style.display = "none";
  if (state.componentDrawer) {
    closeDrawer();
    return;
  }
  let tip = "插入到选中元素的内部";
  switch (direction) {
    case "before":
      tip = "插入到选中元素的同级上方";
      break;
    case "after":
      tip = "插入到选中元素的同级下方";
      break;
  }
  buildDrawer(direction, tip);
}

/** 构造抽屉。direction 决定「点击组件」时的插入语义 */
function buildDrawer(
  direction: "inside" | "before" | "after",
  hint: string,
): void {
  // 遮罩：覆盖全屏、位于抽屉之下；点击非面板区域（即遮罩本身）关闭抽屉
  const backdrop = createElement("div", "__vdi-backdrop");
  backdrop.onclick = function (e) {
    // 仅响应点击遮罩本身（点抽屉内部由抽屉的 stopPropagation 处理）
    if (e.target === backdrop) closeDrawer();
  };
  document.body.appendChild(backdrop);
  drawerBackdrop = backdrop;

  const drawer = createElement("div", "__vdi-drawer");
  // 点击抽屉内部不冒泡到遮罩的关闭逻辑
  drawer.onclick = function (e) {
    e.stopPropagation();
  };
  document.body.appendChild(drawer);
  state.componentDrawer = drawer;
  requestAnimationFrame(function () {
    drawer.style.transform = "translateX(0)";
  });

  // 头部
  const header = createElement("div", "__vdi-drawer-header");
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
  header.append(titleWrap, closeButton);
  drawer.appendChild(header);

  // 搜索
  const searchWrap = createElement("div", "__vdi-drawer-search");
  const searchInput = createElement(
    "input",
    "__vdi-drawer-search-input",
  ) as HTMLInputElement;
  searchInput.placeholder = "搜索组件…";
  searchWrap.appendChild(searchInput);
  drawer.appendChild(searchWrap);

  // 列表
  const list = createElement("div", "__vdi-drawer-list");
  drawer.appendChild(list);

  const footer = createElement("div", "__vdi-drawer-footer");

  // 内置组件目录
  const catalog = [
    {
      group: "antdv/通用",
      items: [
        {
          tag: "a-button",
          label: "Button 按钮",
          snippet: '<a-button type="primary">按钮</a-button>',
        },
        {
          tag: "a-tag",
          label: "Tag 标签",
          snippet: '<a-tag color="blue">标签</a-tag>',
        },
      ],
    },
    {
      group: "antdv/布局",
      items: [
        { tag: "a-divider", label: "Divider 分割线", snippet: "<a-divider />" },
        {
          tag: "a-space",
          label: "Space 间距",
          snippet: "<a-space><span>项</span></a-space>",
        },
      ],
    },
    {
      group: "antdv/表单",
      items: [
        {
          tag: "a-input",
          label: "Input 输入框",
          snippet: '<a-input placeholder="请输入" />',
        },
        {
          tag: "a-input-password",
          label: "InputPassword 密码框",
          snippet: '<a-input-password placeholder="请输入密码" />',
        },
        {
          tag: "a-select",
          label: "Select 选择器",
          snippet: '<a-select placeholder="请选择" style="width:100%" />',
        },
        {
          tag: "a-date-picker",
          label: "DatePicker 日期",
          snippet: '<a-date-picker style="width:100%" />',
        },
        { tag: "a-switch", label: "Switch 开关", snippet: "<a-switch />" },
        {
          tag: "a-checkbox",
          label: "Checkbox 复选",
          snippet: "<a-checkbox>复选框</a-checkbox>",
        },
        {
          tag: "a-radio",
          label: "Radio 单选",
          snippet: '<a-radio value="a">选项</a-radio>',
        },
      ],
    },
    {
      group: "antdv/反馈",
      items: [
        {
          tag: "a-alert",
          label: "Alert 提示",
          snippet: '<a-alert message="提示信息" type="info" show-icon />',
        },
      ],
    },
    {
      group: "antdv/数据展示",
      items: [
        {
          tag: "a-card",
          label: "Card 卡片",
          snippet: '<a-card title="标题"><p>内容</p></a-card>',
        },
      ],
    },
  ];

  function render(filter: string) {
    list.innerHTML = "";
    let any = false;
    catalog.forEach(function (group) {
      const matched = group.items.filter(function (item) {
        return (
          !filter ||
          item.label.toLowerCase().indexOf(filter) >= 0 ||
          item.tag.indexOf(filter) >= 0
        );
      });
      if (!matched.length) return;
      any = true;
      const groupTitle = createElement(
        "div",
        "__vdi-drawer-group",
        group.group,
      );
      list.appendChild(groupTitle);
      matched.forEach(function (item) {
        const row = createElement("div", "__vdi-drawer-item");
        row.onmouseenter = function () {
          row.style.background = "#f1f5f9";
        };
        row.onmouseleave = function () {
          row.style.background = "transparent";
        };

        const icon = createElement(
          "div",
          "__vdi-drawer-item-icon",
          item.tag.substring(0, 2),
        );
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

        row.onclick = function () {
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
          }).then(function (response) {
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
  searchInput.oninput = function () {
    render(searchInput.value.trim().toLowerCase());
  };
  drawer.appendChild(footer);
}

// keep redrawSelection referenced (drawer triggers HMR; selection may re-render)
void redrawSelection;
