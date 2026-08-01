## Context

CodeSetter（`packages/overlay/src/setters/code-setter.ts`）在 `build()` 中懒加载 Monaco，创建 model + 内联 editor 绑定 `entry.value`。editor 挂在 `__vdi-prop-code-wrap` 容器内，fontSize 12、无行号、无 minimap。model 和 editor 的 dispose 通过 `__vdiCleanup` 在 setter 切换/面板关闭时触发。见 `proposal.md` 了解动机。

## Goals / Non-Goals

**Goals:**
- CodeSetter 行内编辑器右上角添加齿轮按钮，点击弹出大尺寸 Monaco 编辑器浮动窗口。
- 浮动窗口与行内编辑器共享 `ITextModel`，实时同步。
- 关闭浮动窗口仅释放浮动 editor，不释放 model。

**Non-Goals:**
- 不改变行内编辑器的尺寸或配置。
- 不改变 `entry.value` 数据流。
- 不为其他 setter 添加弹出窗口。
- 不实现浮动窗口的拖拽调整大小（固定 70vw × 70vh）。

## Decisions

### D1: 共享 ITextModel（非双 model 同步）

浮动窗口创建新 editor 实例时传入行内编辑器的同一个 `ITextModel`。Monaco 原生支持同 model 多 editor--任一 editor 编辑，另一 editor 自动同步光标和内容。

**备选**：浮动窗口创建独立 model，双方通过 `onDidChangeContent` + `setValue` 互相同步。**否决**：需手动处理循环触发、光标位置丢失；共享 model 零成本同步。

**实现**：`build()` 在 Monaco 加载成功后，将 model 引用存到容器的 `__vdiModel` 属性上，齿轮按钮的 click handler 从容器取 model 创建浮动 editor。

### D2: 齿轮按钮 DOM 结构

在 `__vdi-prop-code-wrap` 容器内添加一个绝对定位的按钮：

```html
<div class="__vdi-prop-code-wrap">
  <button class="__vdi-prop-code-expand" title="大窗口编辑">⚙</button>
  <!-- Monaco editor 挂载点 -->
</div>
```

- `.__vdi-prop-code-wrap`：已有 `position: relative`（需确认，若无则添加）。
- `.__vdi-prop-code-expand`：`position: absolute; top: 2px; right: 2px; z-index: 10`，半透明背景，hover 高亮。
- Monaco 加载失败时按钮不添加（在 `.then()` 回调内创建，`.catch()` 不创建）。

### D3: 浮动窗口 DOM 结构与样式

```html
<div class="__vdi-code-popout-mask">
  <div class="__vdi-code-popout">
    <div class="__vdi-code-popout-header">
      <span>代码编辑</span>
      <button class="__vdi-code-popout-close">✕</button>
    </div>
    <div class="__vdi-code-popout-body"><!-- Monaco editor --></div>
  </div>
</div>
```

- `.__vdi-code-popout-mask`：`position: fixed; inset: 0; z-index: 10001; background: rgba(0,0,0,.45)`，点击遮罩关闭。
- `.__vdi-code-popout`：`width: 70vw; height: 70vh; margin: 15vh auto; background: #1e1e1e; border-radius: 8px; overflow: hidden; display: flex; flex-direction: column`。
- `.__vdi-code-popout-header`：`height: 36px; padding: 0 12px; display: flex; justify-content: space-between; align-items: center; color: #ccc; border-bottom: 1px solid #333`。
- `.__vdi-code-popout-body`：`flex: 1; position: relative`（Monaco 容器）。
- 浮动 editor 配置比行内更宽松：`fontSize: 14`、`lineNumbers: "on"`、`minimap: { enabled: true }`。

### D4: 关闭时仅 dispose 浮动 editor

浮动窗口关闭时调用 `floatingEditor.dispose()`，**不**调用 `model.dispose()`（model 仍被行内 editor 使用）。浮动窗口的 DOM 从 body 移除。不触发 `__vdiCleanup`（那是行内 editor 的清理）。

## Risks / Trade-offs

- **[z-index 层级]** 浮动窗口需高于 prop panel mask（`__vdi-panel-mask`）和 attr drawer。**缓解**：使用 `z-index: 10001`，高于现有所有层。
- **[同 model 多 editor 内存]** 两个 editor 共享 model 不会翻倍内存（model 是内容主体，editor 只是视图）。**缓解**：关闭浮动窗口时 dispose editor 释放视图资源。
- **[Monaco 未加载完时点齿轮]** 齿轮按钮在 Monaco `.then()` 回调内创建，加载完成前不存在。**缓解**：无需额外防护。
