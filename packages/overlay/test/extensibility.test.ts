import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  registerBtn,
  onInspect,
  onSelect,
  emitInspect,
  emitSelect,
} from '../src/extensibility';
import { state } from '../src/state';

describe('extensibility registry', () => {
  beforeEach(() => {
    state.toolButtons.clear();
    state.inspectCallbacks.clear();
    state.selectCallbacks.clear();
  });

  it('registerBtn adds to map and supports same-id overwrite', () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    registerBtn([{ id: 'a', icon: 'X', label: 'lbl', position: 'right', onClick: cb1 }]);
    registerBtn([{ id: 'a', icon: 'Y', label: 'lbl', position: 'right', onClick: cb2 }]);
    expect(state.toolButtons.size).toBe(1);
    expect(state.toolButtons.get('a')!.icon).toBe('Y');
  });

  it('registerBtn returns unregister function that removes entries', () => {
    const off = registerBtn([{ id: 'x', icon: '1', label: 'l', position: 'right', onClick: () => {} }]);
    expect(state.toolButtons.size).toBe(1);
    off();
    expect(state.toolButtons.size).toBe(0);
  });

  it('emitInspect calls all inspect callbacks with correct shape', () => {
    const cb = vi.fn();
    onInspect(cb);
    emitInspect();
    expect(cb).toHaveBeenCalledWith({ kind: 'inspect', at: expect.any(Number) });
  });

  it('emitSelect with target attaches parsed source', () => {
    const cb = vi.fn();
    onSelect(cb);
    const el = document.createElement('div');
    el.setAttribute('data-source-file', 'r0:src/Foo.vue:10:4');
    emitSelect(el);
    expect(cb).toHaveBeenCalledWith({
      kind: 'select',
      at: expect.any(Number),
      target: el,
      source: { rootIndex: 0, file: 'src/Foo.vue', line: 10, col: 4 },
    });
  });

  it('emitSelect with null attaches source: null', () => {
    const cb = vi.fn();
    onSelect(cb);
    emitSelect(null);
    expect(cb).toHaveBeenCalledWith(expect.objectContaining({ target: null, source: null }));
  });

  it('callback error does not break sibling callbacks', () => {
    const cb1 = vi.fn(() => { throw new Error('boom'); });
    const cb2 = vi.fn();
    onInspect(cb1);
    onInspect(cb2);
    expect(() => emitInspect()).not.toThrow();
    expect(cb2).toHaveBeenCalled();
  });

  it('onInspect returns unregister function', () => {
    const cb = vi.fn();
    const off = onInspect(cb);
    off();
    emitInspect();
    expect(cb).not.toHaveBeenCalled();
  });
});
