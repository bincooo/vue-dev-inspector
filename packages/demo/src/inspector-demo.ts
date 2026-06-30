/**
 * Inspector 扩展能力 demo 注册（在浏览器 console 看到按钮点击事件流）。
 * 单独拆出 .ts 以避开 vue 单文件组件的 no-undef 限制（window 全局）。
 */

import { addToolBtn } from "@vdi/core";

addToolBtn(
  {
    id: "demo-wrap",
    icon: "📦",
    label: "demo: 包一层div",
    position: "right",
    onClick: (e) => {
      window.console.log("[demo] wrap clicked, source =", e.source);
    },
  },
  {
    id: "demo-goto",
    icon: "🔗",
    label: "demo: 跳转 API",
    position: "right",
    onClick: (e) => {
      window.console.log("[demo] goto clicked, source =", e.source);
    },
  },
);
