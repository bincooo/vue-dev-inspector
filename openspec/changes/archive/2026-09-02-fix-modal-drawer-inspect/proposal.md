## Why

在 commit `0784e49` 中，`findInspectableElement` 函数被修改为「portal 优先」逻辑：当点击 modal/drawer 内部元素时，总是返回 portal 根（modal/drawer 本身）而不是内部组件。这导致用户无法选中 modal/drawer 内部的组件（如 `<a-input>`、`<a-button>` 等），只能选中整个 modal/drawer。

## What Changes

- 修改 `findInspectableElement` 函数的返回逻辑：
  - 如果点击的元素本身或其直接祖先有 `data-source-file` 属性，返回该元素（内部组件）
  - 如果点击的是纯文本/无标记元素，且在 portal 根内，返回 portal 根
  - 保持 portal 根的 class 解码和属性写回逻辑不变

## Capabilities

### New Capabilities
- `portal-inspect-fix`: 修复 portal 组件（modal/drawer）内部元素的选中逻辑

### Modified Capabilities
（无）

## Impact

- **Affected code**: `packages/overlay/src/utils.ts` 的 `findInspectableElement` 函数
- **Behavior change**: 用户可以再次选中 modal/drawer 内部的组件
- **No breaking changes**: 保持对 portal 根的 class 解码和属性写回
