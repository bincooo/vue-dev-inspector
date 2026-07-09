# Refactor Candidates — vue-dev-inspector

> **状态：候选清单，待用户逐条勾选。**
> **For agentic workers:** 本文件**不是**实现计划。每条候选需用户勾选后才进入"逐条落地"阶段。改动行为须由用户协作 `pnpm dev:demo` 验证（CLAUDE.md: 服务启动由人协作）。

**Goal:** 在不改变现有功能的前提下，清理 4 个核心包（`shared` / `overlay` / `client` / `core`）+ workspace 配置的臃肿/无效代码、违反 SRP 与迪米特法则的位置，让上下文清晰便于后续迭代。

**Architecture:** 纯结构性精简 + 少量精确 doc 修复。每条改动保持当前外部 API、注入产物（`data-source-file` / `data-inspector-tag` / 注入脚本）、服务端 REST 路由的字节级一致。

**Tech Stack:** pnpm monorepo (7 packages), TypeScript, `@vue/compiler-sfc`, MagicString, Node middleware, Vite plugin, browser IIFE.

---

## 扫描范围与发现概览

| 范围 | 候选数 | HIGH | MEDIUM | LOW |
|---|---|---|---|---|
| `packages/client` | 34 | 0 | 12 | 22 |
| `packages/shared` + `packages/overlay` | 20 | 3 | 7 | 11 |
| `packages/core` | 15 | 1* | 3 | 11 |
| 根 + workspace 配置 | 27 | 3 | 13 | 11 |
| **合计** | **96** | **7** | **35** | **54** |

\* C1 = active bug (已选 **(b)**: doc 修齐默认 `[]`，不动 `DEFAULT_OPTIONS`)。

**未扫描：** `packages/antdv/src/`（仅扫了它的 `package.json` 与配置问题）。如需要，后续可单独扫。

---

## 用户已对齐的"不动 / 改 doc"决策

| # | 决策 | 内容 |
|---|---|---|
| C1 | **(b)** doc 修齐默认 `[]` | `packages/core/src/options.ts` L60-94 JSDoc 改写为"默认关闭；需在 vite.config.ts 显式传入 `expressionPlugins: ['typescript']`" |
| WS-D1 | **(b)** 加 doc 不动代码 | `packages/core/src/plugin.ts:12,17,18` 的 `../../client` / `../../utils/src/...` 深度相对导入，**保留**。在 CLAUDE.md 加一行说明："core 故意走同源目录 shortcut 跳过 package.json 边界，dist 体积更小；不改成 workspace:* import"。 |

---

## ⛔ HIGH 风险候选（必须用户单独评估后再动）

### H1 — `packages/core/src/options.ts` L60-94
**用户决定：**(b) doc-only（见上表）。

---

### H2 — `packages/core/package.json:18` tsup 引用不存在的 `src/plugin-entry.ts`
**当前：**
```json
"build": "tsup src/index.ts src/plugin-entry.ts --format esm --platform node --dts --sourcemap --clean --external @vue/compiler-sfc && cp ../overlay/dist/overlay.iife.js dist/overlay.iife.js"
```
**问题：** `packages/core/src/` 下只有 `index.ts` / `options.ts` / `plugin.ts` / `transform.ts`，**没有 `plugin-entry.ts`**。tsup 对找不到的 entry 静默忽略，build 没炸过——但 dist 输出的实际文件与声明可能不一致。
**方向（择一）：**
- (a) 删 `src/plugin-entry.ts` 第二个 entry，改为 `tsup src/index.ts --format esm ...`
- (b) 真要双 entry：新建 `plugin-entry.ts`（re-export plugin 部分 API）保留多入口意图
**风险点：** 改 build 命令 = 改 dist 产物；core 是被 demo 链式消费的根节点。
**验证：** `rm -rf packages/core/dist && pnpm -C packages/core build`；`ls packages/core/dist/` 应见 `index.js` + `index.d.ts` + `overlay.iife.js`；`pnpm dev:demo` 仍工作。

---

