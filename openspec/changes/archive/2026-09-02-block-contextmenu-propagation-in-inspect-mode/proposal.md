## Why

审查模式下的右键菜单事件处理不完整：`events.ts` 的 `contextmenu` 监听器只在「命中可审查元素」路径上调用 `e.preventDefault()`，既不 `stopPropagation` 也不 `stopImmediatePropagation`。后果有二：(1) 右键事件继续冒泡到宿主页面，ant-design-vue 的 `a-tree` / `DirectoryTree`、`a-date-picker` 等监听 `contextmenu` 的组件会照常触发宿主自己的右键菜单/逻辑，与 overlay 菜单叠加出现；(2) 点击 overlay 右键菜单自身的右键（菜单可见时）会命中菜单下方的可审查元素，穿透 `resolveHitElement` 把菜单闪到新位置、选中态被意外切换。审查模式对 `mousedown`/`click`/`dblclick` 都有完整的「拦截 + 不透传」语义（`swallow`），唯独 `contextmenu` 半途而废。

## What Changes

- `events.ts` 的 `contextmenu` 监听器补齐拦截语义：命中可审查元素打开 overlay 菜单时，除 `preventDefault` 外增加 `stopPropagation` + `stopImmediatePropagation`，阻断事件继续传播到宿主页面的 `contextmenu` 监听器（antdv tree 等）。
- 菜单可见期间，右键点击 overlay 菜单自身不再穿透：命中菜单子树时仅关闭菜单（与现有 click-关闭菜单分支的语义对齐），不再把右键透传到菜单下方的元素，也不再在菜单上二次弹出菜单。
- 非审查模式（`state.inspecting === false`）行为完全不变，宿主原生右键菜单正常。
- 审查命中策略：祖先链上存在 `__vdi-src-*` portal 根（a-modal / a-drawer 等 Teleport 组件）时，优先选中 portal 根而不是内部子节点，使属性面板 / 删除 / 插入改的是组件标签本身。demo 把 `*drawer` 加入 `portalComponents`，与 `*modal` 同一 class 通道。

## Capabilities

### New Capabilities

（无——本变更属于审查模式既有「事件拦截」行为的缺陷修复，落在已有交互面上。）

### Modified Capabilities

（无 —— `openspec/specs/` 仅有 `overlay-focus-guard`（focusin 守卫），与右键事件拦截分属不同行为面，需求互不重叠，无需修改。）

**specs 处理**：本变更不改任何 spec 级需求——`contextmenu` 拦截是审查模式「阻断宿主事件」既定语义（mousedown/click/dblclick 已如此）的补全，属实现级缺陷修复，故在 `.openspec.yaml` 设置 `skip_specs: true`。

## Impact

- **代码**：`packages/overlay/src/events.ts`（`contextmenu` 拦截 + `findElementUnderOverlay` 不再短路内部 attr 节点）；`packages/overlay/src/utils.ts`（`findInspectableElement` portal 优先）；`packages/examples/pc/vite.config.ts`（`portalComponents` 加 `*drawer`）。
- **构建**：修改 overlay 源码后需 `pnpm -C packages/overlay build` 重建 IIFE 并重启 demo。
- **不受影响**：服务端 API、编译期 transform 算法、非审查模式下的宿主右键行为。
