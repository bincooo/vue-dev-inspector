## Purpose

让通过属性编辑面板读写的属性值在含引号（`"` / `'`）或 HTML 实体时，写回 SFC 源码后模板语法不损坏，且回读编辑框显示与用户原始输入一致（往返保真）。

## ADDED Requirements

### Requirement: 写属性值时按内容选择引号包裹

服务端在把编辑框提交的属性值拼回 SFC 模板属性时，SHALL 按值内容选择包裹引号与转义策略，保证写盘后的模板属性语法合法、不被值内引号提前闭合：

- 值不含 `"`：用双引号包裹（`k="v"`），不转义任何字符。
- 值含 `"` 但不含 `'`：用单引号包裹（`k='v'`），不转义。
- 值同时含 `"` 和 `'`：用双引号包裹，并把值内所有 `"` 转成 `&quot;`（`k="a&quot;b'c"`），Vue 模板属性解析后等价于裸 `"`。

空值属性（`value === ''`）SHALL 仍渲染为无值布尔属性（`k`），不进入引号选择逻辑。

#### Scenario: 值含双引号不含单引号

- **WHEN** 用户在属性面板把 `:options` 的值编辑为 `getDictOptions("wms_stock_in_order_status")` 并保存
- **THEN** 写盘后 SFC 源码该属性为 `:options='getDictOptions("wms_stock_in_order_status")'`（单引号包裹，值内双引号原样保留），模板语法合法，Vue 编译器不报错

#### Scenario: 值同时含双引号和单引号

- **WHEN** 用户把 `:options` 的值编辑为 `fn("a",'b')` 并保存
- **THEN** 写盘后 SFC 源码该属性为 `:options="fn(&quot;a&quot;,'b')"`（双引号包裹，值内双引号转成 `&quot;`，单引号原样保留），模板语法合法，Vue 编译器不报错

#### Scenario: 值不含双引号

- **WHEN** 用户把 `:options` 的值编辑为 `getDictOptions('wms')` 并保存
- **THEN** 写盘后 SFC 源码该属性为 `:options="getDictOptions('wms')"`（双引号包裹，值原样保留），与既有写法一致，最小 diff

#### Scenario: 空值属性保持布尔形态

- **WHEN** 用户把某属性的值清空（提交 `value === ''`）并保存
- **THEN** 写盘后 SFC 源码该属性渲染为无值布尔属性（`disabled`），不附加 `=""`

### Requirement: 属性值往返保真

属性编辑面板读出的值经用户编辑后写回，再读出，SHALL 与用户编辑后的裸值一致，不因引号包裹或实体转义而改变可见内容。读取端依赖 `@vue/compiler-core` 在解析阶段对 `&quot;` / `&apos;` / `&amp;` 等 HTML 实体解码进表达式或属性值的 `content`，使编辑框天然显示裸值。

#### Scenario: 单引号包裹的含双引号值回读

- **WHEN** SFC 源码中属性为 `:options='getDictOptions("wms")'`，用户打开属性面板
- **THEN** 编辑框显示的值为 `getDictOptions("wms")`（裸双引号，非 `&quot;`），与写回时的原始输入一致

#### Scenario: 双引号包裹且实体转义的值回读

- **WHEN** SFC 源码中属性为 `:options="fn(&quot;a&quot;,'b')"`，用户打开属性面板
- **THEN** 编辑框显示的值为 `fn("a",'b')`（`&quot;` 解码回裸双引号），与写回时的原始输入一致

#### Scenario: 静态属性含 HTML 实体回读

- **WHEN** SFC 源码中静态属性为 `label="a&quot;b"`，用户打开属性面板
- **THEN** 编辑框显示的值为 `a"b`（`&quot;` 解码回裸双引号），与用户原始输入一致
