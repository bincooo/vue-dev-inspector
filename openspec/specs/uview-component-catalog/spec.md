## Purpose

定义 `@vue-dev-inspector/uview` 物料库组件目录的覆盖范围、分组结构与单组件属性元数据约定，使 overlay 的组件插入抽屉与属性选择抽屉能覆盖 uview-pro 常用组件并提供属性提示。


### Requirement: 组件目录按分类覆盖常用组件

目录 SHALL 按以下分组组织：`uview/基础`、`uview/表单`、`uview/布局`、`uview/导航`、`uview/反馈`、`uview/数据展示`。目录 SHALL 覆盖 uview-pro 暴露的常用组件，且 SHALL 包含 demo 已使用但此前缺失的组件（`u-form`、`u-picker`、`u-select`）。

#### Scenario: demo 使用的组件均可在抽屉中找到
- **WHEN** 用户在组件插入抽屉中搜索 demo 已使用的任一 uview 组件 tag
- **THEN** 该组件出现在对应分类分组中，可被点击插入

#### Scenario: 分类分组完整
- **WHEN** overlay 渲染 uview 物料库的分组列表
- **THEN** 列表包含「基础」「表单」「布局」「导航」「反馈」「数据展示」六个分组，且每个分组非空

### Requirement: 每个组件条目声明完整元数据

每个 `ComponentItem` SHALL 声明 `tag`、`label`、`icon`、`snippet`、`attrs` 五个字段。uview 组件通过 easycom 自动引入，无需声明 `imports`。

#### Scenario: 组件条目字段完整
- **WHEN** 检查目录中任一组件条目
- **THEN** 该条目包含 tag（`u-` 前缀 kebab-case）、label（中文名 + 英文名）、icon（iconify 短串）、snippet（合法 Vue 模板片段）、attrs（属性数组）

### Requirement: 属性元数据遵循命名与分组约定

`attrs` 数组中每条 `ComponentAttr` SHALL 归入 `group: "属性"` 或 `group: "事件"`。事件属性 SHALL 以 `@` 前缀命名（如 `@change`、`@click`）。双向绑定属性 SHALL 以 `v-model` 前缀命名（uview 组件普遍使用 `v-model` 而非 `v-model:value`）。布尔类型属性 SHALL 提供 `options: ["true", "false"]` 与 `defaultValue`。枚举类型属性 SHALL 提供 `options` 列表。

#### Scenario: 事件属性命名
- **WHEN** 检查任一组件的 attrs 中标记为 `group: "事件"` 的条目
- **THEN** 其 `name` 以 `@` 开头

#### Scenario: 布尔属性提供枚举
- **WHEN** 检查任一布尔语义的属性（如 disabled、loading）
- **THEN** 该属性提供 `options: ["true", "false"]` 并声明 `defaultValue`

### Requirement: snippet 为合法自包含模板片段

每个 `snippet` SHALL 是可被服务端 AST 原样写入 `.vue` 模板的合法 Vue 模板片段，SHALL 自包含。对于需要子内容的组件 SHALL 包含占位子节点（如 `<view>内容</view>`）。

#### Scenario: 自闭合组件 snippet
- **WHEN** 检查 `u-switch` 等自闭合组件的 snippet
- **THEN** snippet 为 `<u-switch />` 形式，无未闭合标签

#### Scenario: 需子内容的组件 snippet 含占位
- **WHEN** 检查 `u-card` 等需子内容的组件的 snippet
- **THEN** snippet 包含占位子节点（如 `<view>内容</view>`），插入后可正常渲染
