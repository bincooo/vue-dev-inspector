## Purpose

修复 portal 组件（modal/drawer）内部元素的选中逻辑，让用户可以选中 modal/drawer 内部的组件。

## Requirements

### Requirement: 内部组件可选中
当用户点击 modal/drawer 内部有 `data-source-file` 属性的组件时，系统 SHALL 返回该组件而不是 portal 根。

#### Scenario: 点击内部组件
- **WHEN** 用户点击 `<a-modal>` 内部的 `<a-input>`（有 `data-source-file` 属性）
- **THEN** 返回 `<a-input>` 元素，用户可以选中并编辑该组件

### Requirement: 纯文本元素回退到 portal 根
当用户点击 modal/drawer 内部没有 `data-source-file` 属性的纯文本元素时，系统 SHALL 返回 portal 根。

#### Scenario: 点击纯文本
- **WHEN** 用户点击 `<a-modal>` 内部的 `<p>` 元素（无 `data-source-file` 属性）
- **THEN** 返回 `<a-modal>` 元素（portal 根）

### Requirement: portal 根 class 解码保持不变
系统 SHALL 继续对 portal 根的 `__vdi-src-` class token 进行解码，并写回 `data-source-file` 属性。

#### Scenario: portal 根属性写回
- **WHEN** 遇到带 `__vdi-src-` class token 的 portal 根
- **THEN** 解码 class token 并写回 `data-source-file` 和 `data-inspector-tag` 属性
