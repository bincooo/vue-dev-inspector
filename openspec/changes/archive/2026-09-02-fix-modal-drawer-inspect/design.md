## Context

commit `0784e49` 修改了 `findInspectableElement` 函数，实现了「portal 优先」逻辑：
- 从 target 向上遍历，收集 `nearestAttr`（有 `data-source-file` 的元素）和 `nearestPortal`（有 `__vdi-src-` class 的 portal 根）
- 如果两者都找到，总是返回 `nearestPortal`

这导致用户无法选中 modal/drawer 内部的组件。

## Goals / Non-Goals

**Goals:**
- 用户可以选中 modal/drawer 内部有标记的组件
- 点击无标记元素时回退到 portal 根
- 保持 portal 根的 class 解码逻辑

**Non-Goals:**
- 不改变 portal 组件的配置方式
- 不改变其他 overlay 行为

## Decisions

### 修改 `findInspectableElement` 返回逻辑

**当前逻辑**:
```typescript
return nearestPortal ?? nearestAttr;
```

**修改为**:
```typescript
// 如果 nearestAttr 存在且不是 portal 根本身，优先返回 nearestAttr
if (nearestAttr && nearestAttr !== nearestPortal) {
  return nearestAttr;
}
return nearestPortal ?? nearestAttr;
```

**理由**:
- 当用户点击内部组件（有 `data-source-file`）时，`nearestAttr` 是该组件
- 当用户点击纯文本时，`nearestAttr` 是 null 或 portal 根本身
- 这样既支持选中内部组件，又保持对纯文本的 portal 根回退

## Risks / Trade-offs

**[Risk] 某些场景下可能误选内部组件**
→ 缓解：只有有 `data-source-file` 属性的组件才会被选中，这是预期行为
