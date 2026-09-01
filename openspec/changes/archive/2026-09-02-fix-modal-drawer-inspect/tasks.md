## 1. 修改 findInspectableElement 函数

- [x] 1.1 修改 `packages/overlay/src/utils.ts` 中的 `findInspectableElement` 函数返回逻辑
- [x] 1.2 更新函数注释说明新的行为

## 2. 测试验证

- [x] 2.1 测试点击 modal/drawer 内部组件可以选中
- [x] 2.2 测试点击 modal/drawer 内部纯文本回退到 portal 根
- [x] 2.3 测试普通页面元素选中行为不变
- [x] 2.4 运行 `pnpm run prettier` 格式化代码
