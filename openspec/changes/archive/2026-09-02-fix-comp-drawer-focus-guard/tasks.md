## 1. state 字段扩展

- [x] 1.1 `packages/overlay/src/state.ts`：新增 `codePopout: null as HTMLDivElement | null` 字段（CodeSetter 大窗口编辑弹窗的宿主元素），注释说明由 `code-setter.ts` 的 `openPopout`/`close` 维护、供 events.ts focus-guard 判定。

## 2. 统一 focus-guard（events.ts）

- [x] 2.1 `packages/overlay/src/events.ts`：把全局 `focusin` capture 拦截器的判定从 `{propPanel, codeDrawer}` 扩展为 `{propPanel, codeDrawer, componentDrawer, attrDrawer, codePopout}` 五棵子树的 `contains` 判定（任一命中即 `stopImmediatePropagation`），更新函数头注释（说明覆盖全部顶层浮层、阻断 antdv useLockFocus 焦点回拉、浮层外零拦截）。

## 3. CodeSetter 局部 guard 移除

- [x] 3.1 `packages/overlay/src/setters/code-setter.ts`：`openPopout` 中删除局部 `focusGuard` 定义与 `addEventListener`/`removeEventListener`，改为打开时把 mask（或 popout 容器）写入 `state.codePopout`、`close` 时同步置 `null`，移除相应注释。

## 4. 构建

- [x] 4.1 `pnpm -C packages/overlay build` 重建 overlay IIFE。

## 5. 验证（与用户协作，服务由用户启动）

- [x] 5.1 PC demo（AntdTest.vue）回归：点「Open Drawer」打开宿主 a-drawer → 进入审查模式 → 右键/菜单打开组件面板 → 点击「搜索组件…」输入框可聚焦、可输入文字。
- [x] 5.2 同场景回归属性选择抽屉：双击元素打开属性编辑面板 → 打开属性选择抽屉 → 「搜索属性…」输入框可聚焦输入。
- [x] 5.3 回归既有修复：prop panel 文本控件输入、CodeSetter 弹窗 Monaco 编辑器输入（宿主抽屉打开时均正常）。
- [x] 5.4 负向回归：关闭所有 overlay 浮层后，宿主 a-drawer 内自身的输入框焦点行为不受影响（focus-trap 正常工作）。

## 6. 收尾

- [x] 6.1 `pnpm run prettier` 格式化本次修改的文件。
- [x] 6.2 `pnpm typecheck` 通过。
