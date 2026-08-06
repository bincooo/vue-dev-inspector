## Purpose

CodeSetter 编辑器对多行属性值自动剥离公共前置缩进，编辑时顶格展示干净代码，保存时还原原始缩进保证源码正确。

## ADDED Requirements

### Requirement: 多行属性值编辑时剥离公共前置缩进

当 CodeSetter 接收到的 `entry.value` 包含多行文本时，系统 SHALL 自动检测所有非空行的公共前导空白（空格/Tab 序列），将其从每行开头剥离后再写入 Monaco 编辑器。用户在编辑器中看到的是从第一列开始的干净代码。

#### Scenario: 多行对象字面量属性

- **WHEN** 属性值为 `"{\\n      foo: 1,\\n      bar: 2,\\n    }"`（6 空格公共缩进）
- **THEN** Monaco 编辑器显示 `"{\\nfoo: 1,\\nbar: 2,\\n}"`，无前导空白

#### Scenario: 单行属性值无变化

- **WHEN** 属性值为 `"hello"`（单行，无公共缩进）
- **THEN** Monaco 编辑器显示 `"hello"`，与原值完全一致

#### Scenario: 属性值为空字符串

- **WHEN** 属性值为 `""`（空）
- **THEN** Monaco 编辑器显示 `""`，不报错

### Requirement: 保存时还原公共前置缩进

用户编辑完成后，系统 SHALL 将编辑器中的内容按行还原公共前置缩进后再写回 `entry.value`。每个非空行前补回原始公共缩进；空行保持空（不补空白）。

#### Scenario: 编辑后保存还原缩进

- **WHEN** 原始公共缩进为 6 空格，用户在编辑器中将内容改为 `"{\\nbaz: 3\\n}"`
- **THEN** 写回 `entry.value` 的内容为 `"{\\n      baz: 3\\n      }"`（每非空行前补 6 空格）

#### Scenario: 用户未修改直接保存

- **WHEN** 用户未做任何编辑直接触发保存
- **THEN** 写回 `entry.value` 的内容与原始值一致（strip + apply 是幂等往返）

### Requirement: 浮动窗口共享 model 无需额外处理

CodeSetter 的浮动编辑窗口（popout）与行内编辑器共享同一 Monaco model，系统 SHALL 确保缩进剥离逻辑仅在 model 创建时执行一次，popout 打开时直接读取已处理的 model 内容。

#### Scenario: popout 打开显示已剥离内容

- **WHEN** 行内编辑器已显示剥离缩进后的内容，用户点击齿轮按钮打开 popout
- **THEN** popout 中的编辑器显示与行内编辑器完全一致的内容，无重复剥离
