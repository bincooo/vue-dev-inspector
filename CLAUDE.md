# CLAUDE.md

本文件为 Claude Code 在该仓库中工作时提供指引。

## 项目简介

`vue-dev-inspector` - 一个 Vite 插件 + 配套开发期工具链：

- **编译阶段**：通过 AST 遍历为每个 Vue 模板元素注入 `data-source-file="路径:行:列"` 属性。
- **运行阶段**：浏览器端注入 IIFE 悬浮层 UI，支持悬停、点击、右键菜单、属性编辑、组件插入/删除/复制、跳转编辑器。
- **服务端阶段**：Vite dev middleware 暴露 REST API，对 `.vue` 文件做 AST 级别原子修改，写入后由 HMR 热更新。

全程基于 AST（`@vue/compiler-sfc` + `@vue/compiler-core`）处理，不使用正则。**零生产影响** - 仅在 `vite serve` 模式下激活。

## 仓库结构

pnpm monorepo（`pnpm-workspace.yaml` 声明 `packages/*` 与 `packages/examples/*`），共 **9 个库包 + 2 个示例**：

| 包 | 角色 | private | 构建方式 | 入口 |
|---|---|---|---|---|
| `@vue-dev-inspector/shared` | 共享常量 + 类型（`API_PREFIX`/`EDITOR_PROTOCOLS`/`SOURCE_REF_RE`/`ComponentConfigEntry`/`ChildTextData`）。浏览器运行时在 `./browser` 子路径 | false | tsup 多入口 `src/index.ts` + `src/browser.ts` | `index.ts` |
| `@vue-dev-inspector/shared/browser` | host-bridge 浏览器运行时（`installHost`/`addToolBtn`/`onInspect`/`onSelect` + window 16ms 轮询队列）。仅 overlay / 物料 expand 消费 | - | 同上（`browser.ts`） | `browser.ts` |
| `@vue-dev-inspector/utils` | node 工具：`paths`（`toPosixRelative`/`resolveProjectRootIndex`/`loadScript`）+ `cdn`（`CdnBuilder`/`buildCdnUrl`） | false | tsup `dist/index.js` | `index.ts` |
| `@vue-dev-inspector/pluginkit` | core 与 uni **共享的插件公共逻辑**（`createInspectorTransform` + template 行号/映射 helper + `buildCfgJson`/`buildExpandScripts`）。**不直接 import `@vue/compiler-sfc`**，`parse` 由调用方注入（`SfcParser`） | true | tsup，`--external @vue/compiler-core/sfc` | `index.ts` |
| `@vue-dev-inspector/client` | dev middleware + AST 编辑器（Node 端） | true | tsup `dist/index.js` | `src/index.ts` |
| `@vue-dev-inspector/overlay` | 浏览器端悬浮层 IIFE | true | Vite lib + `vite-plugin-singlefile`，`dist/overlay.iife.js` | `index.ts` |
| `@vue-dev-inspector/core` | PC Vite 插件本体 | false | tsup，bundle 所有 `@vue-dev-inspector/*`（self-contained） | `src/index.ts` |
| `@vue-dev-inspector/uni` | uni-app Vite 插件（平台 no-op / phone-shell） | false | tsup，bundle 所有 `@vue-dev-inspector/*`（self-contained） | `src/index.ts` |
| `@vue-dev-inspector/antdv` | antdv 组件目录扩展 + 浏览器 expand 脚本 | false | tsup(plugin) + vite(expand IIFE) | `index.ts` |
| `@vue-dev-inspector/uview` | uView 组件目录扩展 | false | tsup | `index.ts` |
| `@vue-dev-inspector/demo`（`packages/examples/pc`） | 真 Vue 3 应用，验证 PC 插件 | - | Vite dev server | `vite.config.ts` |
| `@vue-dev-inspector/uni-demo`（`packages/examples/uni`） | uni-app H5，验证 uni 插件 | - | Vite dev server | `vite.config.ts` |

**发布边界**：`private: true` 的包（`pluginkit`/`client`/`overlay`）**永不发 npm**，构建时 **bundle 进** core/uni dist（放在 `devDependencies`，tsup 不外置 devDep）。core/uni/antdv/uview 发布后是 **self-contained**——dist 零 `@vue-dev-inspector/*` 运行时 import，消费者无需安装内部包，只需 `@vue/compiler-*`（声明在 `dependencies`，npm 公开包）。

