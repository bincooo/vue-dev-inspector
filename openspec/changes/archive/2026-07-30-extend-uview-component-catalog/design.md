## Context

`packages/uview/src/index.ts` 当前返回 18 个组件条目，分布在 5 个分组（基础/表单/布局/反馈/导航）。所有条目都没有 `attrs` 字段。uview-pro@0.6.8 的 `components/` 目录暴露 99 个组件。uview 组件通过 easycom 自动引入，无需 `imports`。见 `proposal.md` 了解动机。

## Goals / Non-Goals

**Goals:**
- 将 uview 目录从 18 条扩充至约 65 条，覆盖 uview-pro 常用组件。
- 为所有条目（含既有 18 条）补充 `attrs` 属性元数据。
- 建立与 antdv 一致的属性元数据约定（属性/事件分组、命名前缀、布尔/枚举 options 规范）。

**Non-Goals:**
- 不改动 `ComponentConfigEntry`/`ComponentItem`/`ComponentAttr` 类型契约。
- 不改动 overlay 抽屉渲染逻辑。
- 不声明 `imports` 字段--uview 组件通过 easycom 自动引入。
- 不覆盖 niche/专用组件：`u-avatar-cropper`、`u-city-select`、`u-car-keyboard`、`u-message-input`、`u-verification-code`、`u-config-provider`、`u-root-portal`。
- 不覆盖纯子槽组件：`u-collapse-item`、`u-dropdown-item`、`u-step`、`u-index-anchor`、`u-time-line-item`、`u-th`/`u-td`/`u-tr`、`u-action-sheet-item`。

## Decisions

### D1: 使用 helper 工厂函数保持与 antdv 一致的代码风格

与 antdv 目录的 `boolAttr`/`sizeAttr`/`disabledAttr`/`eventAttr`/`textAttr`/`modelAttr`/`placeholderAttr` 相同的 helper 模式，减少重复、保证命名/分组一致。

### D2: v-model 命名 -- 统一用 `v-model`（非 `v-model:value`）

uview-pro 组件普遍使用 `modelValue` prop（Vue 3 标准），模板中对应 `v-model`。少数组件有自定义 v-model 参数（如 `u-tabs` 的 `v-model` 绑定 `current`），仍统一用 `v-model`。

### D3: 属性覆盖深度 -- "常用优先"

每个组件声明 3-8 个最常用属性 + 1-3 个事件，对齐 uview-pro 各组件 `types.ts` 中 props 的常见用法。表单类组件统一包含 `disabled`（如适用）+ `v-model` + `@change`。

### D4: 分组结构 -- 新增「数据展示」分组

保留现有 5 个分组，新增 `uview/数据展示` 容纳 `u-swiper`/`u-table`/`u-circle-progress`/`u-count-down`/`u-count-to`/`u-skeleton`/`u-notice-bar`/`u-section`/`u-time-line`/`u-lazy-load`/`u-read-more`/`u-line-progress`/`u-fab`。

### D5: 图标使用 iconify 短串，优先 `i-ant-design:` 前缀

与 antdv 目录一致，`i-ant-design:` 系列无对应图标时回退到其他 prefix。

## Risks / Trade-offs

- **[配置 JSON 体积膨胀]** ~65 条带 attrs 的 items 序列化到 `window.__DEV_INSPECTOR_CFG__`。**缓解**：可接受范围，与 antdv 目录量级一致。
- **[attrs 覆盖深度主观]** 与 antdv 同。**缓解**：以 uview-pro 官方文档/props 定义为基准。
- **[uview-pro 版本对齐]** props 对齐 `uview-pro@0.6.8`，大版本升级可能不兼容。**缓解**：在文件头注释中声明对齐版本。
