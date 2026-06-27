# vite-plugin-vue-dev-inspector

基于 AST 的 Vue 编译插件 — 在开发模式下为每个 DOM 元素注入源码文件信息，支持鼠标悬停高亮和点击跳转编辑器。

## 特性

- 🌳 **AST 级别注入** — 使用 `@vue/compiler-sfc` 解析 AST，精确遍历 Element / If / For 等所有节点类型
- 📍 **精确定位** — 直接从 `node.loc` 读取行列号，精确到字符级别
- 🖱️ **交互审查** — Alt+Shift+I 开启审查模式，鼠标悬停高亮，点击跳转编辑器
- ⚡ **零生产影响** — 仅在 `vite serve` 时注入，生产构建完全无痕
- 📦 **单属性存储** — `data-source-file="path:line:col"` 合并存储

## 安装

```bash
pnpm add -D vite-plugin-vue-dev-inspector
```

## 使用

```ts
// vite.config.ts
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import vueDevInspector from "vite-plugin-vue-dev-inspector";

export default defineConfig({
  plugins: [vueDevInspector(), vue()],
});
```

## 配置选项

| 选项           | 类型       | 默认值                         | 说明               |
| -------------- | ---------- | ------------------------------ | ------------------ |
| `enabled`      | `boolean`  | `true`                         | 是否启用           |
| `exclude`      | `RegExp[]` | `[/node_modules/, /\.d\.ts$/]` | 排除文件           |
| `attrName`     | `string`   | `'data-source-file'`           | 注入的属性名       |
| `openInEditor` | `boolean`  | `true`                         | 点击是否跳转编辑器 |
| `editor`       | `string`   | `'vscode'`                     | 编辑器类型         |

## 工作原理

```
.vue SFC → parse() → compileTemplate() + nodeTransforms → walkNode() → MagicString 注入属性 → 客户端脚本高亮
```

## License

MIT
