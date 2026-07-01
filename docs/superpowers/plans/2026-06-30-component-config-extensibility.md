# Inspector Extensibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 `vue-dev-inspector` 增加两条扩展能力：派发"进入审查 / 选中组件"事件回调；允许用户注册自定义工具按钮（`addToolBtn`）渲染在选中元素右侧。

**Architecture:** 三层职责分明 —— `@vue-dev-inspector/shared` 提供类型与常量；`@vue-dev-inspector/overlay` 维护 callback Set 与 button Map，并在 inspector 状态机派发；`@vue-dev-inspector/core` 通过 `window.__VDI_HOST__` 桥暴露 `addToolBtn / onInspect / onSelect` 顶层函数。调用者 `import { addToolBtn } from '@vue-dev-inspector/core'` 即可。

**Tech Stack:** TypeScript、@vue/compiler-core、pnpm monorepo、vitest@^2（新增到 overlay devDep）、Vite 插件体系。

## Global Constraints

1. **零破坏性**：现有 4 个硬编码按钮（删除/复制/前后插入）、5 项右键菜单、`componentConfig` 物料抽屉行为完全不变。
2. **类型主导**：所有扩展点先在 `@vue-dev-inspector/shared` 定义类型；`@vue-dev-inspector/core` 与 `@vue-dev-inspector/overlay` 都从 shared 导入。
3. **包归属**：仅 `@vue-dev-inspector/shared` 与 `@vue-dev-inspector/overlay` 加新文件/字段；`@vue-dev-inspector/core` 仅导出顶层函数壳子；`@vue-dev-inspector/client` 与 `@vue-dev-inspector/antdv` 不改动。
4. **事件派发边界**：仅派发"进入审查"（`inspecting: false → true`）与"选中/取消选中"（`setSelectedElement`）两类；hover 状态切换、`toggle(true → false)` 退场不派发任何事件。
5. **回调载体**：用 `Set<callback>` 而非 DOM `CustomEvent`；`onInspect` / `onSelect` 返回反注册函数 `() => void`。
6. **按钮位置**：选中框右侧浮动列表；多按钮垂直堆叠（间距 4px）；同 `id` 重复 `addToolBtn` 视为覆盖而非追加。
7. **按钮定义全局共享**：按钮与 `componentConfig` 解耦；不在 `ComponentConfigEntry` 上加 `actionBtn` 字段。
8. **错误隔离**：单个回调抛错不得影响其他回调派发；不阻塞 inspector 主流程。
9. **代码风格**：中文注释、英文标识符；CSS 类名 `__vdi-` 前缀保持；动态布局 JS 内联、静态样式写 `overlay.css`。
10. **包管理器**：pnpm；ESM-only；改动后必须重建对应包并由用户跑 `pnpm dev:demo` 验证（CLAUDE.md 规定 AI 不启动服务）。
11. **测试**：新增 `vitest@^2` 作为 overlay 包 devDep；新增 `packages/overlay/test/extensibility.test.ts`；类型层全包 `tsc --noEmit` 必须通过。
12. **命名锁定**：`ActionButtonDef`（类型）+ `addToolBtn`（注册函数）；**不要**使用旧名 `vdiActionBtn` / `addBtn` / `addButton` / `addToolButtons`。
13. **失败语义**：浏览器外（非 `window`）调用 `addToolBtn/onInspect/onSelect` 抛 `[vdi] 仅在浏览器端可用`；overlay 未加载抛 `[vdi] overlay IIFE 未加载`。
14. **依赖**：overlay devDep 加 `vitest@^2` + `jsdom@^24`；其他包不增依赖。

---

## File Structure

