## ADDED Requirements

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