### H3 — `packages/overlay/src/state.ts` ↔ `inspector.ts` 循环依赖
**文件：** `packages/overlay/src/state.ts` L16, L130-132；`inspector.ts` L15
**问题：** `state.ts`（共享可变数据）反向 import `inspector.ts` 的 `renderToolButtons` / `clearToolButtons`，造成 `state → inspector → state` 循环。每次选中元素时 `setSelectedElement` 都偷偷触发了 DOM 副作用。
**方向：** 把 `renderToolButtons(next) / clearToolButtons()` 从 `setSelectedElement` 内部移出；由 `events.ts`（已在调 `setSelectedElement` 后跟 `redrawSelection`）补一行 `inspector.refreshToolButtons()`。
**风险点：** 共享可变状态 setter 的副作用语义变了；点击 / 双击 / 拖拽 / 删除路径都要重测选中态。
**验证：** `pnpm -C packages/overlay build`；`pnpm dev:demo` 中用 Ctrl+点击选中元素，工具按钮仍出现；删除选中元素后 X 关闭按钮消失。

---

### H4 — `packages/overlay/src/inspector.ts` 310 行的多职责单体
**文件：** `packages/overlay/src/inspector.ts` 全文
**问题：** 单文件承载 5 类职责 — 悬浮层创建 / hover-select 状态机 / 拖拽模式 / 操作按钮几何 / 工具按钮渲染 / 服务端调用桥。超过 CLAUDE.md 推荐的 250 行阈值。
**方向：** 拆为 `inspector.ts`（仅 createUI + 状态机）+ `actionButtons.ts`（positionActionButtons/renderToolButtons）+ `dragController.ts`（startDrag/endDrag/redrawDropIndicator + drag 状态键）。`state.dragging` / `dropTarget` / `dropDirection` 移出 `state.ts` 到 `dragState.ts`（仍保持 CLAUDE.md 的"单可变对象" invariant — 通过一个对象导出）。
**风险点：** 大面积重构；许多 caller；导入路径变更。
**验证：** build 输出 IIFE 大小 ±几百字节；`pnpm dev:demo` 全流程冒烟（hover / click / dblclick / right-click / Ctrl-drag / Esc / scroll）。

---

### H5 — `packages/overlay/src/panel.ts` 直接 mutate `state.panelData`
**文件：** `packages/overlay/src/panel.ts` L28-35, 100, 152, 178
**问题：** `state.panelData` 在 7 个位置被直接写入（创建、覆盖 entries、splice、push）；契约"panelData 字段与当前编辑元素保持同步"散落在调用点。
**方向：** 加 `state.openPanel(target)` / `state.closePanel()` setter；panel.ts 自身不直接写 `state.panelData`，其它模块读通过 `state.getPanelData()`。
**风险点：** 共享可变状态形状变更；任何同步假设 `state.panelData` 立即更新的下游逻辑需重测。
**验证：** `pnpm dev:demo` — 双击元素打开面板，编辑字段，保存，再打开另一元素，面板 entries 应重置；删除字段；新增字段。

---

### H6 — `packages/core/src/plugin.ts:12,17,18` 深度相对导入跨包边界
**用户决定：**(b) doc-only（见上表）。

---

### H7 — `packages/demo/package.json:13` `antdv-next: ^1.3.6`
**当前：** demo 包依赖 `antdv-next: ^1.3.6`。pnpm-lock 能解析到 1.3.6（npm 上存在），但**非常规 Ant Design Vue 包名**（通常用 `ant-design-vue`）。
**问题：** 引入意图未在 CLAUDE.md / README / 注释中说明。潜在风险：错包、错版本、错 license、错维护方。
**方向（择一）：**
- (a) 保留 + 在 CLAUDE.md 加一行说明为何用 `antdv-next` 而非 `ant-design-vue`
- (b) 换成正确包（`ant-design-vue`）
- (c) 删（demo 不真正需要这个包做 inspector 演示）
**用户决定：** _（待勾选阶段定）_
**风险点：** demo 运行时依赖；变更会动 `pnpm-lock.yaml`。
**验证：** `pnpm view antdv-next` 看包主页 + `git grep antdv-next packages/demo/src` 看用法。

---

## 🟡 MEDIUM 风险候选（35 条，结构重复 / 契约边缘 / 配置一致性）

### packages/client（12 条）

