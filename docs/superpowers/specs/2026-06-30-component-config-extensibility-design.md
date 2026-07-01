# Inspector ComponentConfig 扩展性 Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不破坏现有行为的前提下，为 `vue-dev-inspector` 增加两条扩展能力：(1) 派发"进入审查 / 选中组件"事件回调；(2) 允许用户注册自定义工具按钮，渲染在选中元素右侧。

**Architecture:** 三层职责分明 —— `@vdi/shared` 仅提供类型与常量；`@vdi/overlay` 内部维护 callback Set 与 button Map，并在 inspector 状态机的关键转换点派发；`@vdi/core` 通过 `window.__VDI_HOST__` 桥暴露顶层注册函数 `addToolBtn / onInspect / onSelect`，调用者直接从 `@vdi/core` import 即可使用。

**Tech Stack:** TypeScript、@vue/compiler-core（AST）、MagicString、pnpm monorepo、vitest（overlay 单元测试新引入）、Vite 插件体系。

## Global Constraints

1. **零破坏性**：现有 4 个硬编码按钮（删除/复制/前后插入）、5 项右键菜单、`componentConfig` 物料抽屉行为完全不变。
2. **类型主导**：所有扩展点先在 `@vdi/shared` 定义类型，`@vdi/core` 与 `@vdi/overlay` 都从 shared 导入，避免三端各自定义漂移。
3. **包归属**：仅 `@vdi/shared` 与 `@vdi/overlay` 加新文件/字段；`@vdi/core` 仅导出顶层函数壳子；`@vdi/client` 与 `@vdi/antdv` 不改动（服务端/物料桥无运行时回调语义）。
4. **事件派发边界**：仅派发"进入审查"（`inspecting: false → true`）与"选中/取消选中"（`setSelectedElement`）两类事件；hover 状态切换、`toggle(true → false)` 退场不派发任何事件。
5. **回调载体**：用 `Set<callback>` 而非 DOM `CustomEvent`；`onInspect` / `onSelect` 返回反注册函数 `() => void`。
6. **按钮位置**：选中框右侧浮动列表；多按钮垂直堆叠（间距 4px）；同 `id` 重复 `addToolBtn` 视为覆盖而非追加。
7. **按钮定义全局共享**：按钮与 `componentConfig` 解耦；不在 `ComponentConfigEntry` 上加 `actionBtn` 字段。
8. **错误隔离**：单个回调抛错不得影响其他回调派发；不阻塞 inspector 主流程。
9. **代码风格**：中文注释、英文标识符；CSS 类名 `__vdi-` 前缀保持；动态布局 JS 内联、静态样式写 `overlay.css`。
10. **包管理器**：pnpm；ESM-only；改动后必须重建对应包并由用户跑 `pnpm dev:demo` 验证（CLAUDE.md 规定 AI 不启动服务）。
11. **测试**：新增 `vitest@^2` 作为 overlay 包的 devDependency；新增 `packages/overlay/test/extensibility.test.ts`；类型层全包 `tsc --noEmit` 必须通过。

---

## §1 架构总览

```
┌─────────────────┐  window.__DEV_INSPECTOR_CFG__   ┌─────────────────┐
│   @vdi/core     │ ────────────────────────────▶  │   @vdi/overlay  │
│  (Vite plugin)  │   componentEntries + cfg JSON   │   (IIFE runtime)│
│                 │                                 │                 │
│  Exports:       │  window.__VDI_HOST__            │  state.ts:      │
│  - vueDevIns…   │ ◀──────────────────────────────│  callback Set   │
│  - addToolBtn   │   registerBtn / onInspect /     │  button Map     │
│  - onInspect    │   onSelect 闭包                │  inspect mode   │
│  - onSelect     │                                 │                 │
└─────────────────┘                                 └─────────────────┘
        ▲                                                     ▲
        │ import { ... } from '@vdi/core'                     │
        │                                                     │
   ┌────┴─────┐                                       ┌───────┴───────┐
   │ user code│                                       │ 派发点:        │
   │ demo/App │                                       │ toggle(true)   │
   └──────────┘                                       │ setSelected…() │
                                                      └───────────────┘
```

**三层职责**：

