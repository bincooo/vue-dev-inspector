## Context

`events.ts` 中审查模式的四个鼠标事件监听器（均在 `document` 捕获阶段注册）拦截语义不一致：

| 事件 | 命中可审查元素时 | 未命中时 |
|---|---|---|
| `mousedown` | `swallow`（preventDefault + stopPropagation + stopImmediatePropagation） | 不拦截 |
| `click` | `swallow` | `swallow`（detail>=2）/ 其余分支各自处理 |
| `dblclick` | `swallow` | 不拦截（早 return） |
| `contextmenu` | **仅 `preventDefault`** | 不拦截（早 return） |

`contextmenu` 的 `preventDefault` 只压制了浏览器原生菜单，事件本身仍沿 DOM 传播：宿主应用（如 antdv `a-tree` 的 `emit("contextmenu", e)`）与任何第三方 `contextmenu` 监听器照常收到事件。另外菜单可见时右键点击菜单本身，`resolveHitElement` 会经 `elementsFromPoint` 穿透菜单命中下方元素，把菜单「闪现」到新位置并切换选中态。

既有工具函数 `swallow(e)` 已实现完整三连拦截，且项目对「审查模式事件不透传」已有明确语义先例（见 `events.ts` 头注释：mousedown「阻止事件透传」、dblclick「先把所有透传停掉」）。

## Goals / Non-Goals

**Goals:**

- 审查模式下右键命中可审查元素：事件既不弹原生菜单（已有），也不传播到宿主监听器（补齐）。
- 右键点击 overlay 菜单自身：关闭菜单，不穿透、不二次弹出、不切换选中态。
- 非审查模式行为零变化。

**Non-Goals:**

- 不改菜单项、菜单位置 clamp、菜单样式。
- 不处理「审查模式开着但右键点在不可审查区域」的透传——现状（早 return，事件放行给宿主）是合理行为，审查模式只接管可审查元素。
- 不引入新的 capability / spec（`skip_specs: true`，实现级缺陷修复）。

**Goals（新增 — portal 组件命中优先）：**

- 审查命中策略：祖先链上存在 portal 根（`__vdi-src-*` class token）时，优先选中 portal 根而不是内部子节点。否则点 modal/drawer 里的 `<p>` 会命中段落，属性面板改的是段落而不是 `<a-modal>` / `<a-drawer>` 本身（用户感知为「面板下修改没有生效」）。
- demo 配置：`portalComponents` 扩为 `['*modal', '*drawer']`，让 a-drawer 走 class 通道把源码位置透传到 `.ant-drawer-section`。

## Decisions

### D1：命中可审查元素分支用 `swallow(e)` 替换裸 `preventDefault`

与 mousedown/click/dblclick 的既有语义完全对齐，一处复用，零新概念。

- 备选 A：只加 `stopPropagation` 不加 `stopImmediatePropagation`。被否——宿主可能也有 capture 阶段的 `contextmenu` 监听器（antdv 部分组件在元素上注册，事件从 target 冒泡前先经过 capture 链），`stopPropagation` 不阻断同元素同阶段的其余监听器；`swallow` 是项目已验证的完整语义。
- 备选 B：`contextmenu` 全局无条件 `swallow`（不看是否命中）。被否——审查模式下右键空白/不可审查区域时宿主自定义右键逻辑（若业务有）应保留；且这与 mousedown 的既有门控（`resolveHitElement` 未命中即放行）不一致。

### D2：菜单可见时右键命中菜单子树 → 关菜单 + 拦截，不透传

在 `contextmenu` 监听器最前（`state.inspecting` 门控之后）插入：菜单 display === 'block' 且 `state.contextMenu.contains(e.target)` 时 `swallow(e)` 并隐藏菜单，return。语义与现有 click 分支「点菜单内部先处理菜单关闭」对齐——click 是「点菜单内部 = 消费该点击并关菜单」，contextmenu 采用同款判定。

- 备选：命中菜单子树时也走 `resolveHitElement` 穿透并在新位置重开菜单。被否——右键菜单上再右键，用户预期是关闭（与 click 一致），不是「把菜单闪到鼠标处」。

### D3：右键命中非菜单的可审查元素时，菜单若已可见则先由 `showMenu` 重建

现状 `showMenu` 开头已 `innerHTML = ''` 清空重建，天然幂等；本次仅需保证事件被 `swallow` 后不重复触发宿主监听。不额外改动。

## Risks / Trade-offs

- [宿主依赖「审查模式下右键仍能收到 contextmenu 事件」的集成不存在——审查模式本身就是全面拦截态] → 接受；与 mousedown 拦截语义一致，属设计意图。
- [`swallow` 在 capture 阶段调用 `preventDefault`，浏览器原生右键菜单被压制] → 这正是现状（裸 `preventDefault` 已存在），无行为回退。
- [菜单上右键改为「关闭」后，用户想换一个元素右键需再按一次] → 与点击关闭菜单的交互一致，成本一次点击；换取的是不再出现「菜单上右键 → 穿透闪现 + 选中态漂移」的怪异行为。
- [portal 优先改变所有元素的命中语义] → 当祖先链上不存在 portal 根时退回 nearestAttr，普通页面元素行为不变；只有 portal 组件内部子节点受影响（本就是误命中，优先选中组件本身是正确语义）。

## Migration Plan

1. 修改 `events.ts` 的 `contextmenu` 监听器（两处：菜单子树早退分支 + 命中分支换 `swallow`）。
2. `pnpm -C packages/overlay build` 重建。
3. 重启 PC demo 验证（详见 tasks.md）。
4. 回滚即 revert 单文件 + 重建 overlay。

## Open Questions

（无。）
