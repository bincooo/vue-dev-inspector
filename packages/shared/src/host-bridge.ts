/**
 * @vue-dev-inspector/shared host-bridge —— 浏览器侧 addToolBtn / onInspect / onSelect 入口
 *
 * 时序问题：浏览器加载页面时，多个 `<script type="module">` 按文档顺序 defer
 * 执行。demo 主入口（Vite 注入，含用户业务代码）在 `<head>`，overlay IIFE
 * 由 core plugin 的 transformIndexHtml 注入到 `</body>` 前——demo 模块的
 * 顶层 addToolBtn / onInspect / onSelect 调用往往**早于** IIFE 挂载
 * `window.__VDI_HOST__`。
 *
 * 本模块提供 ready 队列：host 未就绪时入队；host 出现（通过 setInterval 16ms
 * 轮询）后 flush 队列。
 *
 * overlay IIFE init() 末尾调用 `installHost({ registerBtn, onInspect,
 * onSelect, emitInspect, emitSelect })` 把内部函数引用挂到
 * `window.__VDI_HOST__`，并由本模块 flush 待执行任务。
 *
 * 调用者（core dist/index.js）只需导入 `queueAddBtn / queueOnInspect /
 * queueOnSelect` 三个入口函数；host 时序对调用者透明。
 */
import type {
  ActionButtonDef,
  EventCallback,
  InspectEvent,
  SelectEvent,
  Unregister,
} from "./extensibility";

/** overlay IIFE 暴露给 host 的内部函数集合。 */
export interface VdiHost {
  registerBtn(btns: ActionButtonDef[]): Unregister;
  onInspect(cb: EventCallback<InspectEvent>): Unregister;
  onSelect(cb: EventCallback<SelectEvent>): Unregister;
  /** 仅用于 host-bridge 主动 flush 后的可选派发；IIFE 状态机会自行派发。 */
  emitInspect(): void;
  emitSelect(target: HTMLElement | null): void;
}

declare global {
  interface Window {
    __VDI_HOST__?: VdiHost;
  }
}

/** 入队中的按钮任务。flush 时调用 host.registerBtn 并记下 unregister。 */
interface PendingBtnTask {
  kind: "btn";
  btns: ActionButtonDef[];
  unregister?: Unregister;
}
interface PendingCbTask {
  kind: "cb";
  which: "inspect" | "select";
  cb: EventCallback<InspectEvent> | EventCallback<SelectEvent>;
  unregister?: Unregister;
}
type PendingTask = PendingBtnTask | PendingCbTask;

const pending: PendingTask[] = [];
let pollTimer: ReturnType<typeof setInterval> | null = null;


/** 注册一组自定义工具按钮。host 未就绪时入队；立即返回反注册函数。 */
export function addToolBtn(...btns: ActionButtonDef[]): Unregister {
  const host = window.__VDI_HOST__;
  if (host) {
    return host.registerBtn(btns);
  }
  const task: PendingBtnTask = { kind: "btn", btns };
  pending.push(task);
  startPolling();
  return () => removePending(task);
}

/** 注册进入审查模式回调。host 未就绪时入队；立即返回反注册函数。 */
export function onInspect(
  cb: EventCallback<InspectEvent>,
): Unregister {
  const host = window.__VDI_HOST__;
  if (host) {
    return host.onInspect(cb);
  }
  const task: PendingCbTask = { kind: "cb", which: "inspect", cb };
  pending.push(task);
  startPolling();
  return () => removePending(task);
}

/** 注册选中 / 取消选中回调。host 未就绪时入队；立即返回反注册函数。 */
export function onSelect(
  cb: EventCallback<SelectEvent>,
): Unregister {
  const host = window.__VDI_HOST__;
  if (host) {
    return host.onSelect(cb);
  }
  const task: PendingCbTask = { kind: "cb", which: "select", cb };
  pending.push(task);
  startPolling();
  return () => removePending(task);
}

function removePending(task: PendingTask): void {
  const i = pending.indexOf(task);
  if (i >= 0) pending.splice(i, 1);
  // 若已 flush 且记录了 unregister，则调用真正的 unregister
  if (task.unregister) {
    try {
      task.unregister();
    } catch {
      /* swallow */
    }
  }
}

/** 启动 16ms 轮询，host 就绪后 flush 队列并停止。 */
function startPolling(): void {
  if (pollTimer != null) return;
  pollTimer = setInterval(() => {
    const host = window.__VDI_HOST__;
    if (!host) return;
    if (pollTimer != null) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    flushPending(host);
  }, 16);
}

function flushPending(host: VdiHost): void {
  const tasks = pending.splice(0, pending.length);
  for (const t of tasks) {
    try {
      if (t.kind === "btn") {
        t.unregister = host.registerBtn(t.btns);
      } else if (t.which === "inspect") {
        t.unregister = host.onInspect(t.cb as EventCallback<InspectEvent>);
      } else {
        t.unregister = host.onSelect(t.cb as EventCallback<SelectEvent>);
      }
    } catch (err) {
      console.error("[vdi] host-bridge flush failed:", err);
    }
  }
}

/**
 * overlay IIFE init() 末尾调用——把内部函数挂到 window.__VDI_HOST__，
 * 并触发队列 flush。
 *
 * 通常由 overlay/src/extensibility.ts 中的 installHost() 调用，
 * 传入当前模块导出的 registerBtn / onInspect / onSelect / emitInspect /
 * emitSelect 五个函数引用。
 */
export function installHost(host: VdiHost): void {
  window.__VDI_HOST__ = host;
  // 立即尝试 flush；startPolling 也会兜底触发
  if (pending.length > 0) flushPending(host);
  if (pollTimer != null) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}