## Context

属性抽屉（`packages/overlay/src/attr-drawer.ts`）的 `render(filter)` 是 `buildAttrDrawer` 的闭包函数，构建属性行列表。当前 `filter` 仅作为函数参数传入，搜索框 `oninput` 时调用。点击属性添加后调用 `rerenderPropList()`（刷新 prop panel），但不刷新抽屉。

现有行结构（`display: flex; gap: 8px`）：

```
[ name ] [ label (flex:1) ] [ value ]
```

`label` 有 `flex: 1` 占据中间空间，`value` 紧随其后。无 `label` 时 `name` 和 `value` 紧凑排列。

## Goals / Non-Goals

**Goals:**
- 在 `render(filter)` 中按 `entries` 标记已添加属性，✓ 放在行最右侧
- 点击添加后即时刷新标记

**Non-Goals:**
- 不监听 prop panel 侧的 entries 变化（手动加/删/改 key）-- 已在 spec 中声明
- 不改变已有属性行的 name/label/value 布局

## Decisions

### D1: `filter` 提为闭包变量

**选择**：在 `buildAttrDrawer` 内部新增 `let currentFilter = ""`，`render` 读写该变量而非仅靠参数。搜索框 `oninput` 时更新 `currentFilter` 再调 `render()`。

**理由**：点击添加后需要用当前搜索词重新渲染。如果 filter 只是参数，点击回调里拿不到当前值。提到闭包变量后，`onclick` 里直接调 `render(currentFilter)` 即可。

### D2: 点击添加后全量 `render(currentFilter)` 而非局部标记

**选择**：点击属性添加后，调 `render(currentFilter)` 重建整个列表 DOM。

**备选**：局部给该行 DOM 加 ✓ span + class，不重建列表。

**理由**：抽屉列表通常 5-20 条，全量重建性能可忽略。全量 render 与搜索走同一条路径，行为更一致，避免局部更新遗漏 cursor/class 等状态。搜索时本来就会全量重建，点击添加走同一逻辑不引入额外复杂度。

### D3: ✓ 标记用独立 span，`margin-left: auto` 右对齐

**选择**：已存在的属性行末尾追加 `<span class="__vdi-attr-drawer-item-check">✓</span>`，样式 `margin-left: auto; color: #22c55e`。

**理由**：`label` 有 `flex: 1` 时 ✓ 自然在最右；无 `label` 时 `margin-left: auto` 将 ✓ 推到行末。不改变 name/label/value 的现有布局。

## Risks / Trade-offs

- **[全量 render 丢失滚动位置]** -> 点击添加后 `render(currentFilter)` 重建 `list.innerHTML`，如果列表很长且用户滚动了，滚动位置会重置。但抽屉高度有限、列表通常短，可接受。若后续列表变长，可改用局部更新。
