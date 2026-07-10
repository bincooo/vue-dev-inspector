/**
 * overlay 端的通用 CDN 资源注入器。
 *
 * 与 packages/utils 的 cdn.ts 不同：
 *   - utils 是 build-time / core 插件用：拼 URL 后由 Vite 在 transformIndexHtml
 *     时以 <script type="module"> 注入；整个机制假设走构建管线。
 *   - 本文件是 overlay 运行时用：抽屉打开时才需要某些外部脚本/样式，需要在
 *     浏览器端动态 appendChild <script>/<link>，并保证同一 URL 只加载一次。
 *
 * 目前仅提供通用的 `injectOnce`（被 monaco.ts 复用）。v1 的高亮.js CDN loader
 * 已随「编辑代码」抽屉改用 Monaco 而移除。
 */

/** 已加载的 URL 集合，重复调用直接 resolve（避免重复 appendChild）。 */
const loaded = new Set<string>();

/**
 * 动态插入 <link> / <script> 到 <head>。已加载过则跳过。
 *
 *   - <script> 用 onload 回调等执行完成。
 *   - <link> 没有可靠 onload：默认立即 resolve（DOM 加载是异步但对我们只关心是否注册成功）。
 */
export function injectOnce(
  tag: "link" | "script",
  attrs: Record<string, string>,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const key = tag + ":" + JSON.stringify(attrs);
    if (loaded.has(key)) {
      resolve();
      return;
    }
    loaded.add(key);

    const el = document.createElement(tag) as
      | HTMLLinkElement
      | HTMLScriptElement;
    for (const [k, v] of Object.entries(attrs)) {
      el.setAttribute(k, v);
    }
    if (tag === "script") {
      (el as HTMLScriptElement).onload = () => resolve();
      (el as HTMLScriptElement).onerror = () =>
        reject(new Error("Failed to load " + attrs.src));
    } else {
      resolve();
    }
    document.head.appendChild(el);
  });
}
