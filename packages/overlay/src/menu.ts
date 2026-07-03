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
import { openCodeDrawer } from "./code-drawer";

type MenuAction = (
  element: HTMLElement,
  pos: { rootIndex: number; file: string; line: string; col: string },
) => void;

interface MenuItem {
  label: string;
  action: "open" | "props" | "catalog" | "copy" | "del" | "code";
  isDanger?: boolean;
}

/**
 * 服务端删除后清掉选中态，并把元素从 DOM 摘除交给 HMR 处理。
 *
 * 不在本函数做 element.remove()：服务端写盘后 Vite HMR 会按改写后的 sfc
 * 重新挂载 template 子树，自动处理"被删节点 + 毗邻节点的位置重排"。
 * 手动 remove 会与 HMR 的 patch 撞车 —— 在 a-space 这类基于 slot/index 的
 * 容器里，slot 子节点被错位删除会让毗邻元素被 HMR 误判丢失
 * （用户报告"复制 Primary 再删除副本 → Default 消失"）。
 */
export function deleteElementViaApi(element: HTMLElement): Promise<unknown> {
  const pos = parsePosition(element.getAttribute(state.attrName)!)!;
  return apiRequest("/delete-element", {
    method: "POST",
    body: JSON.stringify({
      file: formatPosition(pos),
      line: +pos.line,
      col: +pos.col,
      tag: getElementTagName(element),
    }),
  }).then(() => {
    if (state.selectedElement === element) {
      setSelectedElement(null);
      redrawSelection();
    }
  });
}

export function showMenu(x: number, y: number, element: HTMLElement): void {
  const pos = parsePosition(element.getAttribute(state.attrName)!)!;
  /* 上次右键的按钮仍挂在 DOM 上（display:none 不清节点），先清空避免新旧并存 */
  state.contextMenu!.innerHTML = "";
  state.contextMenu!.style.display = "block";
  // 读取渲染后宽度做 clamp，避免菜单宽度变更（CSS）与位置夹紧逻辑（TS）之间静默脱钩。
  const menuW = state.contextMenu!.offsetWidth || 210;
  state.contextMenu!.style.left = Math.min(x, innerWidth - menuW) + "px";
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
          file: formatPosition(pos),
          line: +pos.line,
          col: +pos.col,
          editor: state.editor,
        }),
      });
    },
    props: () => openPanel(element),
    catalog: () => openDrawer(),
    code: () => openCodeDrawer(element),
    copy: () => {
      // 多根场景下 `state.projectRoot` 只代表第一个根；
      // 旧版只复制 `rN:path:line:col`，编辑器里粘贴不可用。
      // 现在的语义：异步问服务端 /resolve-path 取绝对路径；网络失败时回落到相对路径。
      const fallback = formatPosition(pos);
      apiRequest("/resolve-path", {
        method: "POST",
        body: JSON.stringify({ file: fallback }),
      })
        .then((res) => {
          const out = res?.absolutePath
            ? `${res.absolutePath}:${pos.line}:${pos.col}`
            : fallback;
          void navigator.clipboard.writeText(out);
        })
        .catch(() => {
          void navigator.clipboard.writeText(fallback);
        });
    },
    del: () => {
      void deleteElementViaApi(element);
    },
  };

  const menuItems: MenuItem[] = [
    { label: "📦 在编辑器中打开", action: "open" },
    { label: "⚙️ 编辑属性", action: "props" },
    { label: "🧩 组件面板", action: "catalog" },
    { label: "✏️ 编辑代码", action: "code" },
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
      actions[option.action](element, pos!);
    };
    state.contextMenu!.appendChild(button);
  }
}
