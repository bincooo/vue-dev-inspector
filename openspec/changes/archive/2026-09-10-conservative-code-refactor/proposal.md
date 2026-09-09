## Why

经过近期连续的功能迭代（属性引号转义、右键菜单、撤销/重做、父级选择、代码抽屉最大化），`packages/overlay`、`packages/client` 等核心模块积累了明显的重复代码与局部复杂度问题（如服务端路由处理器中重复的读盘-解析-定位-写盘流程、overlay 面板间重复的 DOM 构建逻辑、`requestUndo`/`requestRedo` 的复制粘贴）。趁功能稳定期做一次**纯内部重构**：行为逐字节不变、无 API/数据结构改动、不引入新抽象层，仅消除重复与降低局部复杂度，降低后续维护成本。

## What Changes

- 对全仓库源码（`packages/*/src`，不含 examples 与落地页）做一次保守排查，仅对满足以下判据之一的代码点做等价重构：
  1. **重复代码**：同一文件或相邻文件间近乎逐字重复的逻辑块（≥2 处、每处 ≥5 行），合并为文件内私有函数；
  2. **明显 Bug**：可静态证明与意图相悖的实现（如复制粘贴时的错误变量、永远为真的分支）——**只报告不擅自修**，除非属复制粘贴笔误且修复后行为不变；
  3. **明显复杂度**：单函数过长（>100 行）且存在与行为无关的机械重复段落。
- **不做**：重命名、注释/格式统一、目录搬移、新增文件/工具类、合并 core 与 uni、升级依赖、任何公共接口变化。
- 新增 helper 一律放在**所在文件内部**（不导出、不新增文件），函数命名与各文件现有私有 helper 风格一致。
- 修改后必须通过 `pnpm typecheck` 与 `pnpm lint`；能跑既有测试的包跑测试（client / utils）。

## Capabilities

### New Capabilities

（无——本变更是纯重构，不引入任何新行为。）

### Modified Capabilities

（无——所有现有 spec 的行为要求保持不变；`attr-value-roundtrip`、`edit-history`、`overlay-focus-guard`、`parent-select`、`portal-inspect-fix` 均不受影响，仅作回归基线。）

## Impact

- **涉及代码**：`packages/overlay/src/*`、`packages/client/src/*`，视排查结果可能少量涉及 `packages/pluginkit/src/*`、`packages/shared/src/*`、`packages/utils/src/*`、`packages/core/src/*`、`packages/uni/src/*`。
- **不涉及**：`packages/antdv`、`packages/uview`（物料目录数据为主）、`packages/examples/*`、根目录落地页 `src/`。
- **对外影响**：零。REST API 路由、请求/响应结构、`window.__DEV_INSPECTOR_CFG__` 配置格式、overlay 注入的 DOM 结构与 class 命名（`__vdi-`）、构建产物结构均不变。
- **依赖**：不新增任何第三方依赖。
- **构建**：改动 overlay/client 源码后需按 CLAUDE.md 重建对应包并重启 demo 验证。
