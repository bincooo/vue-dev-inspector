## Context

overlay CSS（`packages/overlay/src/overlay.css`，~1100 行）当前全量硬编码样式值：`border-radius: 3px`、单层 `box-shadow: 0 20px 60px rgba(0,0,0,0.25)`、`backdrop-filter: blur(1px)`、线性 `transition: background 0.12s`。齿轮按钮的 hover/opacity 由 JS 内联 `style.opacity`/`style.transform` 手动操控（`events.ts:478-485`），与 CSS 的 `:hover` 伪类并行存在但互相覆盖。

## Goals / Non-Goals

**Goals:**
- 引入 CSS 自定义属性（设计令牌），集中管理圆角/阴影/颜色/过渡，后续调参一处生效
- 圆角、阴影、毛玻璃、过渡曲线全面现代化，观感对齐 2025 年主流 devtools
- 齿轮按钮 hover/opacity 行为从 JS 内联迁移到 CSS `:hover`，消除 JS/CSS 双头操控
- 保持全部 CSS 选择器结构与 `__vdi-` class 命名不变，不影响 JS 逻辑

**Non-Goals:**
- 不引入 CSS 框架或预处理器（保持纯 CSS，IIFE 内联注入）
- 不增加暗色模式 / 主题切换（令牌化为未来预留，但本期不做）
- 不修改 DOM 结构或新增/删除 class
- 不修改任何交互行为（事件、状态、API 调用全部不变）
- 不修改 uni phone-shell 的 CSS（那是平台专属外观，独立维护）

## Decisions

### D1: 设计令牌定义在 `:root` 上

在 `overlay.css` 顶部用 `:root` 块集中定义令牌，全文件用 `var(--vdi-*)` 引用：

```css
:root {
  /* 圆角 */
  --vdi-radius-sm: 4px;   /* 徽章、小标签 */
  --vdi-radius-md: 6px;   /* 输入框、按钮 */
  --vdi-radius-lg: 8px;   /* 卡片、抽屉、菜单 */
  --vdi-radius-full: 9999px; /* 圆形按钮 */

  /* 阴影 -- 2 层叠加 */
  --vdi-shadow-sm: 0 1px 2px rgba(0,0,0,0.05), 0 1px 3px rgba(0,0,0,0.08);
  --vdi-shadow-md: 0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -2px rgba(0,0,0,0.05);
  --vdi-shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.08), 0 4px 6px -4px rgba(0,0,0,0.05);
  --vdi-shadow-xl: 0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.06);

  /* 过渡 */
  --vdi-ease: cubic-bezier(0.4, 0, 0.2, 1);
  --vdi-duration: 0.18s;

  /* 颜色 -- 主色 */
  --vdi-primary: #3b82f6;
  --vdi-primary-hover: #2563eb;

  /* 毛玻璃 */
  --vdi-blur-sm: 4px;
  --vdi-blur-md: 6px;
  --vdi-blur-lg: 8px;
}
```

**理由**：`:root` 定义后，overlay IIFE 注入的 `<style>` 标签内令牌全局可用。不额外加 `.__vdi-overlay-scope` 作用域选择器，因为 `__vdi-` 前缀已做命名隔离，令牌名也带 `--vdi-` 前缀不会与宿主冲突。

**备选**：定义在 overlay 容器 class 上（如 `.__vdi-root`）做作用域隔离 -- 但需要 JS 在容器上挂 class，增加耦合，且 `:root` 级别的 `--vdi-*` 前缀已足够隔离。

### D2: 阴影用 2 层叠加替代单层重阴影

当前 `box-shadow: 0 20px 60px rgba(0,0,0,0.25)` 是单层重投影，视觉生硬。改为 2 层叠加：
- 近层：小偏移、低模糊、低透明度 -- 营造贴近感
- 远层：大偏移、高模糊、更低透明度 -- 营造空间感

**映射**：
| 原阴影 | 新令牌 |
|---|---|
| `0 1px 4px rgba(...,0.35)` (action btn) | `--vdi-shadow-sm` |
| `0 8px 24px rgba(0,0,0,0.15)` (菜单) | `--vdi-shadow-md` |
| `0 2px 10px rgba(...,0.35)` (齿轮) | `--vdi-shadow-md` |
| `-8px 0 32px rgba(0,0,0,0.15)` (抽屉) | `--vdi-shadow-lg`（改为左侧方向） |
| `0 20px 60px rgba(0,0,0,0.25)` (prop card) | `--vdi-shadow-xl` |

