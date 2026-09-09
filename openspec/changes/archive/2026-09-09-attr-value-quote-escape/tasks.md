## 1. 写入端引号策略实现

- [x] 1.1 在 `packages/client/src/editor.ts` 新增纯函数 `quoteAttrValue(v: string): string`，实现三档 clamp：无 `"`→`"v"`；含 `"` 无 `'`→`'v'`；含 `"` 且含 `'`→`"v"`（内部 `"` 替换为 `&quot;`）。返回值含外层引号。
- [x] 1.2 改 `editElementProps` 的属性拼接段（现 `${x.k}="${x.v}"` 字面拼接）：空值属性（`x.v === ''`）仍渲染为 ` ${x.k}`（布尔属性，短路不调用 helper）；非空值改为 ` ${x.k}${quoteAttrValue(x.v)}`。区间操作（`prependRight` / `overwrite` / `remove` 三分支）不动。

## 2. 验证与回归

- [x] 2.1 对 `quoteAttrValue` 三档各写一条单测断言（无引号、含双引号、含双+单引号），确认产出符合 spec 场景期望。
- [x] 2.2 端到端验证：在 PC demo 启动后，对 `:options="getDictOptions(&quot;wms_stock_in_order_status&quot;)"` 这类属性用属性面板编辑保存，确认写盘 SFC 语法合法、Vue 编译器不报错、HMR 正常。
- [x] 2.3 往返验证：对同一属性「编辑保存 → 重新打开属性面板」，确认编辑框显示与上次输入的裸值一致（`&quot;` 回读为裸 `"`，单引号包裹回读为裸值）。
- [x] 2.4 回归：对不含引号的普通属性（如 `label="普通文本"`）编辑保存，确认产出仍是双引号包裹、零转义、与旧逻辑产出一致（最小 diff）。

## 3. 构建与收尾

- [x] 3.1 重建 `packages/client`（`pnpm -C packages/client build`），确认 tsup 打包成功、无类型错误。
- [x] 3.2 跑 `pnpm typecheck` 与 `pnpm lint:fix`，确认全项目无新增类型/ lint 错误。
- [x] 3.3 跑 `pnpm prettier` 格式化改动代码。
