## Purpose

定义「编辑属性」面板中值控件（setter）的注册体系、推断规则与 BoolSetter 的 Switch 交互行为，确保 setter 可独立扩展且布尔值的交互符合开关直觉。


### Requirement: setter 注册表与推断规则

面板 SHALL 维护一个 setter 注册表，每个 setter 声明 `icon`、`label` 与 `build` 工厂函数。面板 SHALL 根据属性的 `ComponentAttr.setter` 声明或自动推断确定可用 setter 列表：始终包含文本与代码 setter；有 `options` 时追加下拉选择 setter；`options` 为 `["true","false"]` 或当前值为 `"true"`/`"false"` 时追加布尔 setter。显式声明 `attr.setter` 时 SHALL 跳过推断，直接使用声明列表。

#### Scenario: 显式声明 setter 时跳过推断
- **WHEN** 属性的 `ComponentAttr.setter` 字段声明了 `["BoolSetter"]`
- **THEN** 可用 setter 列表仅包含 `BoolSetter`，不追加推断结果

#### Scenario: 布尔属性自动追加 BoolSetter
- **WHEN** 属性未声明 `setter`，且 `options` 为 `["true","false"]`
- **THEN** 可用 setter 列表包含 TextSetter、CodeSetter、SelectSetter、BoolSetter

### Requirement: setter 默认值推断

面板 SHALL 根据属性特征推断默认 setter：属性名以 `:`/`@`/`v-model` 开头时默认 CodeSetter；当前值为 `"true"`/`"false"` 时默认 BoolSetter；有 `options` 时默认 SelectSetter；否则默认 TextSetter。

#### Scenario: 布尔值默认使用 BoolSetter
- **WHEN** 属性当前值为 `"true"`，且未声明 `setter`
- **THEN** 面板默认使用 BoolSetter 渲染值控件

### Requirement: BoolSetter 使用 Switch 拨动控件

BoolSetter SHALL 以 Switch 拨动控件（滑轨 + 圆形拨钮）呈现，而非文本按钮。拨钮处于"开"位置时表示值 `"true"`，处于"关"位置时表示值 `"false"`。点击 Switch SHALL 切换值。值仍以字符串 `"true"`/`"false"` 存储，不改变 `PropEntry.value` 的字符串类型。

#### Scenario: Switch 显示当前布尔值
- **WHEN** 属性值为 `"true"`
- **THEN** Switch 拨钮处于"开"位置，滑轨高亮

#### Scenario: 点击 Switch 切换值
- **WHEN** 用户点击处于"关"状态的 Switch
- **THEN** 属性值变为 `"true"`，拨钮滑到"开"位置，滑轨高亮

#### Scenario: 在 setter 间切换后再切回 BoolSetter
- **WHEN** 用户从 BoolSetter 切换到 TextSetter 编辑值，再切回 BoolSetter
- **THEN** Switch 正确反映当前值（若值为 `"true"` 则显示"开"，否则"关"）

### Requirement: 每个 setter 独立模块

每个内置 setter（TextSetter、CodeSetter、SelectSetter、BoolSetter）SHALL 位于 `packages/overlay/src/setters/` 目录下的独立文件中。setter 注册表与推断函数 SHALL 从 `setters/index.ts` 统一导出。`prop-panel.ts` SHALL 从 `./setters` 导入注册表与推断函数，不再内联定义 setter。

#### Scenario: 新增 setter 只需添加新文件并注册
- **WHEN** 开发者添加第 5 个 setter
- **THEN** 只需在 `setters/` 目录新增文件并在 `setters/index.ts` 注册表中追加条目，无需修改 `prop-panel.ts`
### Requirement: CodeSetter 弹出浮动编辑窗口

CodeSetter 的行内编辑器右上角 SHALL 显示一个齿轮按钮。点击齿轮按钮 SHALL 打开一个浮动窗口，窗口内包含一个比行内编辑器更大尺寸的 Monaco 编辑器。浮动窗口 SHALL 与行内编辑器共享同一个 Monaco `ITextModel`，双方内容实时同步。关闭浮动窗口时 SHALL 仅释放浮动 editor 实例，不释放共享 model。齿轮按钮在 Monaco 编辑器加载失败时 SHALL 不显示。

#### Scenario: 点击齿轮打开浮动窗口
- **WHEN** 用户点击 CodeSetter 行内编辑器右上角的齿轮按钮
- **THEN** 弹出一个居中浮动窗口，内含大尺寸 Monaco 编辑器，内容与行内编辑器一致

#### Scenario: 浮动窗口与行内编辑器实时同步
- **WHEN** 用户在浮动窗口中编辑代码
- **THEN** 行内编辑器同步显示相同内容（共享 model），`entry.value` 同步更新

#### Scenario: 关闭浮动窗口后行内编辑器继续可用
- **WHEN** 用户点击关闭按钮或遮罩关闭浮动窗口
- **THEN** 浮动 editor 实例被释放，行内编辑器继续正常工作，内容保持最终编辑结果

#### Scenario: Monaco 加载失败时不显示齿轮
- **WHEN** Monaco 编辑器加载失败
- **THEN** 行内编辑器区域显示错误提示，齿轮按钮不显示