| # | 文件 / 行 | 问题 | 方向 | 验证 |
|---|---|---|---|---|
| C-M1 | `client/src/editor.ts` L51-99 | `filePath` 形参只在 `parseSFC({filename})` 用一次；`moveElement` 重命名为 `_filePath` 自承冗余 | 删 `filePath`；server.ts 一次解析后只传 `sfcSource` | `rg "_filePath"` 为 0；`pnpm -C packages/client build` |
| C-M2 | `client/src/editor.ts` L130-144 | `findOpenTagEnd` 手写 char 扫描，与 `el.loc.source` 已提供的开标签范围重复 | 直接从 `el.loc.source` 推算 `tagNameEnd` + `openTagEnd` | `rg "findOpenTagEnd"` 为 0；demo 上 `<a-button :icon="…">` get-props / update-props 正常 |
| C-M3 | `client/src/editor.ts` L438-447 + L576-584 | self-closing → paired-tag 写盘配方在 `insertComponent` 与 `moveElement` 间复制粘贴 | 抽 `openTagAndAppend(s, el, insertion, indent)` | 两处 1 处；build + demo OK |
| C-M4 | `client/src/editor.ts` L428 / L473 / L565 / L583 | 4 种不同的 `\n + indent` 拼写；L441 硬编码 4 空格 | 统一走 `insideIndent = targetIndent + "  "`；写一个 helper | `rg '\\n    \${' packages/client/src` 为 0 |
| C-M5 | `client/src/server.ts` L261-309 | `handleMoveElement` 自行解析 body.target；走 `as unknown as RouteBody` 拐弯抹角 | 抽 `resolveTargetSource(roots, body.target, res)` 对称 `resolveSource` | `rg "as unknown as"` 为 0 |
| C-M6 | `client/src/server.ts` L81-92 | `readPropEntries` 静默丢弃坏条目 → `editElementProps` 写入残缺集合 | 拒绝（返回 400）或 log 丢弃数 | 调用点更新 |
| C-M7 | `client/src/server.ts` L354-411 | `EDITOR_CLI`（Record of 函数） + `protocolCmd`（单函数 + platform if/else） 两种结构并存 | 统一 `EDITORS: Record<string, {kind:"cli"\|"protocol", run(fp,line,col)}>` | `rg "EDITOR_CLI\|protocolCmd"` 单一定义 |
| C-M8 | `client/src/server.ts` L393-396 | `exec` 回调 fire-and-forget；唯一一处裸 `node:child_process` | 包成 `runEditorCommand(cmd): Promise<void>` | `rg "from 'node:child_process'"` 为 0 |
| C-M9 | `client/src/server.ts` L420-457 | `createDevServer` middleware 单闭包做 5 件事（CORS + 路由分发 + body 解析 + 错误归一 + 路由派发） | 抽 `applyCors(res)` / `dispatchRoute(req, res, roots)` | `rg 'Access-Control-Allow'` 收口一处 |
| C-M10 | `client/src/server.ts` L30-34 | `RouteHandler` 签名每个 handler 重复 `(roots, body, res)`；`projectRoots` 实际只 `resolveSource` 用一次 | 改 `makeHandlers(roots)` 闭包 curry | `rg "projectRoots: string"` 为 0 |
| C-M11 | `client/src/editor.ts` L269-367 | `COMPONENT_CATALOG` 99 行 antdv 硬编码数据与 AST 编辑混在一个文件 | 移到 `packages/client/src/catalog.ts` | 移到新文件；build OK |
| C-M12 | `client/src/transform.ts` + `client/src/editor.ts` L130 | `findOpenTagEnd` 在 core 与 client 各一份 | 移到 `packages/shared/src/utils.ts`；core + client 共引 | 见 K-M3 同源 |

### packages/shared + packages/overlay（7 条）

