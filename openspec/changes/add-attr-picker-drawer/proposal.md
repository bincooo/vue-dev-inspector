## Why

「编辑属性」面板目前只能手动输入属性名和值。对于第三方组件库（如 antdv 的 `a-button`），用户需要记住 `type`/`size`/`@click` 等属性名并逐字敲入，体验差且易出错。ComponentConfig 已经按 tag 描述了可插入的组件，但缺少「该组件支持哪些属性」的元数据。将这些属性描述暴露到 UI 上，让用户从预定义清单中点选即可添加，能显著降低属性编辑的门槛。

## What Changes

- 在 `ComponentItem`（`shared/src/componentConfig.ts`）上新增可选字段 `attrs?: ComponentAttr[]`，描述单个组件支持的属性/事件/插槽。
- 新增 `ComponentAttr` 类型：`name`（属性名，如 `type`/`@click`/`:value`）+ 可选 `label`/`defaultValue`/`options`/`group`。
- 在 overlay 的「编辑属性」面板（`prop-panel.ts`）footer 区新增「📋 属性」按钮。
- 点击按钮弹出右侧抽屉（`attr-drawer.ts` 新模块），展示当前选中元素对应组件的属性描述清单，按 `group` 分组渲染，带搜索框。
- 点击抽屉中的某条属性，立即将其追加到 prop panel 的 entries 列表（带 `defaultValue` 或空值），抽屉保持打开以便连续添加；已存在的属性不重复添加。
- 未匹配到组件配置时（原生 HTML 元素或未声明 `attrs` 的组件），按钮仍可见，抽屉展示空提示「无可用属性描述」。
- antdv 物料包（`packages/antdv/src/index.ts`）为 `a-button` 等条目补充 `attrs` 示例数据，作为首批可用属性清单。

## Capabilities

### New Capabilities
- `attr-picker-drawer`: 属性选择抽屉 -- 从 ComponentConfig 的 `attrs` 元数据中读取当前组件支持的属性描述，在「编辑属性」面板中以右侧抽屉形式展示，用户点选即可将属性追加到编辑列表。

### Modified Capabilities
<!-- 无已有 spec 被修改 -->

## Impact

- **`@vue-dev-inspector/shared`**：`componentConfig.ts` 新增 `ComponentAttr` 接口 + `ComponentItem.attrs` 字段。类型扩展，向后兼容（字段可选）。
- **`@vue-dev-inspector/overlay`**：新增 `attr-drawer.ts` 模块；`prop-panel.ts` 新增「属性」按钮 + 抽屉打开逻辑；`overlay.css` 新增抽屉样式；`state.ts` 新增 `attrDrawer` 状态字段。
- **`@vue-dev-inspector/antdv`**：`index.ts` 为现有组件条目补充 `attrs` 数据。
- **配置流转**：`attrs` 随 `componentEntries` 经 `buildCfgJson`（pluginkit）序列化到 `window.__DEV_INSPECTOR_CFG__.componentEntries`，无需额外配置通道。`expand` 字段剥离逻辑不受影响（`attrs` 是纯数据，不涉及脚本注入）。
- **服务端**：无 REST API 变更，`attrs` 数据完全在浏览器端消费。
- **构建**：shared 类型变更后需按序重建 `shared -> pluginkit -> overlay/client -> core/uni -> antdv`。
