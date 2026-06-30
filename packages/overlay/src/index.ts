/**
 * overlay 入口。
 *
 * 编译为单个 IIFE JS 文件，由 @vdi/core
 * 读取并注入到 dev 模式的 HTML 中。
 *
 * 配置由插件设置 window.__DEV_INSPECTOR_CFG__。
 *
 * 样式注入：overlay 以 lib（IIFE）形式构建，Vite 不会把 CSS 内联进 JS
 * 产物，vite-plugin-singlefile 也只把 CSS 内联进 HTML chunk（lib 无 HTML
 * 入口），因此 `import './overlay.css'` 在最终产物里没有对应样式，运行时
 * __vdi-* 元素会"裸奔"。改用 `?inline` 把 CSS 作为字符串打进 IIFE，运行
 * 时手动注入 <style>。
 */
import cssText from "./overlay.css?inline";
import { init } from "./events";

/** 将 overlay 样式注入 document.head（幂等），@__vdi-* 类名才生效。 */
function injectStyle(): void {
  const STYLE_ID = "__vdi-overlay-style__";
  if (!cssText || document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = cssText;
  document.head.appendChild(style);
}

injectStyle();
init();