依赖通过 `workspace:*` 串联：`core`/`uni` -> `pluginkit` + `client` + `shared` + `utils`；`pluginkit` -> `shared` + `utils`；`antdv` -> `shared` + `utils`；`demo` -> `core`；`uni-demo` -> `uni`。

## 常用命令

### 根目录

- `pnpm dev` - 启动**落地页**开发服务器（根目录 `src/`，Tailwind v4）。**与插件 demo 无关**。
- `pnpm build` - 构建落地页（`dist/index.html`）。
- `pnpm dev:pc` - 启动 PC demo（`packages/examples/pc`）。
- `pnpm dev:uni` - 启动 uni demo（`packages/examples/uni`，h5）。
- `pnpm build:core` - 按序构建 `utils -> shared -> overlay -> client -> core`。
- `pnpm build:uni` - 按序构建 `utils -> shared -> overlay -> client -> uni`。
- `pnpm build:antd` / `pnpm build:uview` - 构建物料包。
- `pnpm typecheck` - 对 `packages/*`（不含 examples）并行跑 `tsc --noEmit`。
- `pnpm lint` / `pnpm lint:fix` - ESLint（`eslint.config.ts`）。
- `pnpm prettier` - Prettier 格式化。
- `pnpm prepare` - husky 安装（git hook：lint-staged 仅对 staged 文件跑 `eslint --fix`）。

### 单包命令

- `pnpm -C packages/overlay build` - Vite lib -> `dist/overlay.iife.js`。**修改 overlay 源码或 CSS 后必须重跑**。
- `pnpm -C packages/client build` - tsup 打包中间件 + editor。
- `pnpm -C packages/pluginkit build` - tsup 打包 core/uni 共享逻辑。
- `pnpm -C packages/core build` / `pnpm -C packages/uni build` - tsup 打包 Vite 插件（自包含）。
- `pnpm -C packages/examples/pc dev` / `pnpm -C packages/examples/uni dev:h5` - 启动 demo。

类型检查：所有库包 tsconfig **extends `../../tsconfig.base.json`**（共享 strict 选项：`strict`/`noUnusedLocals`/`noUnusedParameters`/`isolatedModules` 等）；根 `tsconfig.json` 也 extends base（仅覆盖落地页的 `paths`/`types`/`include`）。统一用 `pnpm typecheck`。

## 两个容易混淆的构建目标

1. **根目录 `src/` + `vite.config.ts`** - 营销/文档落地页（Tailwind、`vite-plugin-singlefile`），与插件运行时完全无关。
2. **`packages/examples/{pc,uni}`** - 真 Vue 3 应用，验证插件端到端行为。**不要用 `pnpm dev`**（那是落地页）。

## 架构说明

### 编译阶段：源码定位（`core`/`uni` 共用 `pluginkit`）

`core/src/plugin.ts` / `uni/src/plugin.ts` 注册一个 `enforce: 'pre'` 的 Vite 插件（在 `@vitejs/plugin-vue` 之前执行）。**仅在 dev 模式生效**（`config.command === 'serve'`）。

- `transform(code, id)` - 解析 `.vue` SFC，通过 `compileTemplate()` 配合自定义 `nodeTransforms: [createInspectorTransform(...)]`（来自 `@vue-dev-inspector/pluginkit`，源在 `pluginkit/src/transform.ts`）遍历 AST 元素节点（跳过 `template/slot/component/transition/transition-group/keep-alive/teleport/suspense`），用 **MagicString** 把 `${attrName}="相对路径:行:列"` 注入到开始标签。`node.loc.start` 提供行列（**行 1-based，列 0-based**）。
- **编译环境隔离（core vs uni）**：`createInspectorTransform` 在运行时用 `NodeTypes`/`ElementTypes` 枚举做比较，这些枚举必须与 `compileTemplate` 解析器同源。pluginkit 不 import `@vue/compiler-sfc`；需要 `parse` 的工具（`getDiskTemplateLine`/`getDiskTemplate`）收 `SfcParser` 参数由调用方注入：
  - core：ESM `import { parse } from "@vue/compiler-sfc"`
  - uni：`createRequire(import.meta.url)` 在 `priming.ts` 预热 CJS 缓存后取（绕 `@dcloudio` 的 `@vue/shared@3.4.21` 污染）
  - pluginkit tsup `--external @vue/compiler-core`，运行时枚举从消费者 node_modules 解析（core/uni 经同一 pnpm-store 符号链接命中同一份 `compiler-core@3.5.38`，枚举同源）