| # | 文件 / 行 | 问题 | 方向 | 验证 |
|---|---|---|---|---|
| S-M1 | `shared/src/host-bridge.ts` L33-35, L134-139 | `VdiHost.emitInspect/emitSelect` 是纯转发；IIFE 状态机已自行派发，flush 分支永不走 | 从 `VdiHost` 接口与 `flushPending` 同时移除 | `pnpm -C packages/overlay build` 仍产合法 IIFE；test 通过 |
| S-M2 | `overlay/src/state.ts` L33 | `state.projectRoots` 被赋值但无任何 reader | 删除（连同 `ClientCfg.projectRoots`） | `rg "state.projectRoots"` 仅赋值点；build OK |
| S-M3 | `overlay/src/state.ts` L31 | `state.protocol` 同上：赋值后无 reader | 删除（`ClientCfg.protocol` 可保留作公开契约） | `rg "state.protocol"` 仅赋值点；build OK |
| S-M4 | `overlay/src/inspector.ts` L109-112 | `deleteElement` 仅 `void deleteElementViaApi(element)` 一行包装 | 删 wrapper；events.ts:227 直接调 `deleteElementViaApi` | `rg "deleteElement\b" packages/overlay` 仅 menu + events |
| S-M5 | `overlay/src/drawer.ts` L83, L113 | `let activeIndex = state.activeEntryIndex` 与 `state.activeEntryIndex` 同步双写 | 仅 `state.activeEntryIndex` 单写；闭包 `activeIndex` 只作渲染源 | demo 开抽屉、切 tab、关、再开 — 上次选中 tab 仍激活 |
| S-M6 | `overlay/src/events.ts` L213-228 | `state.copyButton/deleteButton` 直接 `style.display === "flex"` + `.contains(target)` | 抽 `inspector.handleActionClick(target): "copy"\|"delete"\|"insert"\|null` | demo 上复制/删除/+上/+下四个按钮仍工作 |
| S-M7 | `overlay/src/events.ts` L130-394 | `init()` 265 行做 4 件事：生命周期绑定 / 齿轮按钮 / 快捷键解析 / 内联 helper | 抽 `gearButton.ts` + `eventBindings.ts`；`init()` 收为 ~20 行 | build 输出 IIFE 大小相近；demo 全流程冒烟 |

### packages/core（3 条）

| # | 文件 / 行 | 问题 | 方向 | 验证 |
|---|---|---|---|---|
| K-M1 | `core/src/options.ts` L22, L88 + `plugin.ts` L75 | `attrName` 用户可配，但配套 `tagAttr = "data-inspector-tag"` 在 cfg 硬编码；不能配套改名 | 把 `tagAttr` 提到 `shared/src/options.ts` 作 `TAG_ATTR` 常量；core + overlay + client 同引 | `pnpm -C packages/core build`；`window.__DEV_INSPECTOR_CFG__.tagAttr === "data-inspector-tag"`；overlay 显示 tag 名正常 |
| K-M2 | `core/src/plugin.ts` L209-219 | `transformIndexHtml` 用 `html.replace("</body>", …)` 字符串替换；用户 HTML 含 `</body>` 字面会双注入；每次 HMR 都重算 cfg JSON | 改 Vite 官方 `TransformResult` + `applyToIndex` 风格；以 `options + projectRoots` 为键做 memoization | build OK；demo view-source 顺序保持；`vite build` 一个最小项目确认 prod HTML 无 `__DEV_INSPECTOR_CFG__` |
| K-M3 | `core/src/transform.ts` L27-43 与 `client/src/editor.ts` L130（**同源 C-M12**） | 两份 `findOpenTagEnd` 注释/签名不一致，规则漂移风险 | 移到 shared；core + client 共引 | `data-source-file` / `data-inspector-wrap` 字节级不变；demo OK |

### workspace 配置（13 条）