| 文件 | 职责 |
|---|---|
| `packages/shared/src/extensibility.ts` (新) | `ActionButtonDef` / `InspectEvent` / `SelectEvent` / `EventCallback` / `Unregister` / `ActionButtonPosition` 类型 |
| `packages/shared/src/index.ts` (改) | 加 `export * from './extensibility';` |
| `packages/overlay/src/extensibility.ts` (新) | `registerBtn` / `onInspect` / `onSelect` / `emitInspect` / `emitSelect` / `installHost` 实现 |
| `packages/overlay/src/state.ts` (改) | 加 `toolButtons` / `inspectCallbacks` / `selectCallbacks` 三个字段；`setSelectedElement` 末尾调 `emitSelect` |
| `packages/overlay/src/inspector.ts` (改) | 加 `renderToolButtons` / `clearToolButtons` / `positionToolButtons`；`toggle(enabled)` 末尾调 `emitInspect` |
| `packages/overlay/src/index.ts` (改) | `init()` 末尾调 `installHost()` |
| `packages/overlay/src/overlay.css` (改) | 加 `.__vdi-tool-buttons` 与 `.__vdi-tool-btn` 静态样式 |
| `packages/overlay/vitest.config.ts` (新) | jsdom 环境 + include `test/**/*.test.ts` |
| `packages/overlay/test/extensibility.test.ts` (新) | 7 个单元测试用例 |
| `packages/overlay/package.json` (改) | 加 `vitest` + `jsdom` 到 devDependencies；加 `test` script |
| `packages/core/src/index.ts` (改) | 加 `addToolBtn` / `onInspect` / `onSelect` 顶层函数 + `getHost` |
| `packages/demo/src/App.vue` (改) | 加 demo `addToolBtn` / `onInspect` / `onSelect` 调用 |

---

### Task 1: shared extensibility 类型定义

**Files:**
- Create: `packages/shared/src/extensibility.ts`
- Modify: `packages/shared/src/index.ts`

**Interfaces:**
- Consumes: 现有 `ComponentConfigEntry`（独立分支，不复用）
- Produces:
  - `export type ActionButtonPosition = 'right';`
  - `export interface ActionButtonDef { id, icon, label, position, onClick, hoverColor?, baseColor? }`
  - `export interface InspectEvent { kind: 'inspect'; at: number }`
  - `export interface SelectEvent { kind: 'select'; at, target, source }`（source: `{rootIndex, file, line, col} | null`）
  - `export type EventCallback<E> = (event: E) => void`
  - `export type Unregister = () => void`

- [ ] **Step 1: 创建 `packages/shared/src/extensibility.ts`**

写入完整文件：

```ts
// Inspector 扩展性共享类型
// 本文件无运行时副作用，纯类型导出

/** 按钮在选中框周围的相对位置。当前实现仅支持 'right'，其他值保留扩展位。 */
export type ActionButtonPosition = 'right';

/** 自定义按钮定义。onClick 接收 SelectEvent。 */
export interface ActionButtonDef {
  /** 唯一 id；同 id 重复 addToolBtn 视为覆盖。 */
  id: string;
  /** 显示图标：emoji 字符串 / 短文本 / iconify 串 (`i-prefix:name`)。 */
  icon: string;
  /** 鼠标悬停 tooltip。 */
  label: string;
  /** 位置策略；当前固定 'right'。 */
  position: ActionButtonPosition;
  /** 选中状态下点击触发。 */
  onClick: (event: SelectEvent) => void;
  /** 悬停背景色（可选）；缺省 #3b82f6。 */
  hoverColor?: string;
  /** 基础背景色（可选）；缺省 #ffffff。 */
  baseColor?: string;
}

/** 进入审查模式事件。 */
export interface InspectEvent {
  kind: 'inspect';
  /** 触发时间戳（毫秒）。 */
  at: number;
}

/** 选中 / 取消选中事件。target=null 表示取消选中。 */
export interface SelectEvent {
  kind: 'select';
  at: number;
  /** 当前选中元素；null 时为取消选中。 */
  target: HTMLElement | null;
  /** 若 target 非 null 且带 data-source-file 属性，解析后的位置；否则 null。 */
  source: { rootIndex: number; file: string; line: number; col: number } | null;
}

/** 事件回调签名。 */
export type EventCallback<E> = (event: E) => void;

/** 反注册函数。 */
export type Unregister = () => void;
```

