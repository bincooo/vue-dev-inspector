## Context

本变更是对 `packages/overlay`、`packages/client` 等核心模块的**纯内部重构**——不引入新行为、不改变公共接口（见 `proposal.md`）。仓库是 pnpm monorepo，ESM-only，overlay 编译为单 IIFE，其状态集中在 `state.ts` 的单一可变 `state` 对象（CLAUDE.md 明确要求"请勿优化成独立 `let` 导出"）。`packages/client/src/editor.ts` 用 `@vue/compiler-sfc` + MagicString 做 AST 级原子修改，存在若干仅靠 `findCloseTagStart` 等约束文档化的脆弱边界（见 CLAUDE.md "已知 invariant"）。

约束（来自 CLAUDE.md / 项目约定）：
- 重构必须保持"中文注释、英文标识符"风格。
- overlay 类名前缀 `__vdi-`、动态布局走 JS 内联、静态样式写 `overlay.css`——这些边界重构时不得逾越。
- 服务端 `editor.ts` 的零长度区间用 `prependRight`、跨行闭合标签用 `findCloseTagStart` 等 invariant 是**正确性约束**，重构不得触碰这些边界。
- 改 overlay/client 源码后需重建对应包并重启 demo 验证。

## Goals / Non-Goals

**Goals:**
- 在**不新增文件、不新增导出、不新增抽象层**的前提下，消除同一文件内的逐字重复（≥2 处、每处 ≥5 行）。
- 仅对复制粘贴笔误这类可静态证明"修复后行为不变"的明显笔误做修复。
- 修改后 `pnpm typecheck` + `pnpm lint` 通过，client/utils 既有测试通过。

**Non-Goals:**
- 不统一命名、注释、格式（留给 prettier/lint）。
- 不合并 core 与 uni（架构边界，CLAUDE.md 明确隔离原因）。
- 不拆分长函数为多文件、不新增 Manager/Helper/Util/Base 文件。
- 不重构物料包 `antdv`/`uview`（数据为主）。
- 不重构 examples 与落地页。
- 不主动报告外的 Bug 修复——发现非复制粘贴类问题只报告不动手。

## Decisions

### 决策 1：helper 一律文件内私有，不导出、不新增文件

**选择**：所有合并重复得出的 helper 函数定义为**所在文件内的私有函数**（不 `export`），不新建任何文件。

**理由**：CLAUDE.md"文件修改原则"明确禁止为几十行代码新增工具类/Helper/Util 文件；且新增文件会改变目录结构与依赖图，违反最小影响原则。文件内私有函数满足"消除重复"目标且零结构影响。

**替代方案**：抽到 `shared` 或新建 `utils` 文件共享——否决，因会引入跨包依赖与公共接口，违反禁止项。

### 决策 2：仅做可机械验证的等价变换

**选择**：重构类型限定为三类，且每处都需能给出"输入相同→输出相同"的机械论证：
1. 复制粘贴重复 → 抽文件内私有函数，调用点逐字等价。
2. 复制粘贴时的错误变量 → 仅当笔误变量与正确变量在重构前后行为可证明等价（如复制 `requestRedo` 时忘了改 `'撤销'`→`'重做'` 但实际已正确——此类**不属笔误**，跳过）。仅修真正引入行为偏差的笔误，且修复后须有测试或静态证明。
3. 长函数内机械重复段 → 提取为文件内函数，保持调用顺序与异常处理不变。

**理由**：规则要求"输入相同，输出完全一致"。涉及 AST/MagicString 区间操作的代码（`editor.ts`）脆弱性高，仅靠纸面等价不够，必须辅以既有测试。

**替代方案**：扩大到"等价但不机械"的改写——否决，无法保证行为一致。

### 决策 3：不触碰已文档化的脆弱边界

**选择**：`editor.ts` 中 `prependRight` vs `overwrite`、`findCloseTagStart`、`expandSelfClosing`、`removeElementRange` 等被 CLAUDE.md 标注 invariant 的函数**只读不动**，即便内部有重复也不合并。

**理由**：这些边界是历史 Bug 修复的产物，合并可能破坏区间计算的隐式依赖；且均有测试覆盖，重构收益低于风险。

**替代方案**：合并 `removeElementRange`/`expandSelfClosing` 的重复——否决，越界。

### 决策 4：验证以 typecheck + lint + 既有测试为准

**选择**：不新增测试（新增测试属"补需求"，违反禁止项）。回归依赖 `pnpm typecheck`、`pnpm lint`，以及 `packages/client/test/*`、`packages/utils/test/*` 既有用例。

**理由**：既有测试覆盖了 `editor.ts` 区间操作与属性引号转义等关键路径，足以拦截等价性破坏。

## Risks / Trade-offs

- **[风险] AST/MagicString 区间等价性误判** → 缓解：对 `editor.ts` 仅做不涉区间的重复合并；涉区间的改动一律跳过并由既有测试守门。
- **[风险] overlay IIFE 闭包/`state` 对象语义被无意改变** → 缓解：overlay 侧仅合并纯 DOM 构建重复，不动 `state.ts` 的单一可变对象约定；改完必须重建 overlay 并重启 demo 验证。
- **[风险] 文件内私有 helper 命名与既有风格冲突** → 缓解：命名跟随所在文件既有私有 helper 风格（如 overlay 用 `createXxx`/`xxxHandler`，client 用 `xxx` 驼峰）。
- **[取舍] 不新增测试意味着等价性靠既有覆盖** → 接受：规则禁止补需求，既有测试已是这些模块的回归基线。

## Migration Plan

1. 按 packages 分批改（overlay → client → 其余），每批改完即 `pnpm typecheck` + 对应包测试。
2. overlay 改动后执行 `pnpm -C packages/overlay build`，并由用户重启 demo 做人工回归（服务启动交由用户，CLAUDE.md）。
3. 全部完成后 `pnpm run prettier` 格式化改动文件，再提交。
4. 回滚：`git checkout` 对应文件即可，无数据/配置迁移。

## Open Questions

（重构候选清单以 `tasks.md` 排查结果为准，设计阶段不预设具体改动点。）
