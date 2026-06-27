# CLAUDE.md

本文件为 Claude Code 在该仓库中工作时提供指引。

## 项目简介

`vue-dev-inspector` — 一个 Vite 插件 + 配套开发期工具链：

- **编译阶段**：通过 AST 遍历为每个 Vue 模板元素注入 `data-source-file="路径:行:列"` 属性。
- **运行阶段**：浏览器端注入 IIFE 悬浮层 UI，支持悬停、点击、右键菜单、属性编辑、组件插入/删除/复制、跳转编辑器。
- **服务端阶段**：Vite dev middleware 暴露 REST API，对 `.vue` 文件做 AST 级别原子修改，写入后由 HMR 热更新。

全程基于 AST（`@vue/compiler-sfc` + `@vue/compiler-core`）处理，不使用正则。**零生产影响** — 仅在 `vite serve` 模式下激活。

## 仓库结构

pnpm monorepo（`pnpm-workspace.yaml` 声明 `packages/*`），共 **4 个包**，均为 `private`：

| 包 | 角色 | 构建方式 | 入口 |
|---|---|---|---|
| `@vue-dev-inspector/overlay` | 浏览器端悬浮层 IIFE | Vite lib + `vite-plugin-singlefile`，输出 `dist/overlay.iife.js` | `index.ts` |
| `@vue-dev-inspector/client` | dev middleware + AST 编辑器（编辑器运行在 Node 端） | tsup 输出 `dist/index.js`（ESM, Node platform） | `src/index.ts` |
| `@vue-dev-inspector/core` | Vite 插件本体（plugin + transform） | tsup 输出 `dist/index.js`（ESM, Node platform） | `src/index.ts` |
| `@vue-dev-inspector/demo` | 用真 Vue 3 应用验证插件行为 | Vite dev server | `vite.config.ts` |

依赖通过 `workspace:*` 串联：`core` → `client` + `overlay`；`demo` → `core`。

## 常用命令

### 根目录

- `pnpm dev` — 启动**落地页**开发服务器（根目录 `src/`，Tailwind v4）。**与插件 demo 无关**。
- `pnpm build` — 构建落地页（`dist/index.html`）。
- `pnpm build:overlay` — 仅重建 `packages/overlay/dist/overlay.iife.js`。
- `pnpm dev:demo` — **完整 demo 启动流程**，按顺序执行：
  1. `pnpm -C packages/overlay build`
  2. `pnpm -C packages/client build`
  3. `pnpm -C packages/core build`
  4. `pnpm -C packages/demo dev`
  开发 inspector 期间请用此命令，**不要用 `pnpm dev`**。
- `pnpm lint` / `pnpm lint:fix` — ESLint（`eslint.config.ts`）。
- `pnpm prettier` — Prettier 格式化。
- `pnpm prepare` — husky 安装（git hook：lint-staged 仅对 staged 文件跑 `eslint --fix`）。

### 单包命令

- `pnpm -C packages/overlay build` — Vite lib → `dist/overlay.iife.js`。**修改 overlay 源码或 CSS 后必须重跑**。
- `pnpm -C packages/client build` — tsup 打包中间件 + editor。
- `pnpm -C packages/core build` — tsup 打包 Vite 插件。
- `pnpm -C packages/demo dev` — 启动 demo。

类型检查：根 `tsconfig.json` 仅覆盖根 `src/`。**每个包单独执行** `npx tsc -p packages/<name>/tsconfig.json`。

## 两个容易混淆的构建目标

1. **根目录 `src/` + `vite.config.ts`** — 营销/文档落地页（Tailwind、`vite-plugin-singlefile`），与插件运行时完全无关。
2. **`packages/demo`** — 真 Vue 3 应用，通过 `pnpm dev:demo` 运行，是验证插件端到端行为的唯一受支持方式。

## 架构说明

### 编译阶段：源码定位（`packages/core`）

`core/src/plugin.ts` 注册一个 `enforce: 'pre'` 的 Vite 插件（在 `@vitejs/plugin-vue` 之前执行）。**仅在 dev 模式生效**（`config.command === 'serve'`）。

- `transform(code, id)` — 解析 `.vue` SFC，通过 `compileTemplate()` 配合自定义 `nodeTransforms: [createInspectorTransform(...)]`（`core/src/transform.ts`）遍历 AST 元素节点（跳过 `template/slot/component/transition/transition-group/keep-alive/teleport/suspense`），用 **MagicString** 把 `${attrName}="相对路径:行:列"` 注入到开始标签。`node.loc.start` 提供行列（**行 1-based，列 0-based**）。
- `transformIndexHtml(html)` — 在 `</body>` 前注入：
  - `<script>window.__DEV_INSPECTOR_CFG__=…</script>` 运行时配置
  - `<script type="module">…overlay.iife.js…</script>` 预构建脚本
- `configureServer(server)` — 挂载 client 中间件。
- `loadOverlayScript()` 在**模块加载时**一次性 `fs.readFileSync` 读取 `packages/overlay/dist/overlay.iife.js`。文件缺失则抛错并提示先构建。

### 编译阶段：`wrapComponents`（重要边界情况）

对设置了 `inheritAttrs: false`、有多个根节点或使用了 `<teleport>` 的第三方组件，`fallthrough` 属性无法透传到 DOM 节点。配置 `wrapComponents`（如 `['a-date-picker', 'a-input-password']`）后，transform 改为在组件标签外包裹 `<span ${attrName}="…" data-inspector-wrap style="display:contents">…</span>`，标记挂在这个 span 上。具体逻辑见 `core/src/transform.ts` `createInspectorTransform`。