- [ ] **Step 2: 修改 `packages/shared/src/index.ts` 加 re-export**

在文件末尾追加：

```ts
export * from './extensibility';
```

（确认末尾已有 `export * from './componentConfig';` 与 `export * from './paths';` 等行，新行追加到最末即可，不调整顺序。）

- [ ] **Step 3: 验证 shared 类型层通过**

```bash
pnpm -C packages/shared exec tsc --noEmit
```

Expected: 退出码 0，无输出。

- [ ] **Step 4: 提交**

```bash
git add packages/shared/src/extensibility.ts packages/shared/src/index.ts
git commit -m "feat(shared): add extensibility types (ActionButtonDef, InspectEvent, SelectEvent)"
```

---

### Task 2: overlay state 注册表字段

**Files:**
- Modify: `packages/overlay/src/state.ts`

**Interfaces:**
- Consumes: `ActionButtonDef` / `EventCallback` / `InspectEvent` / `SelectEvent`（来自 `@vue-dev-inspector/shared`）
- Produces:
  - `state.toolButtons: Map<string, ActionButtonDef>`
  - `state.inspectCallbacks: Set<EventCallback<InspectEvent>>`
  - `state.selectCallbacks: Set<EventCallback<SelectEvent>>`
  - `setSelectedElement(el)` 末尾调 `emitSelect(el)`（emitSelect 在 Task 4 实现，本步仅留调用点注释）

- [ ] **Step 1: 修改 `packages/overlay/src/state.ts`**

定位到 `export const state = { ... };` 块（inspector 状态字段定义处）。在 `selectedElement` 字段之后追加：

```ts
  // ─── extensibility 注册表 ────────────────────────────────
  /** 自定义工具按钮；id → def。同 id 重复 addToolBtn 视为覆盖。 */
  toolButtons: new Map<string, ActionButtonDef>(),
  /** 进入审查模式回调集合。 */
  inspectCallbacks: new Set<EventCallback<InspectEvent>>(),
  /** 选中 / 取消选中回调集合。 */
  selectCallbacks: new Set<EventCallback<SelectEvent>>(),
```

并在文件顶部 import 区追加：

```ts
import type {
  ActionButtonDef,
  EventCallback,
  InspectEvent,
  SelectEvent,
} from '@vue-dev-inspector/shared';
```

- [ ] **Step 2: 类型层验证 overlay 通过**

```bash
pnpm -C packages/overlay exec tsc --noEmit
```

Expected: 退出码 0。注意：因为 `state` 对象在 `index.ts` 顶层初始化即执行，本步不引入运行时调用点，应无错误。

- [ ] **Step 3: 提交**

```bash
git add packages/overlay/src/state.ts
git commit -m "feat(overlay): add extensibility registry fields to state"
```

---

### Task 3: overlay extensibility 运行时实现（含 vitest + 单元测试）

**Files:**
- Create: `packages/overlay/src/extensibility.ts`
- Create: `packages/overlay/vitest.config.ts`
- Create: `packages/overlay/test/extensibility.test.ts`
- Modify: `packages/overlay/package.json`

**Interfaces:**
- Consumes: `state`（来自 `./state`）、`ActionButtonDef` / `InspectEvent` / `SelectEvent`（来自 `@vue-dev-inspector/shared`）、`parsePosition`（来自 `./utils`）
- Produces:
  - `registerBtn(btns: ActionButtonDef[]): Unregister`
  - `onInspect(cb: EventCallback<InspectEvent>): Unregister`
  - `onSelect(cb: EventCallback<SelectEvent>): Unregister`
  - `emitInspect(): void`
  - `emitSelect(target: HTMLElement | null): void`
  - `installHost(): void`

注意：本任务**不**调用 `renderToolButtons` / `clearToolButtons`（它们在 Task 4 才实现）。本任务中 `registerBtn` 仅操作 `state.toolButtons` Map，不触发 DOM 渲染。

- [ ] **Step 1: 修改 `packages/overlay/package.json`**

在 `devDependencies` 块中追加（保留原有字段不变）：

