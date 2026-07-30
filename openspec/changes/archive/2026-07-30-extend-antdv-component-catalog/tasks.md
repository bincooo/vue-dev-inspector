## 1. 准备工作

- [x] 1.1 确认 antdv 组件通过 `app.use(Antd)` 全局注册，`a-*` 标签无需声明 `imports` 字段。

## 2. 为既有 13 个组件补齐遗漏属性

- [x] 2.1 为 `a-button` 补 `href`/`block` 等常用属性。
- [x] 2.2 为 `a-tag` 补 `bordered` 属性。
- [x] 2.3 为 `a-divider`、`a-space` 核对属性完整性。
- [x] 2.4 为 `a-input`、`a-input-password`、`a-select`、`a-date-picker`、`a-switch`、`a-checkbox`、`a-radio` 补齐各组件遗漏的常用属性（如 `a-input` 的 `max-length`/`addon-before`）。
- [x] 2.5 为 `a-alert`、`a-card` 补齐遗漏属性。

## 3. 新增「通用」分组组件

- [x] 3.1 添加 `a-typography-text`（demo 缺失项）、`a-typography-title`、`a-typography-paragraph`，含 `copyable`/`type`/`strong` 等属性。
- [x] 3.2 添加 `a-flex`（`Flex`），含 `gap`/`vertical`/`justify`/`align` 属性。

## 4. 新增「布局」分组组件

- [x] 4.1 添加 `a-layout`（`Layout`）与 `a-layout-sider`（`LayoutSider`），含 `has-sider`/`collapsed` 等属性。
- [x] 4.2 添加 `a-row`（`Row`）与 `a-col`（`Col`），含 `gutter`/`span`/`offset` 属性。
- [x] 4.3 添加 `a-affix`（`Affix`），含 `offset-top`/`offset-bottom` 属性。
- [x] 4.4 添加 `a-space-compact`（`SpaceCompact`），含 `direction`/`block` 属性。

## 5. 新增「导航」分组（新分组）

- [x] 5.1 创建 `antdv/导航` 分组，添加 `a-breadcrumb`（`Breadcrumb`）、`a-dropdown`（`Dropdown`）。
- [x] 5.2 添加 `a-menu`（`Menu`）、`a-pagination`（`Pagination`）。
- [x] 5.3 添加 `a-steps`（`Steps`）、`a-tabs`（`Tabs`）。

## 6. 新增「表单」分组组件

- [x] 6.1 添加 `a-radio-group`（demo 缺失项）、`a-checkbox-group`。
- [x] 6.2 添加 `a-auto-complete`、`a-cascader`。
- [x] 6.3 添加 `a-color-picker`、`a-range-picker`。
- [x] 6.4 添加 `a-text-area`、`a-input-search`、`a-input-number`。
- [x] 6.5 添加 `a-mentions`、`a-rate`、`a-slider`。
- [x] 6.6 添加 `a-time-picker`、`a-transfer`、`a-tree-select`。
- [x] 6.7 添加 `a-upload`、`a-form`、`a-form-item`。

## 7. 新增「反馈」分组组件

- [x] 7.1 添加 `a-drawer`（demo 缺失项），含 `open`/`placement`/`width`/`@close` 属性。
- [x] 7.2 添加 `a-modal`（demo 缺失项），含 `open`/`title`/`@ok`/`@cancel` 属性。
- [x] 7.3 添加 `a-popconfirm`、`a-progress`。
- [x] 7.4 添加 `a-result`、`a-skeleton`、`a-spin`。

## 8. 新增「数据展示」分组组件

- [x] 8.1 添加 `a-avatar`、`a-badge`。
- [x] 8.2 添加 `a-calendar`、`a-carousel`。
- [x] 8.3 添加 `a-collapse`、`a-descriptions`。
- [x] 8.4 添加 `a-empty`、`a-image`。
- [x] 8.5 添加 `a-popover`、`a-segmented`。
- [x] 8.6 添加 `a-statistic`、`a-table`。
- [x] 8.7 添加 `a-timeline`、`a-tooltip`。
- [x] 8.8 添加 `a-tree`、`a-qrcode`、`a-watermark`。

## 9. 构建与验证

- [x] 9.1 运行 `pnpm -C packages/antdv build` 构建 plugin + expand，确认无 TS 报错。
- [x] 9.2 运行 `pnpm typecheck` 确认类型通过。
- [x] 9.3 运行 `pnpm lint` 确认 ESLint 通过。
- [ ] 9.4 启动 PC demo（由用户执行），在组件插入抽屉中验证：六个分组均渲染、demo 缺失项（`a-drawer`/`a-modal`/`a-radio-group`/`a-typography-text`）可被搜到并插入、属性选择抽屉显示新增属性。
- [x] 9.5 运行 `pnpm run prettier` 格式化改动代码。
