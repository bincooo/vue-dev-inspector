/**
 * Inspector 扩展性运行时实现。
 * 注册 callback Set / button Map；提供派发函数；installHost 把 API 挂到 window。
 */
import type {
  ActionButtonDef,
  EventCallback,
  InspectEvent,
  SelectEvent,
  Unregister,
} from '@vdi/shared';
import { state } from './state';
import { parsePosition } from './utils';

/** 注册一组自定义工具按钮；同 id 覆盖。返回反注册函数。 */
export function registerBtn(btns: ActionButtonDef[]): Unregister {
  for (const btn of btns) {
    state.toolButtons.set(btn.id, btn);
  }
  // DOM 渲染由 Task 4 接入；本任务仅维护 Map。
  return () => {
    for (const btn of btns) {
      state.toolButtons.delete(btn.id);
    }
  };
}

/** 注册进入审查模式回调。 */
export function onInspect(cb: EventCallback<InspectEvent>): Unregister {
  state.inspectCallbacks.add(cb);
  return () => {
    state.inspectCallbacks.delete(cb);
  };
}

/** 注册选中 / 取消选中回调。 */
export function onSelect(cb: EventCallback<SelectEvent>): Unregister {
  state.selectCallbacks.add(cb);
  return () => {
    state.selectCallbacks.delete(cb);
  };
}

/** 派发"进入审查"事件。调用方负责仅在 inspecting 从 false 变 true 时调用。 */
export function emitInspect(): void {
  const event: InspectEvent = { kind: 'inspect', at: Date.now() };
  for (const cb of state.inspectCallbacks) {
    try {
      cb(event);
    } catch (err) {
      console.error('[vdi] onInspect callback threw:', err);
    }
  }
}

/** 派发"选中 / 取消选中"事件。target=null 表示取消选中。 */
export function emitSelect(target: HTMLElement | null): void {
  const raw = target ? target.getAttribute(state.attrName) : null;
  const parsed = raw ? parsePosition(raw) : null;
  const event: SelectEvent = {
    kind: 'select',
    at: Date.now(),
    target,
    source: parsed
      ? {
          rootIndex: parsed.rootIndex,
          file: parsed.file,
          line: Number(parsed.line),
          col: Number(parsed.col),
        }
      : null,
  };
  for (const cb of state.selectCallbacks) {
    try {
      cb(event);
    } catch (err) {
      console.error('[vdi] onSelect callback threw:', err);
    }
  }
}

declare global {
  interface Window {
    __VDI_HOST__?: {
      registerBtn: typeof registerBtn;
      onInspect: typeof onInspect;
      onSelect: typeof onSelect;
    };
  }
}

/** 在 overlay init() 末尾调用，把内部注册函数挂到 window.__VDI_HOST__。 */
export function installHost(): void {
  window.__VDI_HOST__ = { registerBtn, onInspect, onSelect };
}