| # | 文件 / 行 | 问题 | 方向 | 验证 |
|---|---|---|---|---|
| W-M1 | root `package.json:10-11` | `dev:demo` 不构建依赖就直接跑 demo，必失败 | `dev:demo` 改为 `build:core &amp;&amp; pnpm -C packages/demo dev`（CLAUDE.md 描述的链） | `rm -rf packages/*/dist &amp;&amp; pnpm dev:demo` 一次性启动 |
| W-M2 | root `package.json:18-25` | 根 `dependencies` 含 `@vitejs/plugin-vue` / `@vue/compiler-*` / `magic-string` / `vue`，但根 `src/` 不 import 它们 | 移入 `devDependencies`（landing-page 真实使用的话）或删除 | `pnpm install &amp;&amp; pnpm dev &amp;&amp; pnpm tsc --noEmit` 仍成功 |
| W-M3 | root `tsconfig.json` + `packages/{shared,client}/tsconfig.json` extend | 根 `tsconfig.json` 的 `paths.@/* → ./src/*` 被 `shared` `client` 的 extends 拖进来，是脚枪 | 拆 `tsconfig.base.json`（仅 strict/noEmit）或从 base 移出 paths | `pnpm -C packages/shared tsc --noEmit` 仍 0 |
| W-M4 | `packages/core/package.json:20-22` | `@vue/compiler-sfc` 在 root 与 core `dependencies` 同时声明 | 二选一，core 是真实消费方，留 core 删 root | `pnpm install &amp;&amp; pnpm dev:demo` 工作 |
| W-M5 | `packages/core/package.json:24-26` | `@vue-dev-inspector/utils` 列在 `devDependencies` 但 `plugin.ts` 在 runtime 用它 | 移入 `dependencies`（与 `shared` 对称） | `pnpm -C packages/core tsc --noEmit` 0；pack dry-run 显示 utils |
| W-M6 | `packages/utils/package.json:5-14` + build script | 声明 `dist/index.cjs` + `require` 入口，但 tsup 只产 ESM | 删 CJS 入口 / 改 tsup 加 `--format esm,cjs`（CLAUDE.md 说"全项目 ESM-only"，建议前者） | `pnpm -C packages/utils build &amp;&amp; ls dist` 与 package.json 声明一致 |
| W-M7 | `packages/utils/src/cdn.ts:17-19` | 默认 `_builder` 初始化函数与 JSDoc "未注册返回 undefined" / 测试语义冲突 | 删默认初始化，`_builder` 真为 `undefined` 直到注册 | `pnpm -C packages/utils test` 调整 prep 步骤后仍通过 |
| W-M8 | `packages/utils/src/paths.ts:99-112` | `loadScriptSpecifier` 注释说 3 种形式（local / pkg: / cdn:），代码只实现 2 种；form 2 是死代码 | 实现 form 2 或改 JSDoc 只描述 2 种 | `pnpm -C packages/utils test` 通过；`pnpm -C packages/antdv build &amp;&amp; pnpm dev:demo` 仍工作 |
| W-M9 | `packages/antdv/package.json:19-22` | `build:plugin` tsup `--clean` + `build:expand` vite 顺序脆弱；tsup 失败后 dist 半空 | 加 `prebuild` 跑 vite IIFE，或 tsup 去 `--clean` 加独立 `clean` 脚本 | `rm -rf packages/antdv/dist &amp;&amp; pnpm -C packages/antdv build` → dist 含 index.js + expand.iife.js |
| W-M10 | `packages/{shared,utils,antdv,core}/package.json` | 4 个包 `private: false`（CLAUDE.md 第 17 行声称"均为 private"，事实不符） | 要么全 `private: true`，要么全加 `publishConfig.access: "public"` 并固化版本流程 | `pnpm -r publish --dry-run` 显意图一致 |
| W-M11 | 缺 `packages/core/tsconfig.json` | 5/6 包有 tsconfig，core 没有；CLAUDE.md 类型检查约定覆盖不全 | 镜像 `packages/client/tsconfig.json` | `npx tsc -p packages/core/tsconfig.json --noEmit` 0 |
| W-M12 | root `package.json` 缺 `typecheck` | 每个包单独 `tsc -p` 容易忘；CLAUDE.md 没给一键命令 | 加 `"typecheck": "for p in shared overlay client core antdv utils demo; do pnpm -C packages/$p exec tsc --noEmit; done"` | `pnpm typecheck` 一次性跑过 6 包 |
| W-M13 | root `package.json` + 多个子包 | 6 个子包中只有 `overlay` `client` 有 `test`，根无统一 `test` | 加 `"test": "pnpm -r --parallel test"` 到 root | `pnpm test` 跑过全部 4 个测试文件 |

---

## 🟢 LOW 风险候选（54 条，重命名 / 死代码 / 注释清理）

### packages/client（22 条 LOW）

