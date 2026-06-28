/**
 * 纯计算工具函数——无 DOM 副作用。
 */
import { state } from "./state";
import type { PropEntry } from "./types";

const POS_RE = /^(.*):(\d+):(\d+)$/;

/** 解析形如 `path/file.vue:line:col` 的位置串。 */
export function parsePosition(value: string): {
  file: string;
  line: string;
  col: string;
} {
  const [, file, line, col] = value.match(POS_RE)!;
  return { file, line, col };
}

/** 把 `{file,line,col}` 类型位置对象格式化回 `file:line:col` 串。 */
export function formatPosition(pos: {
  file: string;
  line: string | number;
  col: string | number;
}): string {
  return pos.file + ":" + pos.line + ":" + pos.col;
}

/** 读取元素上的位置属性并解析为结构化位置。 */
export function readPosition(element: HTMLElement): {
  file: string;
  line: string;
  col: string;
} | null {
  const raw = element.getAttribute(state.attrName);
  return raw ? parsePosition(raw) : null;
}

/** 调用插件提供的服务端 API。 */
export interface ApiResponse<T = unknown> {
  success?: boolean;
  error?: string;
  props?: PropEntry[];
  components?: Array<{ path: string; name: string }>;
  data?: T;
}

export function apiRequest<T = unknown>(
  path: string,
  init?: RequestInit,
): Promise<ApiResponse<T>> {
  return fetch(state.apiPrefix + path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  }).then((response) => response.json() as Promise<ApiResponse<T>>);
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
    if (node.nodeType === Node.ELEMENT_NODE && node.getAttribute(state.attrName))
      return node;
    node = node.parentElement;
  }
  return null;
}

/** 对 `display:contents` 元素取首个子元素作为定位盒。 */
export function getLayoutBox(element: HTMLElement | null): HTMLElement | null {
  if (!element) return element;
  if (
    getComputedStyle(element).display === "contents" &&
    element.firstElementChild
  ) {
    return element.firstElementChild as HTMLElement;
  }
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

import type { DropDirection } from "./state";

/**
 * 根据光标在目标盒中的 Y 位置，返回放置方向：
 *   top 1/3 → 'before'（同级上方）
 *   中 1/3  → 'inside'（目标内部末尾）
 *   底 1/3 → 'after'（同级下方）
 */
export function computeDropDirection(
  rect: { top: number; height: number },
  clientY: number,
): DropDirection {
  const y = clientY - rect.top;
  if (y < rect.height / 3) return "before";
  if (y < (rect.height * 2) / 3) return "inside";
  return "after";
}

/* ─── 控制台日志模板 ───────────────────────────────────────── */

const BRAND = "[Vue DevInspector]";

/** 「蓝色 + 加粗」品牌前缀 + 信息。 */
export function logInfo(msg: string): void {
  console.log(
    "%c" + BRAND + "%c " + msg,
    "color:#3b82f6;font-weight:bold",
    "color:inherit",
  );
}

/** 「绿色 + 加粗」品牌前缀 + 成功信息。 */
export function logSuccess(msg: string): void {
  console.log(
    "%c" + BRAND + "%c " + msg,
    "color:#10b981;font-weight:bold",
    "color:inherit",
  );
}

/** 「红色」品牌前缀 + 报错信息（首参作标签，第二参接描述）。 */
export function logError(label: string, detail: string): void {
  console.warn(BRAND + " " + label + "：", detail);
}
