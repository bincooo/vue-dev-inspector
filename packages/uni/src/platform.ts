/**
 * uni-app 目标平台探测与分类。
 *
 * 浏览器 overlay（IIFE 操作 DOM / document / window）只能在渲染到浏览器 DOM
 * 的平台上运行（`h5` / `web`）。小程序（`mp-*`）、App（`app` / `app-plus` /
 * `app-harmony`）、快应用（`quickapp-*`）等无 DOM，overlay 无法运行 —— 这些
 * 平台下插件整体 no-op，避免给 mp 产物注入无用 `data-source-file` 属性、
 * 挂无人调用的 dev server 中间件。
 *
 * 平台来源：`process.env.UNI_PLATFORM`，由 `@dcloudio/vite-plugin-uni` 的 CLI
 * 在 vite 启动前按 `-p <platform>` 设置（未传时 `initEnv` 默认 `'h5'`）。
 * 可在 `uniDevInspector({ platform })` 显式覆盖（调试用）。
 */

/** 渲染到浏览器 DOM、overlay 可运行的平台。 */
const BROWSER_PLATFORMS = new Set(["h5", "web"]);

/**
 * 解析当前目标平台。
 *
 * 优先用 options 显式传入；否则读 `process.env.UNI_PLATFORM`；都没有则回落 `'h5'`。
 *
 * **惰性求值**（在 `transform` / `transformIndexHtml` / `configureServer` 调用点
 * 才算）——本插件 `enforce:'pre'`，其 `configResolved` 早于 `@dcloudio/vite-plugin-uni`
 * 的 `configResolved`（后者在 `initEnv` 里才给 `UNI_PLATFORM` 兜底默认值）。
 * 在钩子调用点读取可彻底绕开这段时序，且 CLI 实际在 vite 启动前就已设好该变量。
 */
export function resolvePlatform(explicit?: string): string {
  return explicit || process.env.UNI_PLATFORM || "h5";
}

/** 该平台是否渲染到浏览器 DOM（overlay 可运行）。 */
export function isBrowserPlatform(platform: string): boolean {
  return BROWSER_PLATFORMS.has(platform);
}