```json
    "vitest": "^2.1.0",
    "jsdom": "^24.0.0"
```

在 `scripts` 块中追加：

```json
    "test": "vitest run"
```

（注意保持 JSON 合法——确保前置行尾逗号。）

- [ ] **Step 2: 创建 `packages/overlay/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.ts'],
  },
});
```

- [ ] **Step 3: 写失败测试 `packages/overlay/test/extensibility.test.ts`**

```ts
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
```

- [ ] **Step 4: 跑测试，确认失败**

```bash
pnpm -C packages/overlay test
```

Expected: 失败，提示 `Cannot find module '../src/extensibility'`。

- [ ] **Step 5: 实现 `packages/overlay/src/extensibility.ts`**

```ts
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
} from '@vue-dev-inspector/shared';
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
```

- [ ] **Step 6: 跑测试，确认通过**

```bash
pnpm -C packages/overlay test
```

Expected: 7 个用例全过（PASS 7 / FAIL 0）。

- [ ] **Step 7: 提交**

```bash
git add packages/overlay/package.json packages/overlay/vitest.config.ts packages/overlay/test/extensibility.test.ts packages/overlay/src/extensibility.ts
git commit -m "feat(overlay): add extensibility runtime (registerBtn/onInspect/onSelect + emit/install)"
```

---

### Task 4: overlay 渲染工具按钮 + 派发点接入状态机

**Files:**
- Modify: `packages/overlay/src/inspector.ts`
- Modify: `packages/overlay/src/state.ts`
- Modify: `packages/overlay/src/overlay.css`

**Interfaces:**
- Consumes: `renderToolButtons(selectedEl)` / `clearToolButtons()`（来自 `./inspector`，本任务实现）；`emitInspect()` / `emitSelect(target)`（来自 `./extensibility`，Task 3 已实现）
- Produces:
  - `inspector.ts` 导出 `renderToolButtons` / `clearToolButtons`
  - `inspector.ts` 内 `toggle(enabled)` 末尾：`enabled ? emitInspect() : (state.selectedElement && setSelectedElement(null))`
  - `state.ts` 内 `setSelectedElement(el)` 末尾：`el ? renderToolButtons(el) : clearToolButtons(); emitSelect(el);`

- [ ] **Step 1: 在 `packages/overlay/src/inspector.ts` 顶部 import 区追加**

```ts
import { emitInspect } from './extensibility';
import type { SelectEvent } from '@vue-dev-inspector/shared';
```

- [ ] **Step 2: 在 `inspector.ts` 顶部（已有 `createActionBtn`/`positionActionButtons` 旁边）追加模块级容器与渲染函数**

定位到 `inspector.ts` 中 `positionActionButtons` 函数定义附近。在其下方追加：