- `transformIndexHtml(html)` - 在 `</body>` 前注入配置 + overlay IIFE + expand 脚本（`buildCfgJson`/`buildExpandScripts`/`loadOverlayScript` 均来自 pluginkit）。
- `configureServer(server)` - 挂载 client 中间件。
- `loadOverlayScript()` 懒加载单例读 `overlay.iife.js`（候选 `./overlay.iife.js` 与 `../../overlay/dist/overlay.iife.js`）。

### 编译阶段：`wrapComponents`（重要边界情况）

对设置了 `inheritAttrs: false`、有多个根节点或使用了 `<teleport>` 的第三方组件，`fallthrough` 属性无法透传到 DOM 节点。配置 `wrapComponents`（如 `['a-date-picker', 'a-input-password']`）后，transform 改为在组件标签外包裹 `<span ${attrName}="…" data-inspector-wrap style="display:contents">…</span>`，标记挂在这个 span 上。具体逻辑见 `pluginkit/src/transform.ts` `createInspectorTransform`。

### uni 专有

- `priming.ts` 必须是 `plugin.ts` 第一个 import（CJS 缓存预热，见上）。
- `diskLineMap`（`buildDiskLineMap`，来自 pluginkit）：前置插件如 `@uni-ku/root` 把模板包进 `<global-ku-root>` 会在模板内部注入行，使内存行号 ≠ 磁盘行号；逐行映射修 `data-source-file` 行号（get-props 404 / 跳错行）。core 传 `diskLineMap: null`（无此场景）。
- 平台 no-op：`mp-*`/`app`/`quickapp` 下 transform / overlay / dev server 全跳过。`phoneShell` 注入虚拟 iPhone 外观（仅 h5 + dev）。

### 运行时：浏览器端悬浮层 UI（`packages/overlay`）

编译为单个 IIFE（运行时无模块系统）。状态集中在 `state.ts` 的**单一可变 `state` 对象**——这是有意为之：原始 IIFE 用闭包变量，模块化后 `let` 导出不是 live binding，所以改用共享对象。**请勿"优化"成独立 `let` 导出**。

模块：
- `index.ts` - 入口；用 `?inline` 把 `overlay.css` 作为字符串打进 IIFE 并手动注入 `<style>`（**关键**：Vite lib 模式下 CSS 不会自动内联，`vite-plugin-singlefile` 也只对 HTML chunk 生效），然后调用 `init()`。
- `events.ts` - 全局监听器（mousemove / click / contextmenu / keydown / scroll / resize）+ 齿轮按钮 + 默认快捷键 `Alt+Shift+I`。
- `inspector.ts` - `createUI()` 构建固定定位悬浮层（hover 框、选中框、标签提示、菜单、复制/删除/插入按钮）+ hover/select 状态机。
- `menu.ts`（右键菜单）、`prop-panel.ts`（属性编辑弹窗）、`comp-drawer.ts`（组件选择器侧滑）、`code-drawer.ts`（Monaco 代码编辑侧滑）。
- `utils.ts` - `createElement<T>`、`findInspectableElement`、`positionOverlay`、`getLayoutBox`（处理 `display:contents` 的 span 包装层）、`parsePosition`（用 shared 的 `SOURCE_REF_RE`）。
- `state.ts` - 共享可变状态 + `clientConfig`（从 `window.__DEV_INSPECTOR_CFG__` 读取）。
- `extensibility.ts` - `installHost`（从 `@vue-dev-inspector/shared/browser` 导入）挂载 `window.__VDI_HOST__`；`addToolBtn` 队列。
- `types.ts` - `ClientCfg` / `PanelData` / `PropEntry` 等类型声明。

约定：
- 所有 CSS class 以 `__vdi-` 为前缀，避免与宿主页面冲突。
- 动态布局属性（`left/top/display`）通过 JS 内联设置；静态样式写在 `overlay.css` 中。
- 样式注入用 `id="__vdi-overlay-style__"`，幂等。

### 运行时：服务端 AST 编辑（`packages/client`）

`server.ts` 是 Vite dev middleware，挂在 `/__dev-inspector-api__`（常量 `API_PREFIX` 见 `shared/src/options.ts`）下。

**REST 路由**（仅 POST；`OPTIONS` 走 CORS preflight -> 204）：

