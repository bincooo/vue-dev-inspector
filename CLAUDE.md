# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`vue-dev-inspector` — a Vite plugin that instruments every Vue template element at compile time with a `data-source-file="path:line:col"` attribute, plus a browser "overlay" UI that lets you hover/click/right-click DOM elements to inspect their source location, edit attributes, insert/delete/duplicate components, and jump to the editor. All via AST traversal (no regex). Zero production impact — only active in `vite serve`.

pnpm monorepo, 6 packages, all `private` (unpublished; deps wired via `workspace:*` / direct relative imports).

## Commands

Root (`package.json`):
- `pnpm dev` — dev server for the **landing page** (root `src/`, Tailwind v4, single-file build). This is the marketing/docs site, NOT the plugin demo.
- `pnpm build` — builds the landing page (`dist/index.html`).
- `pnpm dev:demo` — **builds the overlay first, then runs the demo** (`pnpm -C packages/overlay build && pnpm -C packages/demo dev`). This is the canonical way to see the plugin working. Run this (not `pnpm dev`) when developing the inspector.
- `pnpm build:overlay` — rebuild only `packages/overlay/dist/overlay.iife.js`.

Per-package:
- `pnpm -C packages/overlay build` — Vite lib build → `dist/overlay.iife.js` (IIFE). **Must be re-run after any overlay source/CSS change**, because the plugin reads the built file off disk at startup.
- `pnpm -C packages/demo dev` — demo app (raw `vite`, no scripts to run).
- Other packages (`client`, `vite-plugin-vue-dev-inspector`, `ast-walker`, `shared`) are **source-only** — no build step, consumed directly via relative imports.

There are **no tests, no linter, no formatter, no CI** configured. Don't claim to "run tests" — there are none.

Type-checking: `npx tsc -p <tsconfig>` per package. The overlay's own `tsconfig.json` omits `vite/client` types, so `import './overlay.css?inline'` may show a TS error under `tsc` even though Vite builds it fine.

## Architecture

### The two build targets are easy to confuse
1. **Root `src/` + `vite.config.ts`** — the project landing page (Tailwind, `vite-plugin-singlefile`). Has nothing to do with the plugin runtime.
2. **`packages/demo`** — a real Vue 3 app that consumes the plugin. This is where you verify inspector behavior end-to-end (`pnpm dev:demo`).

### Compile-time: source attribution (plugin)
`packages/vite-plugin-vue-dev-inspector/src/plugin.ts` registers a Vite plugin with `enforce: 'pre'` (runs **before** `@vitejs/plugin-vue`). In dev only:
- `transform()` — parses each `.vue` SFC with `@vue/compiler-sfc`, then `compileTemplate()` with a custom `nodeTransforms: [createInspectorTransform(...)]` (`transform.ts`). The transform walks AST element nodes (skipping Vue builtins) and uses **MagicString** to splice `${attrName}="relPath:line:col"` into the start tag. `node.loc` (1-based line, 0-based col) gives exact positions.
- `transformIndexHtml()` — injects `<script>window.__DEV_INSPECTOR_CFG__=...</script>` (the runtime config) + the pre-built `overlay.iife.js` body before `</body>`.
- `configureServer()` — mounts the client dev-server middleware.
- The overlay script is read once at **module load** via `loadOverlayScript()` (`fs.readFileSync` of `packages/overlay/dist/overlay.iife.js`). If the file is missing it throws and tells you to build. Hence: **edit overlay → rebuild overlay → restart demo.**

### Compile-time: `wrapComponents` (important edge case)
Third-party components with `inheritAttrs:false`, multiple roots, or `<teleport>` lose fallthrough attrs — so injected `data-source-file` never reaches a DOM node. `wrapComponents: ['a-date-picker', ...]` makes the transform instead wrap the component tag in `<span ... data-inspector-wrap style="display:contents">…</span>` and hang the marker on the span. Handled in `transform.ts`.

