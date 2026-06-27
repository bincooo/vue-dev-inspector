# CLAUDE.md

本文件为 Claude Code 在该仓库中工作时提供指引。

## 项目简介

`vue-dev-inspector` — 一个 Vite 插件，在编译阶段通过 AST 遍历为每个 Vue 模板元素注入 `data-source-file="路径:行:列"` 属性，并在浏览器端提供一套"悬浮层" UI，支持悬停、点击、右键菜单等操作，可查看元素源码位置、编辑属性、插入/删除/复制组件，以及跳转到编辑器。全程基于 AST 处理，不使用正则。**零生产影响** — 仅在 `vite serve` 模式下激活。

pnpm monorepo，共 6 个包，均为 `private`（不发布）；依赖通过 `workspace:*` / 直接相对路径引入。

## 常用命令

根目录（`package.json`）：
- `pnpm dev` — 启动**落地页**开发服务器（根目录 `src/`，Tailwind v4，单文件构建）。这是营销/文档站点，**与插件 demo 无关**。
- `pnpm build` — 构建落地页（输出 `dist/index.html`）。
- `pnpm dev:demo` — **先构建 overlay，再运行 demo**（`pnpm -C packages/overlay build && pnpm -C packages/demo dev`）。这是验证插件效果的标准方式，开发 inspector 时请运行此命令而非 `pnpm dev`。
- `pnpm build:overlay` — 仅重新构建 `packages/overlay/dist/overlay.iife.js`。

各包独立命令：
- `pnpm -C packages/overlay build` — Vite lib 构建 → `dist/overlay.iife.js`（IIFE 格式）。**修改 overlay 源码或 CSS 后必须重新运行**，因为插件在启动时从磁盘读取该构建产物。
- `pnpm -C packages/demo dev` — 启动 demo 应用（原始 `vite`，无额外脚本）。
- 其他包（`client`、`vite-plugin-vue-dev-inspector`、`ast-walker`、`shared`）**仅含源码，无构建步骤**，通过相对路径直接引入。

> 本项目**无测试、无 Lint、无格式化、无 CI**。请勿声称"运行测试"——根本没有测试。

类型检查：每个包单独执行 `npx tsc -p <tsconfig>`。

## 架构说明

### 两个构建目标容易混淆

1. **根目录 `src/` + `vite.config.ts`** — 项目落地页（Tailwind、`vite-plugin-singlefile`），与插件运行时无关。
2. **`packages/demo`** — 一个真实的 Vue 3 应用，用于消费并验证插件的端到端行为（通过 `pnpm dev:demo` 运行）。

### 编译阶段：源码定位（插件）

`packages/vite-plugin-vue-dev-inspector/src/plugin.ts` 注册了一个 `enforce: 'pre'` 的 Vite 插件（在 `@vitejs/plugin-vue` 之前执行）。仅在开发模式下：

- `transform()` — 用 `@vue/compiler-sfc` 解析每个 `.vue` SFC，再通过 `compileTemplate()` 配合自定义 `nodeTransforms: [createInspectorTransform(...)]`（见 `transform.ts`）进行处理。该 transform 遍历 AST 元素节点（跳过 Vue 内置标签），使用 **MagicString** 将 `${attrName}="相对路径:行:列"` 拼接到开始标签中。`node.loc` 提供精确的行列信息（行从 1 开始，列从 0 开始）。
- `transformIndexHtml()` — 在 `</body>` 前注入 `<script>window.__DEV_INSPECTOR_CFG__=...</script>`（运行时配置）以及预构建的 `overlay.iife.js` 内容。
- `configureServer()` — 挂载客户端开发服务器中间件。
- overlay 脚本在**模块加载时**通过 `loadOverlayScript()`（`fs.readFileSync` 读取 `packages/overlay/dist/overlay.iife.js`）一次性载入。文件缺失时会抛出错误并提示先执行构建。因此：**修改 overlay → 重新构建 overlay → 重启 demo**。

### 编译阶段：`wrapComponents`（重要边界情况）