```ts
// ─── 自定义工具按钮（注册式） ────────────────────────────────

let toolButtonContainer: HTMLDivElement | null = null;

/** 把当前所有 toolButtons 渲染到选中元素右侧；空集合直接返回。 */
export function renderToolButtons(selectedEl: HTMLElement): void {
  if (state.toolButtons.size === 0) return;

  if (!toolButtonContainer) {
    toolButtonContainer = createElement<HTMLDivElement>('div', '__vdi-tool-buttons');
    Object.assign(toolButtonContainer.style, {
      position: 'fixed',
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
      zIndex: '2147483646',
      pointerEvents: 'auto',
    });
    document.body.appendChild(toolButtonContainer);
  }

  toolButtonContainer.innerHTML = '';

  for (const def of state.toolButtons.values()) {
    const btn = createElement<HTMLButtonElement>('button', '__vdi-tool-btn');
    btn.textContent = def.icon;
    btn.title = def.label;
    btn.setAttribute('data-tool-btn-id', def.id);
    Object.assign(btn.style, {
      width: '28px',
      height: '28px',
      border: 'none',
      borderRadius: '4px',
      background: def.baseColor ?? '#ffffff',
      cursor: 'pointer',
      boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
      fontSize: '14px',
    });
    btn.onmouseenter = () => {
      btn.style.background = def.hoverColor ?? '#3b82f6';
      btn.style.color = '#fff';
    };
    btn.onmouseleave = () => {
      btn.style.background = def.baseColor ?? '#ffffff';
      btn.style.color = 'inherit';
    };
    btn.onclick = (ev) => {
      ev.stopPropagation();
      const raw = selectedEl.getAttribute(state.attrName);
      const parsed = raw ? parsePosition(raw) : null;
      const event: SelectEvent = {
        kind: 'select',
        at: Date.now(),
        target: selectedEl,
        source: parsed
          ? {
              rootIndex: parsed.rootIndex,
              file: parsed.file,
              line: Number(parsed.line),
              col: Number(parsed.col),
            }
          : null,
      };
      def.onClick(event);
    };
    toolButtonContainer.appendChild(btn);
  }

  positionToolButtons(selectedEl);
}

/** 清空容器内容；保留 DOM 节点以便下次渲染复用。 */
export function clearToolButtons(): void {
  if (toolButtonContainer) {
    toolButtonContainer.innerHTML = '';
  }
}

function positionToolButtons(selectedEl: HTMLElement): void {
  if (!toolButtonContainer) return;
  const rect = getLayoutBox(selectedEl)!.getBoundingClientRect();
  Object.assign(toolButtonContainer.style, {
    top: `${rect.top}px`,
    left: `${rect.right + 4}px`,
  });
}
```

并在文件顶部 import 区追加：

```ts
import { parsePosition } from './utils';
```

（如已有该 import 则跳过）

- [ ] **Step 3: 修改 `toggle(enabled)` 函数**

定位到 `inspector.ts` 中 `function toggle(enabled: boolean)`。在函数体末尾追加：

```ts
  if (enabled) {
    emitInspect();
  } else if (state.selectedElement) {
    setSelectedElement(null);
  }
```

（注意：如果 toggle 函数体内已有 `setSelectedElement(null)` 处理，则保留之；若没有，本步追加。）

- [ ] **Step 4: 修改 `packages/overlay/src/state.ts` 的 `setSelectedElement`**

定位到 `setSelectedElement` 函数定义：

```ts
export function setSelectedElement(el: HTMLElement | null): void {
  state.selectedElement = el;
  if (el) {
    renderToolButtons(el);
  } else {
    clearToolButtons();
  }
  emitSelect(el);
}
```

（保留原有 state.selectedElement 赋值；在末尾追加 render + emit。）

并在文件顶部 import 区追加：

```ts
import { emitSelect } from './extensibility';
import { renderToolButtons, clearToolButtons } from './inspector';
```

- [ ] **Step 5: 修改 `packages/overlay/src/overlay.css`**

定位到 `__vdi-` 样式块末尾（保留原有所有规则）。追加：

```css
/* ─── 自定义工具按钮（extensibility 注册式） ──────────────── */

.__vdi-tool-buttons {
  /* 容器静态占位；动态 left/top 走 JS 内联 */
}

.__vdi-tool-btn {
  transition: background 120ms ease, color 120ms ease;
}

.__vdi-tool-btn:focus {
  outline: 2px solid #3b82f6;
  outline-offset: 1px;
}
```

- [ ] **Step 6: 验证 overlay 类型层通过**

```bash
pnpm -C packages/overlay exec tsc --noEmit
```

Expected: 退出码 0。

- [ ] **Step 7: 跑 overlay 单元测试**

```bash
pnpm -C packages/overlay test
```

Expected: 7/7 PASS。

- [ ] **Step 8: 提交**

```bash
git add packages/overlay/src/inspector.ts packages/overlay/src/state.ts packages/overlay/src/overlay.css
git commit -m "feat(overlay): render tool buttons + wire emit into inspector state machine"
```

---

### Task 5: overlay installHost 挂到 window

**Files:**
- Modify: `packages/overlay/src/index.ts`

**Interfaces:**
- Consumes: `installHost()`（来自 `./extensibility`，Task 3 已实现）
- Produces: overlay init 流程末尾多一行 `installHost();` 调用