### D3: 齿轮按钮 hover 迁移到 CSS

当前 `events.ts:478-485` 用 JS 内联 `style.opacity`/`style.transform` 控制 hover。迁移到 CSS 后：
- CSS `. __vdi-gear-btn` 设 `opacity: 0.7; transform: scale(1)`
- CSS `:hover` 设 `opacity: 1; transform: scale(1.1)`
- CSS `:active` 设 `transform: scale(0.95)`
- JS 删除 `gearButton.style = "opacity: 0.7;transform: scale(1)"` 及 `onmouseenter`/`onmouseleave` 内联赋值

**理由**：CSS `:hover` 伪类比 JS 事件更高效（不占主线程），且与其它按钮的 hover 行为统一。JS 仅保留 `onclick` 和 `display: none/flex` 切换。

### D4: 抽屉圆角 -- 仅外侧（左侧）圆角

抽屉贴右侧屏幕边缘，仅左上 + 左下圆角 `8px`，右侧保持直角：

```css
.__vdi-drawer, .__vdi-code-drawer, .__vdi-attr-drawer {
  border-radius: 8px 0 0 8px;
}
```

### D5: 自定义滚动条

在抽屉列表和 prop panel body 上加细窄滚动条：

```css
.__vdi-prop-body::-webkit-scrollbar,
.__vdi-drawer-list::-webkit-scrollbar,
.__vdi-attr-drawer-list::-webkit-scrollbar {
  width: 6px;
}
.__vdi-prop-body::-webkit-scrollbar-thumb,
.__vdi-drawer-list::-webkit-scrollbar-thumb,
.__vdi-attr-drawer-list::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 3px;
}
.__vdi-prop-body::-webkit-scrollbar-track,
.__vdi-drawer-list::-webkit-scrollbar-track,
.__vdi-attr-drawer-list::-webkit-scrollbar-track {
  background: transparent;
}
```

### D6: 按钮变体统一

| 变体 | 用途 | 样式 |
|---|---|---|
| primary | 保存、添加 | `background: var(--vdi-primary)` / hover: `--vdi-primary-hover` |
| secondary | 属性、编辑 | `background: #e2e8f0` / hover: `#cbd5e1` |
| danger | 删除 | `background: #ef4444` / hover: `#dc2626` |
| ghost | 关闭(✕)、取消 | `background: transparent` / hover: `#f1f5f9` |

所有按钮统一 `border-radius: var(--vdi-radius-md)` + `transition: all var(--vdi-duration) var(--vdi-ease)`。hover 补 `transform: translateY(-1px)` 微上浮 + 阴影增强。

## Risks / Trade-offs

- **[宿主页面 CSS 变量冲突]** -> `:root` 上定义的 `--vdi-*` 变量理论上可能被宿主页面的 `:root` 变量覆盖。**缓解**：所有令牌名带 `--vdi-` 前缀，与通用命名（如 `--primary`）不冲突。且 overlay 的 `<style>` 注入在 `<head>` 末尾，优先级高于宿主早期 `<style>`。

- **[CSS 变量在旧浏览器不支持]** -> `var()` 需要 IE 不支持（但 overlay 本身用 `backdrop-filter` 等 modern CSS，目标浏览器已是 Chrome 76+/Safari 9+）。可接受。

- **[齿轮按钮 JS 内联清理可能遗漏]** -> `events.ts:478` 的 `gearButton.style = "..."` 是一次性赋值，删除后需确保 CSS 初始值 `opacity: 0.7` 正确生效。**缓解**：CSS 中 `. __vdi-gear-btn` 设 `opacity: 0.7` 作为默认值，`:hover` 覆盖为 1。

- **[滚动条样式仅 WebKit]** -> `::-webkit-scrollbar` 在 Firefox 不生效。**缓解**：Firefox 保持原生滚动条，不影响功能。可补 `scrollbar-width: thin; scrollbar-color: #cbd5e1 transparent;` 作为 Firefox 回退。

- **[视觉回归风险]** -> 大量样式值变更可能导致个别组件在边缘情况下排版异常。**缓解**：按区域分批修改（令牌 -> 遮罩/面板 -> 菜单 -> 抽屉 -> 按钮），每批改完重建 overlay 验证。
