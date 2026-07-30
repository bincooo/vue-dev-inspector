## Why

`@vue-dev-inspector/antdv` 的组件目录仅覆盖 13 个组件，而 `antdv-next@1.4.1` 实际暴露约 60 个可用组件标签（`web-tags.json`）。目录覆盖率约 20%，导致用户在属性选择抽屉与组件插入抽屉中找不到大部分常用组件（如 `a-modal`/`a-drawer`/`a-table`/`a-form`/`a-tabs` 等），只能手动输入 tag 与属性，削弱了物料库的实用价值。同一批次还需把 4 个 demo 已使用但目录缺失的组件补齐（`a-drawer`/`a-modal`/`a-radio-group`/`a-typography-text`）。

## What Changes

- 补齐 antdv 组件目录中缺失的常用组件，按 antdv 官方分类归入既有分组结构（通用/布局/表单/反馈/数据展示），并新增「导航」分组。
- 每个新增组件遵循既有 `ComponentItem` 约定：`tag`/`label`/`icon`(iconify 短串)/`snippet`/`attrs`（含属性与事件分组），与现有 13 条目录风格一致。
- 为现有 13 个组件补齐遗漏的常用属性与事件（如 `a-input` 缺 `addon-before`/`max-length`，`a-button` 缺 `href`/`block` 等），保持属性抽屉的提示完整性。
- antdv 组件通过 `app.use(Antd)` 全局注册，`a-*` 标签无需声明 `imports` 字段。
- 不改变 `ComponentConfigEntry`/`ComponentItem`/`ComponentAttr` 的类型契约，不改变 overlay 抽屉的渲染逻辑——仅扩充数据。

## Capabilities

### New Capabilities
- `antdv-component-catalog`: antdv 物料库的组件目录覆盖范围与单组件属性元数据约定（分组归属、必填属性集、事件命名）。

### Modified Capabilities
<!-- 无。现有 `attr-picker-drawer` spec 描述的是属性选择抽屉的交互行为，本次不改动其 requirement。 -->

## Impact

- **代码**：`packages/antdv/src/index.ts`（唯一改动点，纯数据扩充，~13 条 -> ~71 条 items）。
- **构建**：`packages/antdv` 重建（`pnpm build:antd`），产物 `dist/index.js` 体积增长（均为静态字面量）。
- **下游**：core/uni 经 `componentConfig` 注入，`buildCfgJson` 序列化到 `window.__DEV_INSPECTOR_CFG__`——配置 JSON 体积增长，需确认 overlay 抽屉渲染几十条 items 的性能（一次性渲染，无虚拟列表）。
- **依赖**：无新增运行时依赖；iconify 图标仍走 overlay 运行时 fetch。
