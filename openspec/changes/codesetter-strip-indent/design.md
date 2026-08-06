## Context

`code-drawer.ts` 中已有 `stripCommonIndent` / `applyIndent` 一对函数处理子节点文本编辑的缩进问题。`code-setter.ts` 的 CodeSetter 目前直接将 `entry.value` 原文写入 Monaco model，不做任何预处理。参见 proposal.md 的 Why 部分。

CodeSetter 与 code-drawer 的关键差异：
- CodeSetter 编辑的是属性值（通常较短，单行到十几行），code-drawer 编辑的是完整 script/style/子节点块（可能上百行）。
- CodeSetter 的值通过 `entry.value` 双向绑定（model.onDidChangeContent → entry.value），code-drawer 通过显式保存按钮提交 API。
- CodeSetter 有 popout 浮动窗口共享 model；code-drawer 无此机制。

## Goals / Non-Goals

**Goals:**
- 多行属性值在 CodeSetter Monaco 编辑器中顶格显示，提升可读性和编辑体验。
- 保存时自动还原缩进，保证写回 AST 的源码缩进正确。
- 复用 code-drawer.ts 中已验证的 `stripCommonIndent` / `applyIndent` 逻辑。

**Non-Goals:**
- 不处理 script/style 块编辑（已有 code-drawer 负责）。
- 不改变单行属性值的行为（无公共缩进时 strip 是 no-op）。
- 不为 popout 单独做缩进处理（共享 model 即可）。

## Decisions

### 1. 提取 `stripCommonIndent` / `applyIndent` 为共享工具函数

**选择**：将这两个函数从 `code-drawer.ts` 移到 overlay 的 `utils.ts`，code-drawer.ts 和 code-setter.ts 都从 utils 导入。

**替代方案**：
- **A) 在 code-setter.ts 内联副本**：避免改动 code-drawer.ts，但违反 DRY，后续修 bug 要改两处。
- **B) 新建 `indent.ts` 模块**：过度抽象，仅两个函数不值得单独文件。

**理由**：utils.ts 已是 overlay 的公共工具库（createElement / apiRequest / parsePosition 等），放这里最自然。code-drawer.ts 改为从 utils 导入，消除当前的局部定义。

### 2. 缩进状态存储在闭包变量中（不挂 DOM）

**选择**：在 `codeSetter.build()` 中用局部变量 `let indent = ""` 保存剥离结果，`model.onDidChangeContent` 回调中用 `applyIndent(edited, indent)` 还原后写入 `entry.value`。

**替代方案**：挂到 container 元素的自定义属性上（如 `__vdiIndent`）。与 code-drawer 的 `panel.indent` 模式一致，但 CodeSetter 没有 panel 对象，强行挂 DOM 属性是 over-engineering。

**理由**：CodeSetter 的 build 函数形成单一闭包，局部变量足够；无需跨函数共享。

### 3. 仅在多行值时执行 strip（单行跳过）

**选择**：`stripCommonIndent` 本身对单行字符串返回原值（`indent === ""`），无需额外判断。但实现时仍走完整流程，`applyIndent` 在 `indent === ""` 时也直接返回原文。

**理由**：保持逻辑简洁，不加额外分支。`stripCommonIndent` 已处理边界（空字符串、单行、无公共缩进）。

## Risks / Trade-offs

- **[Risk] onDidChangeContent 每次击键都调 applyIndent** → `applyIndent` 是纯字符串 split + map + join，对典型属性值（< 50 行）性能开销可忽略。无需 debounce。
- **[Risk] 用户手动输入带缩进的多行值，applyIndent 二次叠加** → 不会。`stripCommonIndent` 在 model 创建时执行一次；后续 onDidChangeContent 读的是用户编辑后的 editor.getValue()（已剥离状态），applyIndent 只还原 `indent` 变量中保存的原始公共缩进，不会叠加。
- **[Trade-off] 提取到 utils.ts 改动 code-drawer.ts** → 改动极小（import 路径变更，删除局部函数定义），风险可控。
