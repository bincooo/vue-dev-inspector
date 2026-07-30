## Purpose

从 ComponentConfig 的 `attrs` 元数据中读取当前选中元素对应组件的属性描述清单，在「编辑属性」面板中以右侧抽屉形式展示，用户点选即可将属性追加到编辑列表，避免手动记忆和输入属性名。


### Requirement: ComponentItem 支持属性描述元数据

`ComponentItem` 类型 SHALL 新增可选字段 `attrs`，类型为 `ComponentAttr[]`。每个 `ComponentAttr` MUST 包含 `name` 字段（属性名，如 `type`、`@click`、`:value`），SHALL 支持以下可选字段：`label`（人类可读标签）、`defaultValue`（默认值）、`options`（可选值枚举）、`group`（分组名）。未声明 `attrs` 的组件条目 SHALL 视为无属性描述。

#### Scenario: 组件配置中声明 attrs

- **WHEN** 物料包在 `ComponentItem` 上声明 `attrs: [{ name: "type", group: "属性", defaultValue: "primary" }]`
- **THEN** 该 attrs 数据随 `componentEntries` 序列化到 `window.__DEV_INSPECTOR_CFG__`，浏览器侧 overlay 可读取

#### Scenario: 未声明 attrs 的组件

- **WHEN** `ComponentItem` 未声明 `attrs` 字段
- **THEN** 该组件条目被正常处理，属性抽屉展示空提示

### Requirement: 属性按钮显示在编辑属性面板

「编辑属性」面板（prop panel）footer 区 SHALL 显示一个「📋 属性」按钮，位于「💾 保存」按钮左侧。该按钮在面板打开期间始终可见。

#### Scenario: 打开编辑属性面板

- **WHEN** 用户右键元素选择「编辑属性」或双击元素打开 prop panel
- **THEN** footer 区显示「📋 属性」按钮和「💾 保存」按钮

### Requirement: 点击属性按钮打开属性抽屉

点击「📋 属性」按钮 SHALL 从屏幕右侧滑入一个抽屉面板。抽屉 SHALL 覆盖在 prop panel 之上（z-index 高于 prop panel mask）。点击抽屉外遮罩区域 SHALL 关闭抽屉，prop panel 保持打开。抽屉打开期间 prop panel 仍可操作。

#### Scenario: 打开抽屉

- **WHEN** 用户点击「📋 属性」按钮
- **THEN** 右侧滑入属性抽屉，展示当前元素对应组件的属性描述清单

#### Scenario: 关闭抽屉

- **WHEN** 用户点击抽屉外遮罩区域或抽屉关闭按钮
- **THEN** 抽屉滑出并移除 DOM，prop panel 保持打开状态

### Requirement: 元素标签与组件配置匹配

抽屉打开时 SHALL 使用当前元素的展示标签（优先 `data-inspector-tag` 属性，回退 `tagName.toLowerCase()`）与 `state.componentEntries` 中各 entry 的 `groups[].items[].tag` 匹配。匹配到第一个 `tag` 相同的 item 后，取其 `attrs` 作为属性清单。未匹配到时 SHALL 展示空提示「无可用属性描述」。

#### Scenario: 匹配到组件配置

- **WHEN** 用户选中 `<a-button>` 元素并打开属性抽屉，且 antdv 物料包声明了 `tag: "a-button"` 的 `attrs`
- **THEN** 抽屉展示该 item 声明的属性清单

#### Scenario: 未匹配到组件配置

- **WHEN** 用户选中 `<div>` 元素并打开属性抽屉，且无任何 ComponentItem 的 `tag` 为 `div`
- **THEN** 抽屉展示「无可用属性描述」空提示

### Requirement: 属性按分组渲染

抽屉 SHALL 按 `ComponentAttr.group` 字段对属性分组渲染，每组显示分组标题。未声明 `group` 的属性 SHALL 归入「其它」分组。抽屉 SHALL 提供搜索框，输入关键词时按 `name` 或 `label` 过滤属性。

#### Scenario: 分组展示

- **WHEN** 属性清单包含 `group: "属性"` 和 `group: "事件"` 的条目
- **THEN** 抽屉按分组渲染，分别显示「属性」和「事件」分组标题及对应属性条目

#### Scenario: 搜索过滤