### 运行时：浏览器端悬浮层 UI（`packages/overlay`）

编译为单个 IIFE（运行时无模块系统）。状态集中在 `state.ts` 的**单一可变 `state` 对象**——这是有意为之：原始 IIFE 用闭包变量，模块化后 `let` 导出不是 live binding，所以改用共享对象。**请勿"优化"成独立 `let` 导出**。

模块：
- `index.ts` — 入口；用 `?inline` 把 `overlay.css` 作为字符串打进 IIFE 并手动注入 `<style>`（**关键**：Vite lib 模式下 CSS 不会自动内联，`vite-plugin-singlefile` 也只对 HTML chunk 生效），然后调用 `init()`。
- `events.ts` — 全局监听器（mousemove / click / contextmenu / keydown / scroll / resize）+ 齿轮按钮 + 默认快捷键 `Alt+Shift+I`。
- `inspector.ts` — `createUI()` 构建固定定位悬浮层（hover 框、选中框、标签提示、菜单、复制/删除/插入按钮）+ hover/select 状态机。
- `menu.ts`（右键菜单）、`panel.ts`（属性编辑弹窗）、`drawer.ts`（组件选择器侧滑）。
- `utils.ts` — `createElement<T>`（泛型，默认 `HTMLDivElement`，避免 `as any`）、`findInspectableElement`、`positionOverlay`、`getLayoutBox`（处理 `display:contents` 的 span 包装层）。
- `state.ts` — 共享可变状态 + `clientConfig`（从 `window.__DEV_INSPECTOR_CFG__` 读取）。
- `types/` — `ClientCfg` / `PanelData` / `PropEntry` 等类型声明。

约定：
- 所有 CSS class 以 `__vdi-` 为前缀，避免与宿主页面冲突。
- 动态布局属性（`left/top/display`）通过 JS 内联设置；静态样式写在 `overlay.css` 中。
- 样式注入用 `id="__vdi-overlay-style__"`，幂等。

### 运行时：服务端 AST 编辑（`packages/client`）

`server.ts` 是 Vite dev middleware，挂在 `/__dev-inspector-api__`（常量 `API_PREFIX` 见 `core/src/options.ts`）下。

**REST 路由**（仅 POST；`OPTIONS` 走 CORS preflight → 204）：

| 路径 | 功能 |
|---|---|
| `/get-props` | 读指定 `(file, line, col)` 元素的属性（AST 提取） |
| `/update-props` | 用 `PropEntry[]` 覆盖元素属性（原子修改 `magic-string`） |
| `/delete-element` | 删除元素完整源码区间 |
| `/insert-component` | 在元素前/后/内（`before`/`after`/`inside`）插入 antdv 组件 |
| `/duplicate-element` | 同级复制元素 |
| `/list-components` | 扫描 `projectRoot` 下所有 `.vue`（排除 `node_modules|dist|.vite`） |
| `/open-in-editor` | 用 `code`/`webstorm`/`atom`/`subl` 或 URL protocol 打开文件 |

所有处理器经 `safePath()` 校验（在 `projectRoot` 下解析，拒绝路径穿越）。`editor.ts` 负责 AST 操作（`baseParse` + MagicString 原子替换）。写入文件后由 Vite HMR 热更新。

**已知 invariant**（`editor.ts`）：
- `editElementProps` 在 `[tagNameEnd, openTagEnd)` 上做修改。
- 当 `openTagEnd === tagNameEnd`（如自闭合标签无任何现有属性）时，**必须用 `prependRight` 而非 `overwrite`**——MagicString 不允许 `overwrite` 零长度区间，会抛 `Cannot overwrite a zero-length range`。
- 当 `attrs` 为空但区间非空时，用 `remove`；当两者都为空时直接返回原源码。

### 配置流转

`DevInspectorOptions`（`core/src/options.ts`）
  → `vueDevInspector()` 与 `DEFAULT_OPTIONS` 合并
  → 序列化为 `window.__DEV_INSPECTOR_CFG__`
  → overlay 的 `state.ts` 中 `clientConfig` 读取
  → overlay 通过 `apiPrefix + path` 调服务端
  → 打开编辑器无 CLI 匹配时回退到 `EDITOR_PROTOCOLS` 的 URL protocol

### 包依赖图

```
demo  →  core  →  { client, overlay }
                ↑
                └── core 自身 → { overlay (workspace:*), client (workspace:*), @vue/compiler-sfc }
client → ../../core/src/options  (dev 时直接引源码，跨包相对路径)
```

注意：`client/src/server.ts` 通过相对路径 `../../core/src/options` 引 `API_PREFIX` / `EDITOR_PROTOCOLS`，不是 `core` 的 package 入口——这是**有意的源码级耦合**，在 client 被打成 dist 后这条 import 实际指向 `packages/client/dist/core/src/options`（不存在），因此发布/打包时需重新审视。

## 约定

- 包管理器：**pnpm**（workspace `packages/*`），锁文件 `pnpm-lock.yaml`。
- 全项目 **ESM-only**（所有包 `"type": "module"`）。
- 注释和标识符双语风格：**中文注释，英文标识符**。请保持与周围代码一致。
- overlay 类名始终 `__vdi-` 前缀；动态布局属性 JS 内联，静态样式写 `overlay.css`。
- 修改 `packages/overlay/src/*` 后必须**重建 overlay 并重启 demo**——插件启动时一次性从磁盘读取 `dist/overlay.iife.js`，旧产物会一直驻留。
- 修改 `core/src/*` 或 `client/src/*` 后必须分别重建对应包，再重启 demo。
- 提交前 husky 会通过 lint-staged 自动跑 `eslint --fix`。