对于设置了 `inheritAttrs: false`、有多个根节点或使用了 `<teleport>` 的第三方组件，`fallthrough` 属性无法透传，导致注入的 `data-source-file` 无法到达 DOM 节点。配置 `wrapComponents: ['a-date-picker', ...]` 后，transform 会改为在组件标签外包裹一层 `<span ... data-inspector-wrap style="display:contents">…</span>`，并将标记挂在该 span 上。具体逻辑见 `transform.ts`。

### 运行时：浏览器端悬浮层 UI（`packages/overlay`）

编译为单个 IIFE（运行时无模块系统）。状态通过 `state.ts` 中的单一可变 `state` 对象共享 — **此为刻意设计**：原始代码是带闭包变量的 IIFE 字符串，模块化后 `let` 导出不是实时绑定，因此采用共享对象的方式。请勿将其"优化"为各自独立的 `let` 导出。

核心模块：
- `index.ts` — 入口；注入 CSS，然后调用 `init()`。
- `events.ts` — 全局监听器（mousemove / click / contextmenu / keydown / scroll / resize）+ 齿轮按钮 + 快捷键（默认 `Alt+Shift+I`）。
- `inspector.ts` — `createUI()` 构建固定定位的悬浮层（hover 框、选中框、标签提示、菜单、复制/删除/插入按钮）；以及 hover/select 状态机。
- `menu.ts`（右键菜单）、`panel.ts`（属性编辑弹窗）、`drawer.ts`（组件选择器侧滑）。
- `utils.ts` — `createElement`、`findInspectableElement`、`positionOverlay`、`getLayoutBox`（处理 `display:contents` 的 span 包装层）。
- 所有 CSS class 均以 `__vdi-` 为前缀，避免与宿主页面冲突。动态布局属性（`left/top/display`）通过 JS 内联设置，静态样式写在 `overlay.css` 中。

### 运行时：服务端 AST 编辑（`packages/client`）

`server.ts` 是一个 Vite 开发服务器中间件，在 `/__dev-inspector-api__`（见 `options.ts` 中的 `API_PREFIX`）下暴露以下 REST 路由：

`/get-props`、`/update-props`、`/delete-element`、`/insert-component`（方向：`before`/`after`/`inside`）、`/duplicate-element`、`/list-components`（遍历 `.vue` 文件）、`/open-in-editor`（调用 `code`/`webstorm` 等编辑器）。

所有处理器均通过 `safePath()`（在 `projectRoot` 下解析，拒绝路径穿越）。`editor.ts` 负责实际的 AST 操作（`baseParse` + MagicString 原子替换）。写入文件后，Vite HMR 会自动检测变更并热更新。

### 配置流转

用户配置（`options.ts`，`DevInspectorOptions`）→ 插件与 `DEFAULT_OPTIONS` 合并 → 序列化为 `window.__DEV_INSPECTOR_CFG__` → overlay 的 `state.ts`（`clientConfig`）读取。overlay 通过 `apiPrefix + path` 与服务端通信。打开编辑器时，若无匹配的 CLI 处理器则回退到 URL 协议（`EDITOR_PROTOCOLS`）。

### 包依赖关系

`vite-plugin-vue-dev-inspector` → `{overlay(workspace:*), client(workspace:*)}`。插件通过相对路径引入 `client`（`../../client/src/index`）；`client/server.ts` 反过来从 `../../vite-plugin-vue-dev-inspector/src/options` 引入 `API_PREFIX`/`EDITOR_PROTOCOLS`（注意这种跨包的相对路径耦合）。`ast-walker` 和 `shared` 作为独立包存在，但插件的 `transform.ts` 内联实现了自己的遍历逻辑，并未引入 `ast-walker`——在假设 walker 包是编译阶段的核心遍历实现前，请注意这一点。

## 约定

- 包管理器为 **pnpm**（workspace `packages/*`），锁文件为 `pnpm-lock.yaml`。
- 全项目 ESM-only（所有包均设置 `"type": "module"`）。
- 注释和标识符为双语风格（中文注释，英文标识符）。请与周围代码风格保持一致。
- overlay 类名始终使用 `__vdi-` 前缀；动态布局属性（`left/top/display`）通过 JS 内联设置，静态样式写在 `overlay.css` 中。
- 修改 `packages/overlay/src/*` 后，必须重新构建（`pnpm -C packages/overlay build`）并重启 demo — 否则插件会继续使用旧的构建产物。