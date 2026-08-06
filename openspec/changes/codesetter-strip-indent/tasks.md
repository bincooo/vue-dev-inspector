## 1. 提取共享工具函数

- [x] 1.1 将 `stripCommonIndent` / `applyIndent` 从 `code-drawer.ts` 移到 `utils.ts`，导出为公开函数
- [x] 1.2 `code-drawer.ts` 改为从 `utils.ts` 导入 `stripCommonIndent` / `applyIndent`，删除局部定义

## 2. CodeSetter 缩进预处理

- [x] 2.1 在 `code-setter.ts` 中从 `utils.ts` 导入 `stripCommonIndent` / `applyIndent`
- [x] 2.2 在 `build()` 中 Monaco model 创建前调用 `stripCommonIndent(entry.value ?? "")`，用剥离后的文本创建 model，闭包变量保存 `indent`
- [x] 2.3 修改 `model.onDidChangeContent` 回调：`entry.value = applyIndent(editor.getValue(), indent)`

## 3. 构建与验证

- [x] 3.1 执行 `pnpm typecheck` 确认无类型错误
- [ ] 3.2 启动 PC demo（`pnpm dev:pc`），对多行属性值（如 `:style`、`@click`）验证 CodeSetter 编辑器显示顶格代码、保存后源码缩进正确
- [ ] 3.3 验证单行属性值行为无变化
- [ ] 3.4 验证 popout 浮动窗口显示内容与行内编辑器一致
- [x] 3.5 执行 `pnpm run prettier` 格式化修改的代码
