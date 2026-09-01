## Purpose

为编辑代码抽屉中的 Script、CSS、子节点三个编辑区提供最大化/还原切换功能，让用户在专注编辑某个块时获得更大的代码编辑面积。

## ADDED Requirements

### Requirement: 最大化按钮显示
每个块面板（Script / CSS / 子节点）的标题栏右上角 SHALL 显示一个最大化按钮（⛶ 图标）。

#### Scenario: 初始状态
- **WHEN** 打开编辑代码抽屉
- **THEN** 每个块面板的标题栏右上角显示 ⛶ 最大化按钮

### Requirement: 点击最大化隐藏其他面板
点击某个块面板的最大化按钮后，系统 SHALL 隐藏其他两个块面板，当前面板占据抽屉 body 全部高度。

#### Scenario: 最大化 Script 面板
- **WHEN** 用户点击 Script 面板的最大化按钮
- **THEN** CSS 面板和子节点面板被隐藏（display: none），Script 面板占据全部高度

#### Scenario: 最大化 CSS 面板
- **WHEN** 用户点击 CSS 面板的最大化按钮
- **THEN** Script 面板和子节点面板被隐藏，CSS 面板占据全部高度

#### Scenario: 最大化子节点面板
- **WHEN** 用户点击子节点面板的最大化按钮
- **THEN** Script 面板和 CSS 面板被隐藏，子节点面板占据全部高度

### Requirement: 还原按钮显示
当某个面板处于最大化状态时，其最大化按钮 SHALL 变为还原按钮（⤡ 图标）。

#### Scenario: 最大化状态下的按钮
- **WHEN** 某个面板已最大化
- **THEN** 该面板标题栏显示 ⤡ 还原按钮（替代原 ⛶ 最大化按钮）

### Requirement: 点击还原恢复分屏布局
点击还原按钮后，系统 SHALL 恢复三个面板的原始分屏布局。

#### Scenario: 还原面板
- **WHEN** 用户点击还原按钮
- **THEN** 三个面板恢复原始分屏布局（Script/CSS 上下分屏 + 子节点在下方）

### Requirement: 关闭抽屉自动还原
关闭抽屉时，系统 SHALL 自动还原任何最大化状态。

#### Scenario: 关闭抽屉
- **WHEN** 用户关闭编辑代码抽屉
- **THEN** 最大化状态被清除，下次打开抽屉时三个面板显示为默认分屏布局

### Requirement: 同一时间仅一个面板可最大化
系统 SHALL 确保同一时间最多只有一个面板处于最大化状态。

#### Scenario: 切换最大化面板
- **WHEN** Script 面板已最大化，用户点击 CSS 面板的最大化按钮
- **THEN** Script 面板自动还原，CSS 面板成为新的最大化面板
