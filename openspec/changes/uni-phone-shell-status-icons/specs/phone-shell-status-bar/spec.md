## Purpose

phone-shell 虚拟 iPhone 状态栏假图标（时间、信号、wifi、电量），让开发者在 h5 dev 模式下获得更真实的手机外观预览。

## ADDED Requirements

### Requirement: 状态栏图标在 phoneShell 开启时渲染

当 `phoneShell` 选项启用时，虚拟 iPhone 外壳 SHALL 在顶部状态栏区域渲染假状态图标，包含时间、信号格、wifi 图标和电量图标。当 `phoneShell` 关闭时，状态栏图标 SHALL 完全不注入。

#### Scenario: phoneShell 开启时显示状态栏图标

- **WHEN** `phoneShell` 配置为 `true` 或 `{ width, height }` 且处于 h5 dev 模式
- **THEN** 页面顶部状态栏区域显示时间（左）、信号格 + wifi + 电量（右）四组假图标

#### Scenario: phoneShell 关闭时不显示状态栏图标

- **WHEN** `phoneShell` 配置为 `false` 或未设置
- **THEN** 页面中不注入任何状态栏图标 DOM 元素

### Requirement: 时间显示静态 "9:41"

状态栏左侧 SHALL 显示静态文本 "9:41"（Apple 发布会经典时间），不实时更新。

#### Scenario: 时间文本固定为 9:41

- **WHEN** 状态栏图标被渲染
- **THEN** 左侧时间区域显示 "9:41" 文本，不随系统时间变化

### Requirement: 图标按 phoneShell 宽度等比缩放

所有状态栏图标尺寸 SHALL 以 375px 基准宽度设计，按 `cfg.width / 375` 比例缩放，与 phone-shell 其他元素（notch、speaker、cam 等）使用相同的缩放逻辑。

#### Scenario: 自定义宽度时图标等比缩放

- **WHEN** `phoneShell: { width: 320 }` 配置自定义宽度
- **THEN** 状态栏图标尺寸按 `320 / 375` 比例缩小，与 notch、speaker 等元素保持视觉协调

### Requirement: 图标不随页面内容滚动

状态栏图标 SHALL 挂在 phone-shell frame 层（非 screen 滚动容器内），z-index 高于 screen 内容，不随页面滚动而移动。

#### Scenario: 页面滚动时状态栏图标固定不动

- **WHEN** 用户在 phone-shell screen 内滚动页面内容
- **THEN** 状态栏图标保持在顶部固定位置，不随内容滚动

### Requirement: 图标布局在 notch 两侧

时间 SHALL 定位在 notch 左侧，信号格 + wifi + 电量 SHALL 定位在 notch 右侧，与真实 iPhone X 系列状态栏布局一致。

#### Scenario: 时间在 notch 左侧

- **WHEN** 状态栏图标被渲染
- **THEN** 时间文本位于 notch 左侧区域，垂直居中于状态栏高度内

#### Scenario: 信号/wifi/电量在 notch 右侧

- **WHEN** 状态栏图标被渲染
- **THEN** 信号格、wifi 图标、电量图标从左到右依次排列在 notch 右侧区域，垂直居中于状态栏高度内

### Requirement: 图标颜色适配浅色背景

状态栏图标 SHALL 默认使用深色（黑色系），适配浅色 navbar 背景。

#### Scenario: 浅色 navbar 背景下图标可见

- **WHEN** navbar 背景为浅色（如白色）
- **THEN** 状态栏图标以深色显示，清晰可见