- **WHEN** 用户在搜索框输入「click」
- **THEN** 仅显示 `name` 或 `label` 包含「click」的属性条目

### Requirement: 点击属性追加到编辑列表

点击抽屉中的某条属性 SHALL 立即将其追加到 prop panel 的 `entries` 列表中，值为 `defaultValue`（未声明则为空字符串）。追加后抽屉 SHALL 保持打开。若该属性名已存在于 `entries` 中，SHALL 跳过不重复添加。

#### Scenario: 添加新属性

- **WHEN** 用户点击 `type` 属性条目（`defaultValue: "primary"`），且 `entries` 中无 `type`
- **THEN** `entries` 追加 `{ key: "type", value: "primary" }`，prop panel 属性行列表刷新，抽屉保持打开

#### Scenario: 属性已存在

- **WHEN** 用户点击 `type` 属性条目，且 `entries` 中已存在 `key: "type"`
- **THEN** 不重复添加，`entries` 列表不变

### Requirement: 有 options 的属性值用下拉选择

当某属性的 `ComponentAttr.options` 非空时，prop panel 中该属性的值控件 SHALL 渲染为 `<select>` 下拉，选项为 `options` 数组。无 `options` 或未匹配到 `ComponentAttr` 时 SHALL 渲染为文本输入框。属性名变化时 SHALL 根据新 key 重新匹配并动态切换控件类型。

#### Scenario: 有 options 的属性渲染为下拉

- **WHEN** `type` 属性声明了 `options: ["primary","default","dashed","link","text"]`，用户从抽屉点击 `type` 添加到编辑列表
- **THEN** prop panel 中 `type` 行的值控件为 `<select>` 下拉，包含「（选择值）」空选项及全部 options 值

#### Scenario: 无 options 的属性渲染为文本框

- **WHEN** `@click` 属性未声明 `options`，用户从抽屉点击 `@click` 添加到编辑列表
- **THEN** prop panel 中 `@click` 行的值控件为 `<input>` 文本框

#### Scenario: 手动输入属性名时动态切换

- **WHEN** 用户在添加行输入属性名 `type`（匹配到有 options 的 ComponentAttr）
- **THEN** 值控件从文本框切换为 `<select>` 下拉


### Requirement: 已添加属性显示视觉标记

抽屉渲染属性条目时 SHALL 检查每条属性的 `name` 是否已存在于 prop panel 的 `entries` 列表（按 `key` 匹配）。已存在的属性条目 SHALL 在行右侧显示 ✓ 标记，未存在的条目 SHALL NOT 显示标记。标记 SHALL 在以下时机同步更新：抽屉打开时、搜索过滤时、抽屉内点击添加属性后。prop panel 侧的 entries 变化（手动添加/删除/编辑 key）SHALL NOT 触发抽屉标记的实时更新；标记状态在下次抽屉 render（搜索或重新打开）时自然同步。

#### Scenario: 打开抽屉时标记已添加属性

- **WHEN** 用户已通过 prop panel 手动添加了 `type` 属性，随后打开属性抽屉
- **THEN** `type` 条目右侧显示 ✓ 标记，未添加的属性无标记

#### Scenario: 抽屉内点击添加后即时标记

- **WHEN** 用户在抽屉中点击 `size` 属性（此前未添加）
- **THEN** `size` 被追加到 entries，该行右侧立即显示 ✓ 标记

#### Scenario: 搜索过滤时保留标记

- **WHEN** 用户在搜索框输入关键词过滤属性列表
- **THEN** 过滤后显示的属性条目中，已存在于 entries 的条目仍显示 ✓ 标记

#### Scenario: 点击已标记的属性无操作

- **WHEN** 用户点击已显示 ✓ 标记的属性条目
- **THEN** 不重复添加，entries 列表不变，✓ 标记保持不变

#### Scenario: prop panel 侧变化不实时同步

- **WHEN** 用户在 prop panel 删除某属性或手动添加同名属性，抽屉保持打开
- **THEN** 抽屉中对应条目的 ✓ 标记状态不立即变化，下次搜索或重新打开抽屉时同步

#### Scenario: 关闭再打开抽屉重新同步

- **WHEN** 用户关闭抽屉后再次打开
- **THEN** ✓ 标记根据当前 entries 的实际状态重新计算
