## 1. contextmenu 拦截补全（events.ts）

- [x] 1.1 `packages/overlay/src/events.ts`：`contextmenu` 监听器中，命中可审查元素的分支把裸 `e.preventDefault()` 换成 `swallow(e)`（preventDefault + stopPropagation + stopImmediatePropagation），阻断事件传播到宿主 `contextmenu` 监听器（antdv a-tree 等）；同步更新 `events.ts` 头注释的 contextmenu 行为描述。

## 2. 菜单自身右键不穿透

- [x] 2.1 `packages/overlay/src/events.ts`：`contextmenu` 监听器在 `state.inspecting` 门控之后新增早退分支——菜单可见（display === 'block'）且 `state.contextMenu.contains(e.target)` 时 `swallow(e)`、隐藏菜单并 return（与 click 处理器「点菜单内部先处理菜单关闭」语义对齐），不再穿透菜单命中下方元素。

## 3. 构建

- [x] 3.1 `pnpm -C packages/overlay build` 重建 overlay IIFE。

## 4. 验证（与用户协作，服务由用户启动）

- [x] 4.1 PC demo：审查模式下右键可审查元素 → 仅出现 overlay 菜单，浏览器原生菜单不弹（回归既有行为）；宿主页面上若存在监听 contextmenu 的组件（如 antdv a-tree 节点），其自定义右键逻辑不再被触发。
- [x] 4.2 审查模式下右键点击 overlay 菜单自身 → 菜单关闭，不出现「菜单闪现到新位置 / 选中态被切换」。
- [x] 4.3 负向回归：非审查模式下右键 → 宿主原生右键菜单行为完全不变；审查模式下右键不可审查区域（如 body 空白处）→ 事件照常放行（现状保持）。
- [x] 4.4 回归：右键菜单各菜单项（在编辑器中打开 / 编辑属性 / 组件面板 / 编辑代码 / 复制路径 / 删除）功能不受影响。

## 5. portal 组件命中优先（modal / drawer 面板下修改生效）

- [x] 5.1 `packages/overlay/src/utils.ts`：`findInspectableElement` 改为沿祖先链收集最近 attr 节点与最近 `__vdi-src-*` portal 根，存在 portal 根时优先返回 portal 根（点 modal/drawer 内部 `<p>` 命中组件本身）。
- [x] 5.2 `packages/overlay/src/events.ts`：`findElementUnderOverlay` 去掉「节点自身带 attr 即短路返回」分支，统一走 `findInspectableElement`，避免 overlay 遮罩下点内部节点绕过 portal 优先。
- [x] 5.3 `packages/examples/pc/vite.config.ts`：`portalComponents` 从 `['*modal']` 扩为 `['*modal', '*drawer']`，让 a-drawer 走 class 通道把源码位置透传到 `.ant-drawer-section`。

## 6. 收尾

- [x] 6.1 `pnpm run prettier` 格式化本次修改的文件。
- [x] 6.2 `pnpm typecheck` 通过。