- [ ] **Step 1: 修改 `packages/overlay/src/index.ts`**

定位到 init 函数（通常形如 `export function init() { ... }`）。在函数体末尾追加：

```ts
  installHost();
```

并在文件顶部 import 区追加：

```ts
import { installHost } from './extensibility';
```

- [ ] **Step 2: 验证 overlay 类型层 + 构建产物**

```bash
pnpm -C packages/overlay exec tsc --noEmit
pnpm -C packages/overlay build
```

Expected: tsc exit 0；vite build 在 `packages/overlay/dist/overlay.iife.js` 生成新产物。

- [ ] **Step 3: 提交**

```bash
git add packages/overlay/src/index.ts packages/overlay/dist/overlay.iife.js
git commit -m "feat(overlay): install __VDI_HOST__ window bridge in init()"
```

注意：dist 文件可能被 .gitignore 排除——若是，先 `git check-ignore -v packages/overlay/dist/overlay.iife.js` 确认；如果 ignore，提交时跳过 dist 文件，只提交 src 修改，并在 commit message 里说明。

---

### Task 6: core 暴露 addToolBtn / onInspect / onSelect 顶层函数

**Files:**
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Consumes: `ActionButtonDef` / `EventCallback` / `InspectEvent` / `SelectEvent`（来自 `@vue-dev-inspector/shared`）
- Produces:
  - 顶层 export `function addToolBtn(...btns: ActionButtonDef[]): Unregister`
  - 顶层 export `function onInspect(cb: EventCallback<InspectEvent>): Unregister`
  - 顶层 export `function onSelect(cb: EventCallback<SelectEvent>): Unregister`
  - 内部 `function getHost(): VdiHost`（typed window 桥）

- [ ] **Step 1: 修改 `packages/core/src/index.ts`**

定位到文件末尾（`vueDevInspector` 定义之后）。在末尾追加：

```ts
// ─── 浏览器端扩展 API 顶层导出 ────────────────────────────────
// overlay IIFE 在 init() 末尾把内部注册函数挂到 window.__VDI_HOST__，
// 这里仅作为薄壳代理；不在 Node 端可用。

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
```

并在文件顶部 import 区追加：

```ts
import type {
  ActionButtonDef,
  EventCallback,
  InspectEvent,
  SelectEvent,
  Unregister,
} from '@vue-dev-inspector/shared';
```

- [ ] **Step 2: 验证 core 类型层通过**

```bash
pnpm -C packages/core exec tsc --noEmit
```

Expected: 退出码 0。

- [ ] **Step 3: 提交**

```bash
git add packages/core/src/index.ts
git commit -m "feat(core): expose addToolBtn/onInspect/onSelect top-level functions"
```

---

### Task 7: demo App.vue 加 demo 调用

**Files:**
- Modify: `packages/demo/src/App.vue`

**Interfaces:**
- Consumes: `addToolBtn` / `onInspect` / `onSelect`（来自 `@vue-dev-inspector/core`，Task 6 已实现）
- Produces: 用户级 demo 注册调用，便于手动 E2E 验证

- [ ] **Step 1: 修改 `packages/demo/src/App.vue`**

定位到 `<script setup>` 块。在 import 区之后、`onMounted` 等钩子之前（或者文件最末 `onMounted` 之后），追加：

```ts
// ─── Inspector 扩展能力 demo 调用 ────────────────────────────
import { addToolBtn, onInspect, onSelect } from '@vue-dev-inspector/core';

addToolBtn(
  {
    id: 'demo-wrap',
    icon: '📦',
    label: 'demo: 包一层div',
    position: 'right',
    onClick: (e) => console.log('[demo] wrap clicked, source =', e.source),
  },
  {
    id: 'demo-goto',
    icon: '🔗',
    label: 'demo: 跳转 API',
    position: 'right',
    onClick: (e) => console.log('[demo] goto clicked, source =', e.source),
  },
);

onSelect((e) => {
  console.log('[demo] select', e.target?.tagName, e.source);
});

onInspect(() => {
  console.log('[demo] enter inspect mode');
});
```

