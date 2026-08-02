## Context

phone-shell（`packages/uni/src/phone-shell.ts`）当前生成的虚拟 iPhone 外壳包含 speaker、cam、notch、screen、home bar 五个 DOM 元素，全部挂在 `frame` 内。notch 居中（`z-index:55`），screen 是滚动容器（`z-index:50`），speaker/cam 在 notch 同层之上（`z-index:56`）。

状态栏区域（notch 所在的顶部条带）目前完全空白。真实 iPhone X 系列在 notch 两侧显示时间（左）和信号/wifi/电量（右）。本设计在该区域注入假图标，提升 dev 预览真实感。

所有尺寸经 `buildCss(cfg)` 的 `px()` 函数按 `cfg.width / 375` 缩放。DOM 在 `buildPhoneShellScript(cfg)` 的 IIFE 中通过 `frame.innerHTML` 一次性注入。

## Goals / Non-Goals

**Goals:**

- 在 phone-shell frame 层注入时间、信号格、wifi、电量四组假图标
- 图标缩放、定位与现有 phone-shell 元素一致
- 纯 CSS + inline SVG，不引入外部资源或依赖

**Non-Goals:**

- 实时更新时间（静态 "9:41" 即可）
- 根据 navbar 背景色自动切换图标深浅色（后续可扩展）
- 真实电量/信号状态读取（纯假数据）
- 非 phoneShell 模式下的状态栏模拟

## Decisions

### D1: 图标挂在 frame 层，而非 screen 内

**选择**：将状态栏图标 DOM 作为 frame 的子元素（与 speaker/cam/notch 同级），`z-index:56`。

**理由**：screen 是 `overflow-y:auto` 滚动容器，放进去会随页面滚动。frame 是固定容器（`transform:translateZ(0)` 建立 containing block），图标挂在这里不随内容滚动，与真实 iPhone 行为一致。

**备选**：放 screen 内用 `position:fixed` --但 screen 的 transform 会使 fixed 以 screen 为包含块，已知的 navbar 滚动 bug 就是这么来的（见 phone-shell-fixed-containment 记忆），不重复踩坑。

### D2: 图标用纯 CSS + inline SVG 绘制

**选择**：
- 时间：`<span>` 文本 "9:41"
- 信号格：4 个 `<div>` 递增高度，CSS 背景
- wifi：inline SVG 弧线
- 电量：`<div>` 外壳 + `<div>` 内填充 + `<div>` 头部凸起

**理由**：phone-shell IIFE 是字符串拼接，不能依赖任何运行时模块或外部资源。inline SVG 嵌入 innerHTML 字符串即可，无需额外请求。

**备选**：用 emoji/Unicode 符号（📶🔋）--不同平台渲染不一致，无法精确控制尺寸和位置。

### D3: 时间在 notch 左侧，其余在 notch 右侧

**选择**：
- 时间容器 `position:absolute; left:0; right:50%+notchHalfWidth; text-align:right; padding-right:gap`
- 图标容器 `position:absolute; left:50%+notchHalfWidth; right:0; display:flex; justify-content:flex-end; padding-left:gap`

**理由**：与真实 iPhone X 布局一致。notch 宽度 140px（基准），两侧各有约 `(375-140)/2 = 117.5px` 可用空间。

**备选**：时间左对齐到屏幕边缘 --真实 iPhone 时间右侧贴近 notch，不是贴屏幕边。

### D4: 布局常量新增到模块顶部常量区

**选择**：在 `phone-shell.ts` 的常量区新增状态栏相关常量（如 `STATUS_BAR_H`、`STATUS_TIME_FS`、`STATUS_TIME_RIGHT`、`STATUS_ICONS_LEFT`、`STATUS_ICONS_RIGHT` 等），经 `px()` 缩放后写入 CSS。

**理由**：与现有 speaker/cam/notch 常量风格一致，所有尺寸可追溯。

### D5: DOM 注入合并到现有 frame.innerHTML

**选择**：在 `buildPhoneShellScript()` 的 `frame.innerHTML` 字符串中追加状态栏 DOM，不新增单独的 `createElement` 调用。

**理由**：speaker/cam/notch/screen/bar 已经通过 `frame.innerHTML` 一次性注入，状态栏图标作为同层元素追加进去最简洁，保持代码一致性。

## Risks / Trade-offs

- **[notch 两侧空间不足]** 自定义窄宽度（如 320px）时 notch 两侧空间缩小到约 90px，时间文字和图标可能拥挤 -> 缩放比例已等比缩小文字和图标尺寸，280px 以上宽度可正常显示；极端窄宽度可接受降级。

- **[深色 navbar 不可见]** 图标默认黑色，若 app 使用深色 navbar 则不可见 -> Non-goal，后续可加 `data-vdi-phone-shell` 上的 CSS 变量控制颜色。

- **[CSS 字符串体积增大]** 新增约 15 条 CSS 规则 + SVG 字符串 -> 总量仍在单行 CSS 拼接的可控范围内，对 IIFE 注入性能无实际影响。