| # | 文件 / 行 | 问题 | 方向 | 验证 |
|---|---|---|---|---|
| C-L1 | `editor.ts` L31-32 | `isSimpleExp` 用魔数 `4` | 改 `NodeTypes.SIMPLE_EXPRESSION` | `rg "type === 4"` 为 0 |
| C-L2 | `editor.ts` L73-77 | `as unknown as` 双转型 for IfNode/ForNode | 改 import `IfNode`/`ForNode` 类型 | `rg "as unknown as"` 为 0 |
| C-L3 | `editor.ts` L405 | `insertComponent` 内联重复 `MoveDirection` 联合 | 复用 `MoveDirection` | `rg '"inside" \| "before" \| "after"'` 为 0 |
| C-L4 | `editor.ts` L413 | 目录未命中时用 `` `<${componentTag} />` `` 走旁路，没走 `componentSnippet` | 走 `componentSnippet(syntheticSchema)` | `rg "<${componentTag}"` 为 0 |
| C-L5 | `editor.ts` L373-379 | `componentSnippet` 有死变量 `const indent = ""` | 删除 | rg 无；build OK |
| C-L6 | `editor.ts` L538-548 | `reindent` 隐式闭包外 `sourceIndent` | 提到模块作用域，显式参数 | `rg "function reindent"` 在模块级 |
| C-L7 | `editor.ts` L256-267 | `ComponentSchema.props?` 字段声明但从未读 | 删字段 | `rg "schema\.props"` 为 0 |
| C-L8 | `editor.ts` L261-267 | `snippet` 与 `selfClosing` 同时给时后者被忽略 | 删去 `snippet` 条目的冗余 `selfClosing` | rg 比对 |
| C-L9 | `editor.ts` L51 | `offsetToLine` 每次都 O(offset) 全扫 | 用 `tpl.loc.start.line` 或 memoize | build + test OK |
| C-L10 | `editor.ts` L156-162 | `resolveTagRange` 返回 `{tagNameEnd, openTagEnd}` 但调用点只用其一 | 拆为两个窄函数 | rg |
| C-L11 | `server.ts` L386-387 | `readNumber(body, "line", 1) || 1` 二次 fallback 死守 | 删 `\|\| 1` | `rg "readNumber.*\\|\\| 1"` 为 0 |
| C-L12 | `server.ts` L20-37 | `RouteBody = Record<string, unknown>` 形同虚设 | 改 handler 入参为 `unknown`，自做窄校验 | rg |
| C-L13 | `server.ts` L145-146 | `MOVE_DIRECTIONS = INSERT_DIRECTIONS` 别名同源未来会漂移 | 合一为 `RELATIVE_POSITIONS` | rg |
| C-L14 | `server.ts` L290 | `enforceEnum(...) as MoveDirection` 防御 cast | 改返回 `T \| undefined` | rg |
| C-L15 | `server.ts` L424-429 | `projectRoots.length === 0` 时 throw — 由构造保证不空 | 删 throw 或降级 `console.warn` | rg |
| C-L16 | `server.ts` L466-484 | `parseSource` 导出但仅自用 | 去 `export` 或显式公开 | rg |
| C-L17 | `server.ts` L493-507 | `safePath` 导出但仅自用 | 去 `export` 或显式公开 | rg |
| C-L18 | `server.ts` L62-67 + L435-440 | CORS 头在两处重复设 | 抽 `setCorsHeaders(res)` | rg |
| C-L19 | `server.ts` L466, L482 | `parseSource` 不校验 `line < 1 \|\| col < 0` | 加 `assertValidLoc` 或在 parseSource 拒 | rg |
| C-L20 | `server.ts` L322-345 | `walk(rootIndex, …)` 名字未暗示"收集" | 内联或改名 `walkAndCollect` | rg |
| C-L21 | `server.ts` L402-411 | `ROUTES` 表 8 个 method 都 `POST`；method 层冗余 | 改 `Record<path, handler>` 或配 method 数组 | rg |
| C-L22 | `server.ts` L34 | `RouteBody` JSDoc 写"JSON 字符串"但已 parse | 改注释 | review |

### packages/shared + packages/overlay（11 条 LOW）