（如该文件已有 `import { ... } from '@vue-dev-inspector/core';` 行，则合并到现有 import 中，不要重复声明。）

- [ ] **Step 2: 验证 demo 类型层**

demo 包通常无独立 tsconfig（走 Vite）。如果 demo 根目录有 `tsconfig.json` 或 Vite 启动时能检查类型，则：

```bash
pnpm -C packages/demo exec tsc --noEmit 2>&1 || true
```

Expected: 不报模块未找到错误；如有 Vite 解析错误须修正。

- [ ] **Step 3: 提交**

```bash
git add packages/demo/src/App.vue
git commit -m "feat(demo): register addToolBtn/onInspect/onSelect demo calls"
```

---

### Task 8: 全包类型检查 + 端到端构建验证

**Files:** (无；纯验证)

**Interfaces:**
- 验证 `vueDevInspector({...})` plugin + 扩展 API 整链路编译通过

- [ ] **Step 1: 全包 tsc**

```bash
for p in shared client core overlay antdv; do
  echo "=== $p ==="
  pnpm -C packages/$p exec tsc --noEmit
done
```

Expected: 5 个包全 exit 0。

- [ ] **Step 2: overlay 单元测试**

```bash
pnpm -C packages/overlay test
```

Expected: 7/7 PASS。

- [ ] **Step 3: 顺序构建**

```bash
pnpm build:core
pnpm -C packages/antdv build
```

Expected: core → overlay → client → core 链路产物全部生成在 `packages/*/dist/`。

- [ ] **Step 4: 文档注释兜底 grep**

```bash
grep -rn 'vue-dev-inspector\|vdiActionBtn\|addBtn\b' packages --include='*.ts' --include='*.tsx' --include='*.vue' || echo 'clean'
```

Expected: `clean`（无匹配）。如有命中，标记为后续清理项，不阻塞本任务。

- [ ] **Step 5: 用户跑 `pnpm dev:demo` 手动验证（不在 AI 范围）**

由用户在终端执行：

```bash
pnpm dev:demo
```

打开浏览器后：
1. 进入审查（Alt+Shift+I）→ console 输出 `[demo] enter inspect mode`
2. 选中元素 → 选中框右侧出现 📦、🔗 按钮；console 输出 `[demo] select DIV {…}`
3. 点击 📦 → console 输出 `[demo] wrap clicked, source = {rootIndex: 0, file: '…', line: N, col: M}`
4. Esc 退出 → 按钮消失

- [ ] **Step 6: 最终提交（如有修正）**

若 Step 1-4 全部通过且无遗留 grep 命中，**本任务无代码改动**，仅记录结果到 conversation summary。

---

## Self-Review Checklist

- [x] **Spec coverage**：
  - §1 架构总览 → 全局分散到 §3-§7 各任务
  - §2 shared 类型定义 → Task 1
  - §3 core plugin 顶层导出 → Task 6
  - §4 overlay 内部注册表 → Tasks 2, 3, 4, 5
  - §5 渲染与状态机 → Task 4
  - §6 测试策略 → Tasks 3, 8
  - §7 范围与 YAGNI → Tasks 全部遵守；Task 8 grep 兜底
- [x] **Placeholder 扫描**：0 处 TBD/TODO/"implement later"
- [x] **类型一致性**：`ActionButtonDef` / `InspectEvent` / `SelectEvent` / `EventCallback` / `Unregister` / `ActionButtonPosition` 在 Task 1 定义，Tasks 2-7 全部从 `@vue-dev-inspector/shared` 引用，无重复定义
- [x] **命名一致性**：注册函数统一 `addToolBtn`；不出现 `addBtn` / `addButton` / `addToolButtons` / `vdiActionBtn`
- [x] **失败语义**：Task 6 getHost 抛两条具体错信息，与 spec §7.4 一致
- [x] **错误隔离**：Task 3 emitInspect / emitSelect 内 try/catch
- [x] **覆盖范围**：8 个任务，每个独立可测试 / 可审核