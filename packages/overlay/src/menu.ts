/**
 * 右键菜单。
 */
import { state, setSelectedElement } from "./state";
import {
  parsePosition,
  apiRequest,
  getElementTagName,
  createElement,
  formatPosition,
} from "./utils";
import { redrawSelection } from "./inspector";
import { openPanel } from "./panel";
import { openDrawer } from "./drawer";

type MenuAction = (
  element: HTMLElement,
  pos: { file: string; line: string; col: string },
) => void;

interface MenuItem {
  label: string;
  action: "open" | "props" | "catalog" | "copy" | "del";
  isDanger?: boolean;
}

export function showMenu(x: number, y: number, element: HTMLElement): void {
  const pos = parsePosition(element.getAttribute(state.attrName)!);
  /* 上次右键的按钮仍挂在 DOM 上（display:none 不清节点），先清空避免新旧并存 */
  state.contextMenu!.innerHTML = "";
  state.contextMenu!.style.display = "block";
  state.contextMenu!.style.left = Math.min(x, innerWidth - 220) + "px";
  state.contextMenu!.style.top = Math.min(y, innerHeight - 200) + "px";

  const titleTag = createElement("div", "__vdi-menu-title-tag");
  titleTag.textContent = getElementTagName(element);
  const titlePath = createElement(
    "div",
    "__vdi-menu-title-path",
    formatPosition(pos),
  );
  const title = createElement("div", "__vdi-menu-title");
  title.append(titleTag, titlePath);
  state.contextMenu!.appendChild(title);

  /* 同一 action 单一映射，避免 if/if 链 */
  const actions: Record<MenuItem["action"], MenuAction> = {
    open: () => {
      apiRequest("/open-in-editor", {
        method: "POST",
        body: JSON.stringify({
          file: pos.file,
          line: +pos.line,
          col: +pos.col,
          editor: state.editor,
        }),
      });
    },
    props: () => openPanel(element),
    catalog: () => openDrawer(),
    copy: () => {
      navigator.clipboard.writeText(
        state.protocol + state.projectRoot + "/" + formatPosition(pos),
      );
    },
    del: () => {
      apiRequest("/delete-element", {
        method: "POST",
        body: JSON.stringify({
          file: pos.file,
          line: +pos.line,
          col: +pos.col,
          tag: getElementTagName(element),
        }),
      }).then(() => {
        if (state.selectedElement === element) {
          setSelectedElement(null);
          redrawSelection();
        }
        element.remove();
      });
    },
  };

  const menuItems: MenuItem[] = [
    { label: "📦 在编辑器中打开", action: "open" },
    { label: "⚙️ 编辑属性", action: "props" },
    { label: "🧩 组件面板", action: "catalog" },
    { label: "📋 复制路径", action: "copy" },
    { label: "🗑️ 删除", action: "del", isDanger: true },
  ];

  for (const option of menuItems) {
    const button = createElement<HTMLButtonElement>(
      "button",
      "__vdi-menu-item " +
        (option.isDanger
          ? "__vdi-menu-item--danger"
          : "__vdi-menu-item--normal"),
      option.label,
    );
    button.onclick = () => {
      state.contextMenu!.style.display = "none";
      actions[option.action](element, pos);
    };
    state.contextMenu!.appendChild(button);
  }
}
