/**
 * Toast 通知 -- 服务端 API 异常等需要用户感知的事件弹出可见提示。
 *
 * 顶层固定居中容器 `#__vdi-toast-container__`，每个 toast 自动 ~3.5s 后淡出移除；
 * 点击可立即关闭。自包含（不依赖 utils/state），避免与 utils.apiError 的循环引用。
 *
 * 结构：title（加粗，标签）+ content（详情）上下两行布局；kind 决定左色条配色：
 * error 红 / success 绿 / info 蓝。
 */

export type ToastKind = "error" | "success" | "info";

const TOAST_ID = "__vdi-toast-container__";
const DISMISS_MS = 3500;
const FADE_MS = 200;

function ensureContainer(): HTMLElement {
  let el = document.getElementById(TOAST_ID) as HTMLElement | null;
  if (el) return el;
  el = document.createElement("div");
  el.id = TOAST_ID;
  el.className = "__vdi-toast-container";
  document.body.appendChild(el);
  return el;
}

/**
 * 弹出一条 toast 通知（title + content 上下布局）。
 *
 * - `title` 加粗显示，作标签（如「复制失败」）。
 * - `content` 详情（如「请求超时：服务端无响应」）；为空时只显示 title。
 * - `kind` 决定左色条；缺省 `error`。
 * - 多条会纵向堆叠；各自独立计时。
 * - SSR / 无 document 环境直接 no-op（overlay 仅浏览器运行，防御性兜底）。
 */
export function showToast(
  title: string,
  content: string,
  kind: ToastKind = "error",
): void {
  if (typeof document === "undefined") return;
  const container = ensureContainer();
  const toast = document.createElement("div");
  toast.className = "__vdi-toast __vdi-toast-" + kind;

  const titleEl = document.createElement("div");
  titleEl.className = "__vdi-toast-title";
  titleEl.textContent = title;
  toast.appendChild(titleEl);

  if (content) {
    const contentEl = document.createElement("div");
    contentEl.className = "__vdi-toast-content";
    contentEl.textContent = content;
    toast.appendChild(contentEl);
  }

  container.appendChild(toast);
  // 入场：下一帧加 visible 类触发过渡
  requestAnimationFrame(() => toast.classList.add("__vdi-toast-visible"));
  const timer = window.setTimeout(() => dismiss(toast), DISMISS_MS);
  // 点击立即关闭（清 timer 避免重复 dismiss）
  toast.addEventListener("click", () => {
    window.clearTimeout(timer);
    dismiss(toast);
  });
}

function dismiss(toast: HTMLElement): void {
  if (!toast.parentNode) return;
  toast.classList.remove("__vdi-toast-visible");
  window.setTimeout(() => {
    if (toast.parentNode) toast.parentNode.removeChild(toast);
  }, FADE_MS);
}
