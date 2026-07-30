## Context

「编辑属性」面板（`packages/overlay/src/prop-panel.ts`）当前是一个居中模态弹窗（`__vdi-panel-mask`，z-index 9999），用户手动输入属性名和值。ComponentConfig（`packages/shared/src/componentConfig.ts`）已定义 `ComponentConfigEntry -> groups -> ComponentItem` 层级，每个 item 有 `tag/label/snippet/icon/imports`，但无属性描述字段。overlay 已有两个右侧滑入抽屉的先例（`comp-drawer.ts` / `code-drawer.ts`），均使用 `__vdi-backdrop` 遮罩（z-index 9998）+ `translateX` 动画。

配置流转：`componentConfig` 经 `buildCfgJson`（pluginkit）剥离 `expand` 后序列化为 `window.__DEV_INSPECTOR_CFG__.componentEntries`，overlay 从 `state.componentEntries` 读取。`attrs` 作为 `ComponentItem` 上的纯数据字段，会随此通道自动到达浏览器侧，无需额外的服务端 API 或注入通道。

## Goals / Non-Goals

**Goals:**
- 让用户从预定义清单中点选属性，而非手动输入属性名
- 复用现有 ComponentConfig 配置通道，物料包只需在 item 上补 `attrs` 字段即可生效
- 抽屉与 prop panel 并存，互不阻塞操作

**Non-Goals:**
- 不为原生 HTML 元素（`<div>`/`<span>` 等）提供内置属性清单 -- 仅覆盖 ComponentConfig 中声明的组件
- 不修改 prop panel 已有的手动添加行（「新属性名 = 值 ＋ 添加」）-- 两条路径并存
- 不新增服务端 REST API -- `attrs` 数据完全在浏览器端消费

## Decisions

### D1: 属性描述挂在 `ComponentItem.attrs` 上

**选择**：在 `ComponentItem` 上新增可选 `attrs?: ComponentAttr[]` 字段。

**理由**：属性是 per-component-tag 的，与 `ComponentItem` 的 `tag` 字段天然关联。物料包声明一个组件时，属性描述和插入模板放在一起最直观。`attrs` 是纯数据（无脚本），随 `buildCfgJson` 的 `componentEntries` 序列化自动到达浏览器，无需修改 `buildExpandScripts` 或剥离逻辑。

**备选**：独立的顶层 `attributeConfig: Record<string, ComponentAttr[]>` map -- 更灵活（可覆盖原生 HTML 元素），但增加配置面，且与现有 `componentConfig` 形成两套配置来源，心智负担更大。本期不采纳。

### D2: `ComponentAttr` 字段集

```ts
interface ComponentAttr {
  name: string;          // 必填，属性名，如 "type"/"@click"/":value"
  label?: string;        // 人类可读标签，如 "类型"/"点击事件"
  defaultValue?: string; // 点击时填入的默认值，如 "primary"
  options?: string[];    // 可选值枚举，如 ["primary","default","dashed"]
  group?: string;        // 分组名，如 "属性"/"事件"/"插槽"
}
```

**理由**：`name` 是最小必要字段。`label` 提升可读性。`defaultValue` 让点选即得到合理初值。`options` 为后续增强（value 输入框变 select）预留，本期不在 UI 消费但写入类型定义。`group` 驱动抽屉分组渲染。

### D3: 抽屉 z-index 高于 prop panel

prop panel mask 的 z-index 为 9999。属性抽屉的 z-index SHALL 为 10001，其遮罩为 10000。这样抽屉覆盖在 prop panel 之上，prop panel 仍可见但不可交互（被遮罩挡住）。

**备选**：抽屉不用独立遮罩，直接挂在 prop panel 内部 -- 但 prop panel 是居中弹窗，右侧抽屉从 prop panel 边缘滑出视觉效果差，且 prop panel 宽度有限。独立遮罩 + 独立抽屉更清晰。

### D4: 点击属性 → 直接追加，抽屉保持打开

**选择**：点击属性条目立即往 `entries` push `{key: name, value: defaultValue ?? ""}`，然后 `renderList(list)` 刷新 prop panel，抽屉保持打开。

**理由**：用户通常一次补多个属性（如 `type` + `size` + `@click`），保持打开减少重复打开抽屉的次数。已存在的属性按 `key` 去重，不重复添加。

**备选**：
- 添加并关闭 -- 每次只加一个，频繁操作时繁琐
- 填入 prop panel 底部添加行 -- 需用户再手动点「＋ 添加」，多一步操作

### D5: 元素标签匹配用 `getElementTagName`

prop panel 打开时 `panelData.tag` 取的是 `el.tagName.toLowerCase()`。但 `getElementTagName(el)` 会优先读 `data-inspector-tag`（wrap 场景下可能被改写），回退到 `tagName.toLowerCase()`。抽屉匹配 SHALL 使用 `getElementTagName(el)` 的返回值与 `ComponentItem.tag` 比较，确保与组件展示标签一致。

### D6: 新增 `attr-drawer.ts` 模块

参照 `comp-drawer.ts` 的结构：模块级 `closeAttrDrawer()` / `openAttrDrawer()` 导出函数，模块级 `attrBackdrop` 变量管理遮罩，`state.attrDrawer` 持有抽屉 DOM 引用。prop panel 通过 `import { openAttrDrawer, closeAttrDrawer } from "./attr-drawer"` 调用。关闭 prop panel 时 SHALL 同时关闭属性抽屉（在 `closePanel()` 中调用 `closeAttrDrawer()`）。

## Risks / Trade-offs

- **[attrs 数据体积膨胀]** -> 每个 ComponentItem 多挂一组 `attrs`，`componentEntries` JSON 体积增大。但 `attrs` 是轻量字符串数组，典型组件 5-15 条属性，每条几十字节，整体增量在 KB 级，可接受。`expand` 脚本仍由 `buildExpandScripts` 独立注入，不进 JSON。

- **[抽屉与 prop panel 的关闭顺序]** -> 用户可能先开 prop panel 再开抽屉，如果直接关 prop panel 而不关抽屉，抽屉会悬空（`state.panelData` 被清空但抽屉仍引用旧数据）。**缓解**：`closePanel()` 中先调 `closeAttrDrawer()` 再清 prop panel。

- **[tag 匹配大小写]** -> `getElementTagName` 返回小写，`ComponentItem.tag` 在 antdv 等物料包中也是小写（如 `a-button`），天然匹配。但若用户自定义组件用了大写 tag（如 `MyButton`），需确保匹配前统一转小写。**缓解**：匹配时两侧都 `toLowerCase()`。

- **[options 字段预留但未消费]** -> 本期 `options` 只存类型定义中，UI 不渲染下拉。用户可能期望点选后 value 输入框变成 select。**缓解**：在 design 中明确标注为 Non-Goal，后续增强可单独提 change。
