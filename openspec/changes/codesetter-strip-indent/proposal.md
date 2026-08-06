## Why

CodeSetter（属性面板的 Monaco 代码编辑器）直接将 `entry.value` 原文灌入编辑器，不做任何缩进预处理。当属性值是多行表达式（如复杂对象字面量、函数表达式）时，每行都带有模板中的原始前导空白（通常 6-12 空格），编辑器里代码整体右偏，可读性差、编辑体验不佳。

code-drawer.ts 的子节点文本编辑已有 `stripCommonIndent` / `applyIndent` 成熟方案：编辑前剥离公共前置缩进让用户顶格编辑，保存时按行还原。CodeSetter 应复用同一模式。

## What Changes

- 在 `code-setter.ts` 中引入 `stripCommonIndent` / `applyIndent`（从 `code-drawer.ts` 提取为共享工具函数）。
- Monaco model 创建前对 `entry.value` 做 `stripCommonIndent`，用户看到的是去除了公共缩进的干净代码。
- `model.onDidChangeContent` 同步回 `entry.value` 时，用 `applyIndent` 还原原始缩进，保证写回 AST 的源码缩进正确。
- 浮动窗口（popout）共享同一 model，无需额外处理。

## Capabilities

### New Capabilities

- `codesetter-indent-strip`: CodeSetter 编辑器对多行属性值自动剥离公共前置缩进（编辑时顶格展示，保存时还原）。

### Modified Capabilities

（无——这是 CodeSetter 的纯体验增强，不改变已有行为契约。）

## Impact

- **代码**：`packages/overlay/src/setters/code-setter.ts` — 新增缩进剥离/还原逻辑。`packages/overlay/src/panel/code-drawer.ts` — `stripCommonIndent` / `applyIndent` 提取到共享位置或直接在 code-setter.ts 内联副本。
- **依赖**：无新增依赖。
- **产物**：仅影响 overlay IIFE（dev 模式），不影响编译产物或运行时包。
- **兼容性**：无破坏性变更；单行属性值无公共缩进，`stripCommonIndent` 直接返回原文，行为无变化。
