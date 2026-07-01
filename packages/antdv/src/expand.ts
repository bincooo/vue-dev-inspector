/**
 * @vue-dev-inspector/antdv — 浏览器侧拓展脚本。
 *
 * 由 packages/antdv/vite.config.ts 打包为 dist/expand.iife.js，
 * antdv/src/index.ts 通过 `loadScript('./expand.iife.js')` 把本文件
 * 内容注入 ComponentConfigEntry.expand。core 插件在 dev 模式下
 * 把 expand 字符串追加到 transformIndexHtml 的 <body> 末尾。
 *
 * 时序：本脚本位于 overlay IIFE 之后加载（按 inject 顺序），
 * 共享层 addToolBtn / onInspect / onSelect 内部自带 host-ready 队列，
 * 脚本顶层调用能安全早于 host 安装完成，仅 flush 时机被 host-bridge
 * 用 16ms 轮询兜底。
 *
 * 这里的代码原本散落在 packages/demo/src/inspector-demo.ts，
 * 现迁移到物料库本体作为"开箱即用"演示。
 */
import { addToolBtn, onInspect, onSelect } from "@vue-dev-inspector/shared";

addToolBtn(
  {
    id: "antdv-demo-wrap",
    icon: "🤖",
    label: "ai助手",
    position: "right",
    onClick: (event) => {
      window.console.log("[antdv-demo] wrap clicked, source =", event.source);
    },
  },
);

onInspect(() => {
  window.console.log("[antdv-demo] enter inspect mode");
});

onSelect((event) => {
  window.console.log(
    "[antdv-demo] select",
    event.target?.tagName,
    event.source,
  );
});