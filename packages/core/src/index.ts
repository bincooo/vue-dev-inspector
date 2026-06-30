export { default, vueDevInspector } from "./plugin";
export type { DevInspectorOptions } from "./options";

// ─── 浏览器端扩展 API 顶层导出 ────────────────────────────────
// overlay IIFE 在 init() 末尾把内部注册函数挂到 window.__VDI_HOST__，
// 这里仅作为薄壳代理；不在 Node 端可用。
import type {
  ActionButtonDef,
  EventCallback,
  InspectEvent,
  SelectEvent,
  Unregister,
} from '@vdi/shared';

interface VdiHost {
  registerBtn(btns: ActionButtonDef[]): Unregister;
  onInspect(cb: EventCallback<InspectEvent>): Unregister;
  onSelect(cb: EventCallback<SelectEvent>): Unregister;
}

declare global {
  interface Window {
    __VDI_HOST__?: VdiHost;
  }
}

function getHost(): VdiHost {
  if (typeof window === 'undefined') {
    throw new Error('[vdi] addToolBtn / onInspect / onSelect 仅在浏览器端可用');
  }
  const host = window.__VDI_HOST__;
  if (!host) {
    throw new Error('[vdi] overlay IIFE 未加载或 init 失败；请确认 dev 模式并已构建 overlay');
  }
  return host;
}

export function addToolBtn(...btns: ActionButtonDef[]): Unregister {
  return getHost().registerBtn(btns);
}

export function onInspect(cb: EventCallback<InspectEvent>): Unregister {
  return getHost().onInspect(cb);
}

export function onSelect(cb: EventCallback<SelectEvent>): Unregister {
  return getHost().onSelect(cb);
}