- **`@vdi/shared`**：仅类型与常量（事件 kind 字符串、按钮位置枚举、注册 API 形状）。零运行时副作用。
- **`@vdi/core`**：plugin 暴露 `addToolBtn / onInspect / onSelect` 三个顶层函数。函数壳子读 `window.__VDI_HOST__` 并代理到 overlay。
- **`@vdi/overlay`**：内部维护 `callback Set` 与 `button Map`；inspector 状态机在 `toggle(true)` 和 `setSelectedElement()` 处触发派发；按钮渲染逻辑放在 `inspector.ts` 现有的 `positionActionButtons()` 旁边。

**调用契约**：

- `addToolBtn / onInspect / onSelect` 必须在 `vueDevInspector()` 之后调用（IIFE 已被 plugin `transformIndexHtml` 注入）。
- 多次 `addToolBtn({id:'x'}, ...)` 同 id 视为"覆盖"语义，不重复添加。
- 浏览器外（非 `window`）调用抛错；overlay 未加载抛错。

---

## §2 shared 类型定义

新文件 `packages/shared/src/extensibility.ts`：

```ts
// 共享类型 —— core 与 overlay 均依赖
// 本文件无运行时副作用，纯类型 / 常量导出

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
  /** 颜色配置（可选）；缺省与内置按钮同色系。 */
  hoverColor?: string;
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

/** 事件回调签名。返回反注册函数。 */
export type EventCallback<E> = (event: E) => void;
export type Unregister = () => void;
```

在 `packages/shared/src/index.ts` 加 `export * from './extensibility';`。

**为什么新增 `extensibility.ts` 而不复用 componentConfig.ts**：componentConfig 是"物料库"语义，按钮是"inspector 行为"，二者职责不同。

**YAGNI 守则**：`hoverColor/baseColor` 保留为可选字段，overlay UI 当前读取并使用（与内置按钮同基色 + 蓝色悬停），但其他自定义颜色暂不开放枚举选择。

---

## §3 core plugin 顶层导出

修改 `packages/core/src/index.ts`，新增三个顶层函数。`vueDevInspector(options)` 仍返回 `Plugin`，不返回任何扩展 API。

```ts
import type { Plugin } from 'vite';
import type { DevInspectorOptions } from './options';
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

export function vueDevInspector(options: DevInspectorOptions = {}): Plugin {
  // 现有 plugin 构造逻辑（保持不变）
  return {
    name: 'vue-dev-inspector',
    /* ... 略 ... */
  };
}
```

**关键设计点**：

1. **延迟解析 host**：用户代码调用 `addToolBtn` 时 IIFE 已 init（因为 plugin 的 `transformIndexHtml` 注入脚本时同步调用 `init()`），无竞态。
2. **`vueDevInspector()` 签名不变**：Vite 仍然只识别 Plugin；扩展 API 是顶层函数，调用者 `import { addToolBtn } from '@vdi/core'`。
3. **失败语义**：
   - 浏览器外调用 → 抛 `[vdi] addToolBtn / onInspect / onSelect 仅在浏览器端可用`
   - overlay 未加载 → 抛 `[vdi] overlay IIFE 未加载或 init 失败`

`@vdi/core` 不需要 setHost/getHost 模块变量，因为 host 是 IIFE 主动挂到 `window.__VDI_HOST__` 的。

---

## §4 overlay 内部注册表

修改 `packages/overlay/src/state.ts`，新增注册表字段：

```ts
// 在现有 state 单对象上新增（保持单一可变 state 设计）
export const state = {
  // ... 现有字段
  inspecting: false as boolean,
  hoveredElement: null as HTMLElement | null,
  selectedElement: null as HTMLElement | null,
  // ... 拖拽字段

  // 新增
  toolButtons: new Map<string, ActionButtonDef>(),  // id → def
  inspectCallbacks: new Set<EventCallback<InspectEvent>>(),
  selectCallbacks: new Set<EventCallback<SelectEvent>>(),
};
```

新增 `packages/overlay/src/extensibility.ts`：

