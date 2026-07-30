## 1. 准备 helper 工厂函数

- [x] 1.1 在 `packages/uview/src/index.ts` 顶部添加与 antdv 一致的 helper 函数（`boolAttr`/`sizeAttr`/`disabledAttr`/`eventAttr`/`textAttr`/`modelAttr`/`placeholderAttr`），导入 `ComponentAttr` 类型。

## 2. 为既有 18 个组件补齐 attrs

- [x] 2.1 为基础组（`u-button`/`u-icon`/`u-tag`/`u-badge`/`u-image`）补 attrs，对齐 uview-pro props。
- [x] 2.2 为表单组（`u-input`/`u-textarea`/`u-switch`/`u-radio`/`u-form-item`）补 attrs。
- [x] 2.3 为布局组（`u-cell-item`/`u-card`/`u-grid-item`/`uni-view`）补 attrs。
- [x] 2.4 为反馈组（`u-popup`/`u-empty`/`u-loadmore`）补 attrs。
- [x] 2.5 为导航组（`u-navbar`/`u-tabs`）补 attrs。

## 3. 新增「基础」分组组件

- [x] 3.1 添加 `u-text`、`u-link`、`u-divider`、`u-line`、`u-gap`。
- [x] 3.2 添加 `u-loading`、`u-mask`、`u-transition`、`u-avatar`。

## 4. 新增「表单」分组组件

- [x] 4.1 添加 `u-form`（demo 缺失项）、`u-checkbox`、`u-checkbox-group`、`u-radio-group`。
- [x] 4.2 添加 `u-picker`（demo 缺失项）、`u-select`（demo 缺失项）、`u-search`。
- [x] 4.3 添加 `u-number-box`、`u-rate`、`u-slider`、`u-field`。
- [x] 4.4 添加 `u-calendar`、`u-upload`、`u-keyboard`。

## 5. 新增「布局」分组组件

- [x] 5.1 添加 `u-grid`、`u-row`、`u-col`、`u-collapse`。
- [x] 5.2 添加 `u-sticky`、`u-cell-group`、`u-safe-bottom`、`u-status-bar`。

## 6. 新增「导航」分组组件

- [x] 6.1 添加 `u-tabbar`、`u-back-top`、`u-dropdown`。
- [x] 6.2 添加 `u-steps`、`u-pagination`、`u-subsection`、`u-index-list`。

## 7. 新增「反馈」分组组件

- [x] 7.1 添加 `u-modal`、`u-toast`、`u-action-sheet`。
- [x] 7.2 添加 `u-loading-popup`、`u-top-tips`、`u-alert-tips`、`u-no-network`、`u-full-screen`。

## 8. 新增「数据展示」分组（新分组）

- [x] 8.1 创建 `uview/数据展示` 分组，添加 `u-swiper`、`u-swipe-action`、`u-table`。
- [x] 8.2 添加 `u-circle-progress`、`u-line-progress`、`u-count-down`、`u-count-to`。
- [x] 8.3 添加 `u-skeleton`、`u-notice-bar`、`u-section`、`u-read-more`。
- [x] 8.4 添加 `u-time-line`、`u-lazy-load`、`u-fab`。

## 9. 构建与验证

- [x] 9.1 运行 `pnpm -C packages/uview build`，确认无 TS 报错。
- [x] 9.2 运行 `pnpm typecheck` 确认类型通过。
- [x] 9.3 运行 `pnpm lint` 确认 ESLint 通过。
- [ ] 9.4 启动 uni demo（由用户执行），验证六个分组均渲染、demo 缺失项可搜到并插入、属性选择抽屉显示新增属性。
- [x] 9.5 运行 `pnpm run prettier` 格式化改动代码。
