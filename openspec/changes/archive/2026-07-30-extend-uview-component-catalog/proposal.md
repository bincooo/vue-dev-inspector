## Why

`@vue-dev-inspector/uview` 的组件目录仅覆盖 18 个组件（uview-pro@0.6.8 实际暴露 99 个），且所有条目都没有 `attrs` 属性元数据--用户在属性选择抽屉中得不到任何提示，只能手动输入属性名。同时 demo 已使用的 `u-form`/`u-picker`/`u-select` 三个组件在目录中缺失。

## What Changes

- 为现有 18 个组件补充 `attrs` 属性元数据（属性/事件分组），对齐 uview-pro@0.6.8 的 props 定义。
- 补齐 ~45 个常用 uview-pro 组件，按既有分组结构（基础/表单/布局/反馈/导航）归入，新增「数据展示」分组。
- 补齐 demo 缺失项：`u-form`/`u-picker`/`u-select`。
- uview 组件通过 easycom 自动引入，无需声明 `imports` 字段。
- 不改变 `ComponentConfigEntry`/`ComponentItem`/`ComponentAttr` 的类型契约，不改变 overlay 抽屉的渲染逻辑--仅扩充数据。

## Capabilities

### New Capabilities
- `uview-component-catalog`: uview 物料库的组件目录覆盖范围与单组件属性元数据约定（分组归属、必填属性集、事件命名、v-model 约定）。

### Modified Capabilities
<!-- 无。 -->

## Impact

- **代码**：`packages/uview/src/index.ts`（唯一改动点，纯数据扩充，18 条 -> ~65 条 items，每条增加 attrs）。
- **构建**：`packages/uview` 重建（`pnpm build:uview`），产物 `dist/index.js` 体积增长。
- **下游**：uni 经 `componentConfig` 注入，`buildCfgJson` 序列化到 `window.__DEV_INSPECTOR_CFG__`--配置 JSON 体积增长。
- **依赖**：无新增运行时依赖；iconify 图标仍走 overlay 运行时 fetch。