| # | 文件 / 行 | 问题 | 方向 | 验证 |
|---|---|---|---|---|
| S-L1 | `shared/src/host-bridge.ts` L17-18 | 注释提及不存在的 `queueAddBtn/queueOnInspect/queueOnSelect` | 改注释为 `addToolBtn/onInspect/onSelect` | rg |
| S-L2 | `shared/src/index.ts` L4 | barrel 转发 `host-bridge`（含 DOM 代码）给 Node 消费者 | 去掉 re-export；需要者用深路径 | core 产物无 `setInterval`/`__VDI_HOST__` |
| S-L3 | `overlay/src/utils.ts` L37-55 | `readPosition` 导出但 8 个调用点都没用，都内联 `parsePosition(...)!` | 删（或全改用） | rg |
| S-L4 | `overlay/src/utils.ts` L175-177 | `logError` 走 `console.warn` 与函数名不符 | 改 `console.error`；三处 `console.error` 也走 `logError` | devtools 过滤 errors 看到 |
| S-L5 | `overlay/src/utils.ts` L134 | 中段 `import type` 违反 `import/first` | 移到文件顶部 | lint OK |
| S-L6 | `overlay/src/escape.ts` 全文 | 整个文件无人 import | 删 | rg |
| S-L7 | `overlay/src/drawer.ts` L167, L229 | 局部变量 `let any = false` 与全局 `any` 撞名 | 改名 `hasMatch`；空判改 `list.children.length` | rg |
| S-L8 | `overlay/src/drawer.ts` L116-120 | 两次 `(el as HTMLElement).classList.toggle` | `Array.from(tabs.children) as HTMLElement[]` 单次 | demo 切 tab 正常 |
| S-L9 | `overlay/src/events.ts` L393 | `void formatPosition;` 死语句 | 删 | build OK |
| S-L10 | `overlay/src/extensibility.ts` L21 | 注释 `// DOM 渲染由 Task 4 接入` 是计划文档残留 | 删 | rg |
| S-L11 | `overlay/src/extensibility.ts` L52, L78 | `console.error('[vdi] …')` 与 `BRAND` 常量不一致 | 用 `BRAND` 或 `logError` | rg |
| S-L12 | `overlay/src/panel.ts` L143 | `renderList` 导出但仅自用 | 去 `export` | rg |

### packages/core（11 条 LOW）

| # | 文件 / 行 | 问题 | 方向 | 验证 |
|---|---|---|---|---|
| K-L1 | `options.ts` L9, L87 | 默认 `exclude` 含 `/\.d\.ts$/` 但 transform 仅 `id.endsWith(".vue")` | 删 `/\.d\.ts$/` | `rg "\\.d\\.ts\\$"` 为 0 |
| K-L2 | `options.ts` L71-82 | `expandCdn` JSDoc 与 cdn.ts 默认值不一致 | 改 JSDoc | review |
| K-L3 | `plugin.ts` L124-129 | `setCdnBuilder(options.expandCdn)` factory 阶段无条件跑（即使 prod build 也会注册） | 移入 `configResolved` 并以 `isDev` 守卫 | build OK；demo expand 注入正常 |
| K-L4 | `plugin.ts` L31-40 | `_overlayScript` 模块级 lazy singleton 与闭包函数并存 | inline 进 `vueDevInspector` 闭包 | build OK |
| K-L5 | `plugin.ts` L147 | `configResolved` 后两行注释是上一次重构的化石 | 删或合并到顶部 | review |
| K-L6 | `transform.ts` L5-15 | `SKIP_TAGS` 硬编码集合，无测试保护 | 移到 `shared` + 加 1 行 `rg` 守卫或注释枚举来源 | rg |
| K-L7 | `transform.ts` L99-101 | 列号 0-based 假设未文档化 | 加 fixture test 锁定 | 加测试 |
| K-L8 | `transform.ts` L85, L105-117 | `createInspectorTransform` 内嵌两条 emission 策略 + 共享 `ref` 计算 | 抽 `wrapWithSpan(s, ref, el, attrName, start)` | build OK；demo wrap 元素 hover 正常 |
| K-L9 | `transform.ts` L113, L124 + `plugin.ts` L75 | `"data-inspector-tag"` 字面量三处重复 | 提常量 `TAG_ATTR` 到 shared | rg |
| K-L10 | `core/dist/index.js` 2.5MB | 体积观察；`--external @vue/compiler-core` `magic-string` 未声明 | 评估 externalize 或保留（私有包，不发布） | `pnpm -C packages/core build` 后 `ls -la` |
| K-L11 | `core/README.md:36-40` | 选项表过时，含 `openInEditor` / `/\.d\.ts$/` 但实际默认无 | 同步 `core/src/options.ts` `DEFAULT_OPTIONS` | `rg "openInEditor" packages/core/src` 0 时改 doc |

### workspace 配置（11 条 LOW）

