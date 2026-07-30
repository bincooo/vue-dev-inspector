## Purpose

定义 `@vue-dev-inspector/antdv` 物料库组件目录的覆盖范围、分组结构与单组件属性元数据约定，使 overlay 的组件插入抽屉与属性选择抽屉能覆盖 antdv-next 常用组件。


### Requirement: 组件目录按官方分类覆盖常用组件

目录 SHALL 按 antdv 官方分类将组件归入以下分组：`antdv/通用`、`antdv/布局`、`antdv/导航`、`antdv/表单`、`antdv/反馈`、`antdv/数据展示`。每个分组 SHALL 至少包含该分类下常用组件的一个条目。目录 SHALL 覆盖 antdv-next 暴露的常用组件，且 SHALL 包含 demo 已使用但此前缺失的组件（`a-drawer`、`a-modal`、`a-radio-group`、`a-typography-text`）。

#### Scenario: demo 使用的组件均可在抽屉中找到
- **WHEN** 用户在组件插入抽屉中搜索 demo 已使用的任一 antdv 组件 tag
- **THEN** 该组件出现在对应分类分组中，可被点击插入

#### Scenario: 分类分组完整
- **WHEN** overlay 渲染 antdv 物料库的分组列表
- **THEN** 列表包含「通用」「布局」「导航」「表单」「反馈」「数据展示」六个分组，且每个分组非空

### Requirement: 每个组件条目声明完整元数据

每个 `ComponentItem` SHALL 声明 `tag`、`label`、`icon`、`snippet`、`attrs` 五个字段。antdv 组件通过 `app.use(Antd)` 全局注册，无需声明 `imports` 字段。

#### Scenario: 组件条目字段完整
- **WHEN** 检查目录中任一组件条目
- **THEN** 该条目包含 tag（`a-` 前缀 kebab-case）、label（中文名 + 英文名）、icon（iconify 短串）、snippet（合法 Vue 模板片段）、attrs（属性数组）

### Requirement: 属性元数据遵循命名与分组约定

`attrs` 数组中每条 `ComponentAttr` SHALL 归入 `group: "属性"` 或 `group: "事件"`。事件属性 SHALL 以 `@` 前缀命名（如 `@change`、`@click`）。双向绑定属性 SHALL 以 `v-model:` 前缀命名（如 `v-model:value`、`v-model:checked`）。布尔类型属性 SHALL 提供 `options: ["true", "false"]` 与 `defaultValue`。枚举类型属性 SHALL 提供 `options` 列表。

#### Scenario: 事件属性命名
- **WHEN** 检查任一组件的 attrs 中标记为 `group: "事件"` 的条目
- **THEN** 其 `name` 以 `@` 开头

#### Scenario: 布尔属性提供枚举
- **WHEN** 检查任一布尔语义的属性（如 disabled、loading、closable）
- **THEN** 该属性提供 `options: ["true", "false"]` 并声明 `defaultValue`

### Requirement: snippet 为合法自包含模板片段

每个 `snippet` SHALL 是可被服务端 AST 原样写入 `.vue` 模板的合法 Vue 模板片段，SHALL 自包含（不依赖外部变量绑定即可渲染预览），对于需要子内容的组件 SHALL 包含占位子节点。

#### Scenario: 自闭合组件 snippet
- **WHEN** 检查 `a-switch` 等自闭合组件的 snippet
- **THEN** snippet 为 `<a-switch />` 形式，无未闭合标签

#### Scenario: 需子内容的组件 snippet 含占位
- **WHEN** 检查 `a-card` 等需子内容的组件的 snippet
- **THEN** snippet 包含占位子节点（如 `<p>内容</p>`），插入后可正常渲染