### Runtime: overlay browser UI (`packages/overlay`)
Compiles to a single IIFE (no module system at runtime). State is shared via a single mutable `state` object in `state.ts` — **this is deliberate**: the original code was an IIFE string with closure vars; after modularization `let` exports aren't live bindings, so a shared object is used. Don't "fix" it to per-`let` exports.

Key modules:
- `index.ts` — entry; injects CSS then `init()`.
- `events.ts` — global listeners (mousemove/click/contextmenu/keydown/scroll/resize) + gear button + shortcut (default `Alt+Shift+I`).
- `inspector.ts` — `createUI()` builds the fixed-position overlays (hover box, select box, tag tip, menu, copy/delete/insert buttons); the state machine for hover/select.
- `menu.ts` (right-click), `panel.ts` (props edit modal), `drawer.ts` (component picker slide-in).
- `utils.ts` — `createElement`, `findInspectableElement`, `positionOverlay`, `getLayoutBox` (handles `display:contents` span wrappers).
- All CSS classes are prefixed `__vdi-` to avoid colliding with the host page.

**CSS injection (recently fixed):** overlay builds in **Vite lib/IIFE mode**, where Vite emits CSS as a separate `dist/overlay.css` and `vite-plugin-singlefile` only inlines CSS into HTML chunks (lib has no HTML entry). So `import './overlay.css'` produced a JS file with *no* styles, and the overlay rendered unstyled. Fix in `index.ts`: `import cssText from './overlay.css?inline'` and inject a `<style>` into `<head>` at runtime. If you add new `__vdi-*` rules or restyle, just rebuild; the CSS string is now baked into the IIFE.

### Runtime: server-side AST editing (`packages/client`)
`server.ts` is a Vite dev-server middleware exposing REST routes under `/__dev-inspector-api__` (see `API_PREFIX` in `options.ts`):
`/get-props`, `/update-props`, `/delete-element`, `/insert-component` (direction `before`/`after`/`inside`), `/duplicate-element`, `/list-components` (walks `.vue` files), `/open-in-editor` (shells out to `code`/`webstorm`/etc.).

All handlers go through `safePath()` (resolves under `projectRoot`, rejects path traversal). `editor.ts` does the actual AST work (`baseParse` + MagicString atomic replacement) — e.g. `deleteElement` uses node `loc` ranges to delete precisely, correctly handling same-line nested children; `insertComponent` supports the three directions. After a write, Vite HMR picks up the file change automatically.

### Config flow
User options (`options.ts`, `DevInspectorOptions`) → plugin merges with `DEFAULT_OPTIONS` → serialized to `window.__DEV_INSPECTOR_CFG__` → read by overlay `state.ts` (`clientConfig`). The overlay talks to the server via `apiPrefix + path`. Editor open falls back to URL protocol (`EDITOR_PROTOCOLS`) when no CLI handler matches.

### Package dependency graph
`vite-plugin-vue-dev-inspector` → `{overlay(workspace:*), client(workspace:*)}`. Plugin imports `client` via relative path (`../../client/src/index`); `client/server.ts` imports `API_PREFIX`/`EDITOR_PROTOCOLS` back from `../../vite-plugin-vue-dev-inspector/src/options` (note this cross-package relative coupling). `ast-walker` and `shared` exist as standalone packages but the plugin's `transform.ts` re-implements its own inline walker rather than importing `ast-walker` — be aware before assuming the walker package is the canonical traversal used at compile time.

## Conventions
- Package manager is **pnpm** (workspace `packages/*`). Lockfile: `pnpm-lock.yaml`.
- ESM-only (`"type": "module"` everywhere).
- Comments and identifiers are bilingual (Chinese comments, English identifiers). Match the surrounding style.
- Overlay classes: always `__vdi-` prefix; dynamic layout props (`left/top/display`) stay inline via JS, static styling in `overlay.css`.
- After touching `packages/overlay/src/*`: rebuild (`pnpm -C packages/overlay build`) and restart the demo — the plugin serves the stale built file otherwise.