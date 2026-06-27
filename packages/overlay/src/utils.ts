/**
 * 纯计算工具函数——无 DOM 副作用。
 */
import { state } from "./state";

/** 解析形如 `path/file.vue:line:col` 的位置串。 */
export function parsePosition(value: string): {
  file: string;
  line: string;
  col: string;
} {
  const lastColon = value.lastIndexOf(":");
  const prevColon = value.lastIndexOf(":", lastColon - 1);
  return {
    file: value.substring(0, prevColon),
    line: value.substring(prevColon + 1, lastColon),
    col: value.substring(lastColon + 1),
  };
}

/** 调用插件提供的服务端 API。 */
export interface ApiResponse<T = unknown> {
  success?: boolean;
  error?: string;
  props?: Array<{ key: string; value: string }>;
  components?: Array<{ path: string; name: string }>;
  data?: T;
}

export function apiRequest<T = unknown>(
  path: string,
  init?: RequestInit,
): Promise<ApiResponse<T>> {
  return fetch(
    state.apiPrefix + path,
    Object.assign(
      { headers: { "Content-Type": "application/json" } },
      init || {},
    ),
  ).then(function (response) {
    return response.json() as Promise<ApiResponse<T>>;
  });
}

/** 读取元素的展示标签（优先取注入的 tag 属性，否则取小写标签名）。 */
export function getElementTagName(element: HTMLElement): string {
  return element.getAttribute(state.tagAttr) || element.tagName.toLowerCase();
}

/** 创建 DOM 元素，可附带 class 名与初始文本。 */
export function createElement<T extends HTMLElement = HTMLDivElement>(
  tag: string,
  className?: string,
  textContent?: string,
): T {
  const element = document.createElement(tag) as T;
  if (className) element.className = className;
  if (textContent) element.textContent = textContent;
  return element;
}

/** 从事件目标向上查找带审查属性的可审查元素。 */
export function findInspectableElement(
  target: EventTarget | null,
): HTMLElement | null {
  let node = target as HTMLElement | null;
  while (node && node !== document.documentElement) {
    if (
      (node as HTMLElement).getAttribute &&
      (node as HTMLElement).getAttribute(state.attrName)
    )
      return node;
    node = (node as HTMLElement).parentElement;
  }
  return null;
}

/** 对 `display:contents` 元素取首个子元素作为定位盒。 */
export function getLayoutBox(element: HTMLElement | null): HTMLElement | null {
  if (
    element &&
    getComputedStyle(element).display === "contents" &&
    element.firstElementChild
  )
    return element.firstElementChild as HTMLElement;
  return element;
}

/** 按目标元素盒形定位 overlay 并扩展外边距 d 像素。 */
export function positionOverlay(
  overlay: HTMLDivElement,
  element: HTMLElement,
  margin: number,
): void {
  const rect = getLayoutBox(element)!.getBoundingClientRect();
  Object.assign(overlay.style, {
    display: "block",
    left: rect.left - margin + "px",
    top: rect.top - margin + "px",
    width: rect.width + margin * 2 + "px",
    height: rect.height + margin * 2 + "px",
  });
}

/**
 * 根据光标在目标盒中的 Y 位置，返回放置方向：
 *   top 1/3 → 'before'（同级上方）
 *   中 1/3  → 'inside'（目标内部末尾）
 *   底 1/3 → 'after'（同级下方）
 */
export function computeDropDirection(
  rect: { top: number; height: number },
  clientY: number,
): "before" | "inside" | "after" {
  const y = clientY - rect.top;
  if (y < rect.height / 3) return "before";
  if (y < (rect.height * 2) / 3) return "inside";
  return "after";
}