```ts
import { state } from './state';
import type {
  ActionButtonDef,
  EventCallback,
  InspectEvent,
  SelectEvent,
  Unregister,
} from '@vdi/shared';
import { renderToolButtons, clearToolButtons } from './inspector';
import { parsePosition } from './utils';

/** 注册一组自定义工具按钮；同 id 覆盖。返回反注册函数。 */
export function registerBtn(btns: ActionButtonDef[]): Unregister {
  for (const btn of btns) {
    state.toolButtons.set(btn.id, btn);
  }
  if (state.selectedElement) {
    renderToolButtons(state.selectedElement);
  }
  return () => {
    for (const btn of btns) {
      state.toolButtons.delete(btn.id);
    }
    clearToolButtons();
  };
}

/** 注册进入审查模式回调。 */
export function onInspect(cb: EventCallback<InspectEvent>): Unregister {
  state.inspectCallbacks.add(cb);
  return () => state.inspectCallbacks.delete(cb);
}

/** 注册选中 / 取消选中回调。 */
export function onSelect(cb: EventCallback<SelectEvent>): Unregister {
  state.selectCallbacks.add(cb);
  return () => state.selectCallbacks.delete(cb);
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
  const source = target
    ? parsePosition(target.getAttribute(state.attrName) ?? '')
    : null;
  const event: SelectEvent = {
    kind: 'select',
    at: Date.now(),
    target,
    source: source
      ? {
          rootIndex: source.rootIndex,
          file: source.file,
          line: Number(source.line),
          col: Number(source.col),
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

**关键设计点**：

1. **`Map` 而非数组**：`toolButtons` 用 id 作为 key，重复 `addToolBtn({id:'x'})` 自动覆盖。
2. **`Set` 回调**：避免重复添加；多次注册同一函数会产生多次回调（用户语义可控）。
3. **派发点位置**：
   - `emitInspect()` 在 `inspector.ts:toggle(true)` 末尾调用
   - `emitSelect(target)` 在 `state.ts:setSelectedElement()` 末尾调用
4. **错误隔离**：每个回调独立 try/catch。

修改 `state.ts` 中 `setSelectedElement`：

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

修改 `inspector.ts:toggle(enabled)`：

```ts
function toggle(enabled: boolean): void {
  state.inspecting = enabled;
  // ... 现有 UI 更新逻辑
  if (enabled) {
    emitInspect();
  } else if (state.selectedElement) {
    setSelectedElement(null);
  }
}
```

`installHost()` 在 `packages/overlay/src/index.ts` 的 `init()` 末尾调用一次。

---

## §5 渲染与状态机

修改 `packages/overlay/src/inspector.ts`，新增三个函数 + 一个模块级容器引用：

```ts
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
      const source = parsePosition(selectedEl.getAttribute(state.attrName) ?? '');
      const event: SelectEvent = {
        kind: 'select',
        at: Date.now(),
        target: selectedEl,
        source: source
          ? {
              rootIndex: source.rootIndex,
              file: source.file,
              line: Number(source.line),
              col: Number(source.col),
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

修改 `packages/overlay/src/overlay.css`：

```css
.__vdi-tool-buttons {
  /* 容器静态样式；动态 left/top 走 JS 内联 */
}

.__vdi-tool-btn {
  /* 按钮基础样式已被 JS 内联覆盖；此处仅放过渡等静态属性 */
  transition: background 120ms ease, color 120ms ease;
}

.__vdi-tool-btn:focus {
  outline: 2px solid #3b82f6;
  outline-offset: 1px;
}
```

**状态机集成**：

| 触发事件 | 派发 inspect | 派发 select | 渲染工具按钮 |
|---|---|---|---|
| `toggle(false → true)` | ✅ | — | — |
| `toggle(true → false)` 且有选中 | — | ✅(target=null) | 清空 |
| `setSelectedElement(el)` | — | ✅(target=el) | 渲染 |
| `setSelectedElement(null)` | — | ✅(target=null) | 清空 |
| `setHoveredElement` | — | — | — |
| `registerBtn(...)`（已选中） | — | — | 重渲染 |
| `unregisterBtn(...)` | — | — | 清空 |

---

## §6 测试策略

### 6.1 类型层（全包必须通过）
- `pnpm -C packages/shared exec tsc --noEmit`
- `pnpm -C packages/core exec tsc --noEmit`
- `pnpm -C packages/overlay exec tsc --noEmit`
- `pnpm -C packages/client exec tsc --noEmit`
- `pnpm -C packages/antdv exec tsc --noEmit`

### 6.2 overlay 单元测试（新增）

新增 devDep：`packages/overlay/package.json` 添加 `"vitest": "^2"` 到 `devDependencies`。

新增 `packages/overlay/vitest.config.ts`：

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.ts'],
  },
});
```

新增 `packages/overlay/test/extensibility.test.ts`：

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

新增 `packages/overlay/package.json` 的 script：

```json
{
  "scripts": {
    "test": "vitest run"
  }
}
```

### 6.3 端到端验证（手动，由用户执行）

修改 `packages/demo/src/App.vue`，在 `<script setup>` 顶部加：

```ts
import { addToolBtn, onInspect, onSelect } from '@vdi/core';

