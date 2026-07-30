## 1. Shared 类型扩展

- [x] 1.1 在 `packages/shared/src/componentConfig.ts` 中新增 `ComponentAttr` 接口（`name` 必填，`label`/`defaultValue`/`options`/`group` 可选）
- [x] 1.2 在 `ComponentItem` 上新增可选字段 `attrs?: ComponentAttr[]`
- [x] 1.3 运行 `pnpm -C packages/shared build` 重建 shared 包

## 2. Overlay 状态扩展

- [x] 2.1 在 `packages/overlay/src/state.ts` 中新增 `attrDrawer: null as HTMLDivElement | null` 字段

## 3. 属性抽屉模块

- [x] 3.1 新建 `packages/overlay/src/attr-drawer.ts`，实现 `openAttrDrawer()` / `closeAttrDrawer()` 导出函数
- [x] 3.2 `openAttrDrawer()` 中：创建遮罩（z-index 10000）+ 抽屉容器（z-index 10001，右侧滑入动画），遮罩点击关闭
- [x] 3.3 使用 `getElementTagName(el)` 匹配 `state.componentEntries` 中各 entry 的 `groups[].items[].tag`（两侧 `toLowerCase()`），取首个匹配 item 的 `attrs`
- [x] 3.4 渲染搜索框 + 按分组（`group` 字段，缺省归「其它」）渲染属性条目列表
- [x] 3.5 点击属性条目：若 `entries` 中无同 `key` 则 push `{key: name, value: defaultValue ?? ""}` 并刷新 prop panel 的 `renderList`，抽屉保持打开
- [x] 3.6 未匹配到组件配置或 `attrs` 为空时展示「无可用属性描述」空提示

## 4. Prop Panel 集成

- [x] 4.1 在 `packages/overlay/src/prop-panel.ts` 的 footer 中新增「📋 属性」按钮，位于「💾 保存」按钮左侧
- [x] 4.2 按钮点击调用 `openAttrDrawer()`
- [x] 4.3 在 `closePanel()` 中调用 `closeAttrDrawer()` 确保关闭 prop panel 时连带关闭抽屉

## 5. 样式

- [x] 5.1 在 `packages/overlay/src/overlay.css` 中新增 `__vdi-attr-drawer`、`__vdi-attr-drawer-header`、`__vdi-attr-drawer-body`、`__vdi-attr-drawer-group`、`__vdi-attr-drawer-item`、`__vdi-attr-drawer-search`、`__vdi-attr-drawer-empty`、`__vdi-attr-backdrop` 等样式（固定宽度 360px，z-index 10000/10001）
- [x] 5.2 属性条目 hover 高亮样式

## 6. antdv 物料包数据补充

- [x] 6.1 在 `packages/antdv/src/index.ts` 中为 `a-button` 补充 `attrs`（type/size/loading/disabled/@click/@focus 等）
- [x] 6.2 为 `a-input`、`a-select`、`a-tag` 等主要组件补充 `attrs` 示例数据
- [x] 6.3 运行 `pnpm -C packages/antdv build` 重建 antdv 包

## 7. 构建与验证

- [x] 7.1 按序重建 `shared -> pluginkit -> overlay -> client -> core`
- [x] 7.2 重建 antdv 包
- [x] 7.3 启动 PC demo（`pnpm dev:pc`）验证：右键 antdv 组件 -> 编辑属性 -> 点击「属性」按钮 -> 抽屉展示属性清单 -> 点选属性追加到列表 -> 保存
- [x] 7.4 验证原生 HTML 元素（如 `<div>`）打开抽屉展示空提示
- [x] 7.5 验证关闭 prop panel 时抽屉连带关闭
- [x] 7.6 运行 `pnpm typecheck` 确保类型安全
- [x] 7.7 运行 `pnpm run prettier` 格式化修改的代码
