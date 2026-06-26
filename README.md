## 基于 AST 遍历 精确定位 Vue 组件源码 设计器

通过 @vue/compiler-sfc 解析 AST，overlay 子工程独立编译审查 UI，pnpm monorepo 多包架构，可视化编辑属性 / 插入 / 删除。

安装：
```
pnpm add -D vite-plugin-vue-dev-inspector
```

demo:
```
pnpm run dev:demo
```

使用：
> 1. 组合键 `Ctrl+Alt+i` 进入审查模式
> 2. 右下角的齿轮按钮点击进入审查模式
> 3. 进入审查模式后可通过Esc按键退出模式

[在线体验](https://1i0k2-loc.hf.space/)

![](./public/2026-06-26_07-19.png)
