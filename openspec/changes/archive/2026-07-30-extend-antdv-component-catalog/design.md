## Context

`packages/antdv/src/index.ts` 当前返回 13 个组件条目，分布在 5 个分组（通用/布局/表单/反馈/数据展示）。antdv-next@1.4.1 的 `web-tags.json` 暴露约 125 个标签，其中约 60 个为可用组件。antdv 组件通过 `app.use(Antd)` 全局注册，`a-*` 标签无需声明 `imports`。见 `proposal.md` 了解动机。

## Goals / Non-Goals

**Goals:**
- 将 antdv 目录从 13 条扩充至约 71 条，覆盖 antdv-next 常用组件。
- 建立可复用的属性元数据约定（属性/事件分组、命名前缀、布尔/枚举 options 规范），供后续 antdv/uview 物料对齐。

**Non-Goals:**
- 不改动 `ComponentConfigEntry`/`ComponentItem`/`ComponentAttr` 类型契约。
- 不改动 overlay 抽屉渲染逻辑（无虚拟列表、无搜索过滤改动）。
- 不声明 `imports` 字段--antdv 组件通过 `app.use(Antd)` 全局注册。
- 不覆盖 niche/最新组件：`a-border-beam`、`a-masonry`、`a-splitter`、`a-tour`、`a-input-otp`、`a-float-back-top`、`a-float-button-group`。
- 不覆盖纯子槽组件（需父上下文、独立插入无意义）：`a-menu-item`、`a-menu-divider`、`a-menu-item-group`、`a-sub-menu`、`a-collapse-panel`、`a-card-grid`、`a-card-meta`、`a-tree-node`、`a-directory-tree`、`a-statistic-timer`、`a-skeleton-*` 子变体、`a-tab-pane`、`a-timeline-item`、`a-breadcrumb-item`、`a-checkable-tag`、`a-checkable-tag-group`。
- 不覆盖图标/配置/工具类非组件：`a-common-icon`、`a-custom-icon`、`a-config-provider`、`a-app`、`a-style-provider` 等。
- 不改动 `expand.ts`（浏览器侧拓展脚本不在本次范围）。

## Decisions

### D1: 分组结构 -- 新增「导航」分组，既有分组不动

保留现有 5 个分组的名称与归属不变（避免破坏既有用户习惯），新增 `antdv/导航` 分组容纳 `a-breadcrumb`/`a-dropdown`/`a-menu`/`a-pagination`/`a-steps`/`a-tabs`。

**备选**：重组为 antdv 官网顺序（通用->布局->导航->表单->数据展示->反馈）。**否决理由**：会改变既有组件的分组归属（如 `a-card` 从「数据展示」移到新位置），破坏肌肉记忆。

### D2: 不声明 `imports` 字段

antdv 组件通过 `app.use(Antd)` 全局注册，`a-*` 标签在模板中直接可用，插入组件时无需向 `<script>` 写入 import。`ComponentItem.imports` 字段虽存在于类型中，但对全局注册的物料库无意义。

### D3: 属性覆盖深度 -- "常用优先"，不追求全量 props

每个组件声明其最常用的 3-8 个属性 + 1-3 个事件。参考标准：antdv 官方文档各组件 API 表的「常见用法」段落，而非全量 props 表。表单类组件统一包含 `disabled`/`size`（如适用）+ 对应 `v-model:xxx` + `@change`。

### D4: 图标全部使用 iconify `i-ant-design:` 前缀短串，保持与既有条目一致

既有 13 条已混用 `i-ant-design:`/`i-vaadin:`/`i-pixel:`/`i-ci:`。新增条目优先选 `i-ant-design:` 系列（与 antdv 视觉一致），该系列无对应图标时回退到其他 prefix。overlay 运行时 fetch 失败时回退到 tag 前 2 字符。

## Risks / Trade-offs

- **[配置 JSON 体积膨胀]** 71 条带 attrs 的 items 序列化到 `window.__DEV_INSPECTOR_CFG__` 预期增加 ~20-30KB（内联到 HTML）。**缓解**：可接受范围（对比 overlay IIFE 本身体积），若未来 uview 同步扩充可考虑按需加载物料目录。
- **[overlay 抽屉一次性渲染 71 条 items 性能]** 当前抽屉无虚拟列表。**缓解**：71 条 DOM 节点量在现代浏览器无压力；若后续多物料库叠加超 200 条再引入虚拟列表（属 overlay 改动，非本次范围）。
- **[attrs 覆盖深度主观]** "常用属性"的选择依赖判断，可能与部分用户期望不符。**缓解**：以 antdv 官方文档「常见用法」为基准，属性选择抽屉本身支持用户手动输入未列出的属性，目录仅作提示加速。