addToolBtn(
  { id: 'wrap', icon: '📦', label: '包一层div', position: 'right', onClick: (e) => console.log('[demo] wrap', e.source) },
  { id: 'goto-api', icon: '🔗', label: '跳转API', position: 'right', onClick: (e) => console.log('[demo] goto', e.source) },
);

onSelect((e) => console.log('[demo] select', e.target?.tagName, e.source));
onInspect(() => console.log('[demo] enter inspect'));
```

浏览器验证步骤：

1. `pnpm dev:demo`
2. 打开 demo → console 应输出 `[demo] enter inspect`（按快捷键进入审查模式后）
3. 选中元素 → 选中框右侧出现 📦、🔗 两个按钮；console 输出 `[demo] select DIV {…}`
4. 点击 📦 → console 输出 `[demo] wrap {rootIndex: 0, file: '…', line: N, col: M}`
5. Esc 退出 → 按钮消失
6. 再进入 → 📦🔗 仍然在（注册全局保持）

---

## §7 范围与 YAGNI

### 7.1 本设计**做**的事
1. 新增 `packages/shared/src/extensibility.ts` 类型定义 + index re-export
2. 新增 `packages/overlay/src/extensibility.ts` 运行时实现
3. 修改 `packages/overlay/src/state.ts` 加 3 个注册表字段 + `setSelectedElement` 派发
4. 修改 `packages/overlay/src/inspector.ts` 加 `renderToolButtons` / `clearToolButtons` / `positionToolButtons` + `toggle` 派发
5. 修改 `packages/overlay/src/index.ts` 的 `init()` 末尾调用 `installHost()`
6. 修改 `packages/overlay/src/overlay.css` 加 `__vdi-tool-buttons` / `__vdi-tool-btn` 样式
7. 修改 `packages/core/src/index.ts` 暴露 `addToolBtn / onInspect / onSelect` 顶层函数
8. 新增 `packages/overlay/test/extensibility.test.ts` + `packages/overlay/vitest.config.ts` + `vitest` devDep + test script
9. 修改 `packages/demo/src/App.vue` 加 demo 调用
10. 端到端验证（用户跑 `pnpm dev:demo`）

### 7.2 本设计**不做**的事（明确 YAGNI）
- ❌ 不暴露 `window.__VDI_HOST__` 类型给用户文档（仅 core 内部使用）
- ❌ 不支持按钮 `position` 字段除 `'right'` 外的值（保留类型定义但只实现 `right`）
- ❌ 不为 `onInspect` 加"退场"事件（用户明确：只派发进入审查，不派发退出）
- ❌ 不实现 hover 状态回调
- ❌ 不实现按钮分组 / 子菜单
- ❌ 不实现右键菜单扩展（contextmenu 仍是硬编码 5 项）
- ❌ 不为 panel（属性编辑弹窗）加扩展钩子
- ❌ 不把 `__VDI_HOST__` 设计成可热替换（不支持运行时卸载 overlay）
- ❌ 不改 `componentConfig.ts` 的 `ComponentConfigEntry` 类型
- ❌ 不使用旧名 `vdiActionBtn`（统一为 `ActionButtonDef` 类型 + `addToolBtn` 注册函数）
- ❌ 不为 client / antdv 加扩展 API
- ❌ 不写 snapshot / e2e / Cypress 测试

### 7.3 兼容性约束
- 现有硬编码 4 个按钮（删除/复制/前后插入）行为不变
- 现有右键菜单 5 项行为不变
- 现有 `componentConfig` 物料抽屉行为不变
- `vueDevInspector(options)` 签名不变；不返回 `InspectorAPI`
- 新 API 全部是"可选"扩展，零注册时 overlay 行为与之前完全一致

### 7.4 已知边界
- **SSR**：用户在非浏览器环境调用 `addToolBtn` 抛 `[vdi] addToolBtn / onInspect / onSelect 仅在浏览器端可用`。
- **多次 `vueDevInspector()`**：每个调用返回独立 Plugin 对象。`__VDI_HOST__` 是单例，多次调用共享同一 host（YAGNI 不做隔离）。
- **HMR 重载**：dev server HMR 时 IIFE 重新执行，`__VDI_HOST__` 重新挂载，但用户的注册会丢失（IIFE 模式固有约束，不解决）。
- **多次 addToolBtn 同 id 覆盖**：保留最近一次的 `onClick` 与样式配置。