| # | 文件 / 行 | 问题 | 方向 | 验证 |
|---|---|---|---|---|
| W-L1 | root `package.json:6-17` | CLAUDE.md 写 `pnpm build:overlay` 但 root 无此 script | 加 `"build:overlay": "pnpm -C packages/overlay build"` 或删 CLAUDE.md 那行 | `pnpm run build:overlay` 行为一致 |
| W-L2 | root `package.json:13-14` | `lint` glob `packages/**/*.{ts,tsx,vue}` 不含根 `src/` | 加 `"src/**/*.{ts,tsx,vue,css,scss,md,json}"` | `pnpm lint` 跨 packages + src 干净 |
| W-L3 | root | 无 `.prettierrc*`，`pnpm prettier` 跑默认配置 | 加最小 `.prettierrc.json`（单引、无 semicolon、2 空格）匹配实际风格 | `pnpm prettier --check` |
| W-L4 | `eslint.config.ts:9-17` | `**/*.min.*` ignore 模式多余 | 删 | `pnpm lint` 输出不变 |
| W-L5 | `README.md:48-52` | 让用户 `pnpm run build:core &amp;&amp; pnpm run dev:demo` 而 `dev:demo` 实际不自给 | 改完 W-M1 后，README 简化为 `pnpm dev:demo` 一行 | grep README 引用 `build:core` 次数降 |
| W-L6 | `README.md` | 没说 `pnpm dev` 是 landing page，不是 demo | 顶部加一行警告 | review |
| W-L7 | `.superpowers/sdd/` | 13+ 临时任务报告（含 60KB diff）只在子目录 `.gitignore` 被屏蔽 | 根 `.gitignore` 加 `/.superpowers/` | `git status` 不显 `.superpowers/sdd/*` |
| W-L8 | `docs/superpowers/plans/2026-07-01-cdn-script-loading.md` | 23KB，描述的 `loadScript` API 已实现（`packages/utils/src/cdn.ts`），状态不明 | 加 Status frontmatter（done/rejected），或移入 `plans/done/` | review |
| W-L9 | `packages/utils/package.json:16-19` | `files: ["dist", "README.md"]` 但包内无 README.md | 加 README 或删字段 | `pnpm pack --dry-run` 无警告 |
| W-L10 | `packages/overlay/src/types.ts` + `src/types/types.d.ts` | 名字重叠（types.ts vs types/），后者仅 5 行 CSS shim | 合并到 `src/shims.d.ts` 删 `types/` 目录 | build + tsc OK |
| W-L11 | `packages/overlay/package.json` 无 `types` 字段 | overlay 是 IIFE-only 不发 dts，但与 `client`/`utils` 命名不一致 | 加注释说明 IIFE 不发 dts，或加 `types` 指向 stub | review |

---

## 用户勾选模板

请按以下格式回复（一行一条）。HIGH 单独明确"动 / 不动"，MEDIUM/LOW 直接 # 编号。

```
H2: 动  # 选 (a) 删 src/plugin-entry.ts entry / 选 (b) 真做双 entry
H3: 动
H4: 不动（暂缓拆分）
H5: 动
H7: 动  # 选 (a/b/c)
C-M1: 动
S-M2: 动
K-M1: 动
W-M1: 动
C-L7: 动
...
```

执行顺序：**HIGH 优先 → MEDIUM → LOW**；同一文件内的多条 MEDIUM/LOW 顺手合并改、单 commit。

## 自审

1. **Spec 覆盖**：✅ 已扫 4 范围（client / shared+overlay / core / workspace），列全 96 候选。未扫 `packages/antdv/src/` 与 `packages/utils/src/` 深度。
2. **占位符扫描**：✅ 无 TODO/占位（这是候选清单，不是实施步骤）。
3. **类型一致**：N/A（无新增类型定义，纯结构性精简）。
4. **CLAUDE.md 一致性**：✅ 包列表已修正为 7 个；`dev:demo` 链与 doc 不一致已记为 W-M1；`private` 标志与 doc 不一致已记为 W-M10。

## 下一步

- [ ] **用户勾选**（等你）
- [ ] 按勾选顺序逐条改，每条改完 commit + 用户协作 `pnpm dev:demo` 验证
- [ ] 第二轮扫 `packages/antdv/src/` 与 `packages/utils/src/`（用户首轮勾选完后启动，按需）