| 路径 | 功能 |
|---|---|
| `/get-props` | 读指定 `(file, line, col)` 元素的属性（AST 提取） |
| `/update-props` | 用 `PropEntry[]` 覆盖元素属性（原子修改 `magic-string`） |
| `/delete-element` | 删除元素完整源码区间 |
| `/insert-component` | 在元素前/后/内（`before`/`after`/`inside`）插入组件 |
| `/duplicate-element` | 同级复制元素 |
| `/move-element` | 同文件内移动元素（drag 模式） |
| `/get-block` / `/update-block` | 读写 SFC `<script>`/`<style>` 块 |
| `/get-child-text` / `/update-child-text` | 读写元素子节点源码 |
| `/list-components` / `/get-component-config` | 扫描 `.vue` / 组件目录 |
| `/open-in-editor` | 用 `code`/`webstorm`/`atom`/`subl` 或 URL protocol 打开文件 |

所有处理器经 `safePath()` 校验（在 `projectRoot` 下解析，拒绝路径穿越）。`editor.ts` 负责 AST 操作（`baseParse` + MagicString 原子替换）。写入文件后由 Vite HMR 热更新。`parseSource` 用 shared 的 `SOURCE_REF_RE`。

**已知 invariant**（`editor.ts`）：
- `editElementProps` 在 `[tagNameEnd, openTagEnd)` 上做修改。
- 当 `openTagEnd === tagNameEnd`（如自闭合标签无任何现有属性）时，**必须用 `prependRight` 而非 `overwrite`**——MagicString 不允许 `overwrite` 零长度区间，会抛 `Cannot overwrite a zero-length range`。
- 当 `attrs` 为空但区间非空时，用 `remove`；当两者都为空时直接返回原源码。
- `getChildText`/`updateChildText` 的闭合标签定位用 `findCloseTagStart`（AST `el.loc.source` 末尾正则 `</tag\s*>`），**不用算术法**——`</a-card\n    >` 这种跨行闭合标签会让 `elementEnd-(tag.length+3)` 算短，把半截闭标签混进子节点内容。
- `deleteElement`/`moveElement` 删除段共用 `removeElementRange`；自闭合展开（`/>`->`>`+body+`</tag>`）三处共用 `expandSelfClosing`。
- 组件拓展定义约定，需要根据 `import type { ComponentConfigEntry } from "@vue-dev-inspector/shared"` 中 `ComponentConfigEntry` 定义的属性生成。

### 配置流转

`DevInspectorOptions`（`core/src/options.ts` 或 `uni/src/options.ts`）
  -> `vueDevInspector()`/`uniDevInspector()` 与 `DEFAULT_OPTIONS` 合并
  -> `buildCfgJson`（pluginkit）序列化为 `window.__DEV_INSPECTOR_CFG__`
  -> overlay 的 `state.ts` 中 `clientConfig` 读取
  -> overlay 通过 `apiPrefix + path` 调服务端
  -> 打开编辑器无 CLI 匹配时回退到 `EDITOR_PROTOCOLS` 的 URL protocol

### 包依赖图

```
demo ────────► core ──┬── pluginkit ──► { shared, utils }
uni-demo ────► uni ──┘                ├── client ──► shared
                                      ├── shared (root: 常量+类型; /browser: host-bridge)
                                      ├── utils (paths, cdn)
                                      └── overlay (IIFE，构建产物 cp 进 core/uni dist)

antdv ──► { shared, utils }
uview ──► { shared }

构建期：core/uni 经 tsup bundle 进 pluginkit/client/utils/shared（devDependencies，不发 npm）
运行期：core/uni dist 仅外置 @vue/compiler-sfc/core/shared（公开 npm 包，在 dependencies）
```

## 约定

- 包管理器：**pnpm**（workspace `packages/*` + `packages/examples/*`），锁文件 `pnpm-lock.yaml`。
- 全项目 **ESM-only**（所有包 `"type": "module"`）。
- 注释和标识符双语风格：**中文注释，英文标识符**。请保持与周围代码一致。
- overlay 类名始终 `__vdi-` 前缀；动态布局属性 JS 内联，静态样式写 `overlay.css`。
- 修改 `packages/overlay/src/*` 后必须**重建 overlay 并重启 demo**——插件启动时一次性从磁盘读取 `dist/overlay.iife.js`，旧产物会一直驻留。
- 修改 `core/src/*`、`client/src/*`、`pluginkit/src/*`、`shared/src/*`、`utils/src/*` 后必须分别重建对应包，再重启 demo。
- tsconfig 统一 extends `tsconfig.base.json`；新增包照此办理。
- 提交前 husky 会通过 lint-staged 自动跑 `eslint --fix`。
- 服务启动操作交由用户协作完成，不允许AI自己执行。
