/**
 * overlay 端的 CDN 脚本加载器。
 *
 * 与 packages/utils 的 cdn.ts 不同：
 *   - utils 是 build-time / core 插件用：拼 URL 后由 Vite 在 transformIndexHtml
 *     时以 <script type="module"> 注入；整个机制假设走构建管线。
 *   - 本文件是 overlay 运行时用：抽屉打开时才需要 highlight.js，需要在
 *     浏览器端动态 appendChild <script>，并保证同一 URL 只加载一次。
 *
 * v1 实现固定走 cdnjs；后续可接入与 core 一致的 cdn 配置。
 *
 * 关键选择说明：
 *   - jsdelivr 的 `lib/core.min.js` / `lib/common.min.js` 末尾都带
 *     `module.exports = hljs`，是 CJS 包，在浏览器里直接 <script src>
 *     加载会抛 `Uncaught ReferenceError: module is not defined`，
 *     且 core 包不带任何语言定义。
 *   - cdnjs 上的 `highlight.min.js` 是真正的 IIFE：开头的
 *     `var hljs = function(){...}()` 立即执行，末尾的 CJS 兜底用
 *     `typeof exports && typeof module && ...` 守卫，浏览器里两
 *     个 typeof 都返回 undefined，整段被跳过，不会报错。该 bundle
 *     内置了 JavaScript / CSS / TypeScript / JSON 等常用语言。
 */

const HIGHLIGHT_VERSION = "11.10.0";

/**
 * cdnjs 的 highlight.min.js — 单一 IIFE bundle，浏览器全局得到 `hljs`。
 * 内置 JavaScript / TypeScript / CSS / SCSS / JSON / Bash 等 30+ 常见语言。
 */
const HIGHLIGHT_BUNDLE = `https://cdnjs.cloudflare.com/ajax/libs/highlight.js/${HIGHLIGHT_VERSION}/highlight.min.js`;

/**
 * highlight.js 主题样式（atom-one-light 偏 Vue 官方风格；浅色背景适用 textarea 白色底）。
 */
const HIGHLIGHT_THEME = `https://cdnjs.cloudflare.com/ajax/libs/highlight.js/${HIGHLIGHT_VERSION}/styles/atom-one-light.min.css`;

/** 已加载的 URL 集合，重复调用直接 resolve（避免重复 appendChild）。 */
const loaded = new Set<string>();

/**
 * 动态插入 <link> / <script> 到 <head>。已加载过则跳过。
 *
 *   - <script> 用 onload 回调等执行完成；window.hljs 在 onload 后可用。
 *   - <link> 没有可靠 onload：默认立即 resolve（DOM 加载是异步但对我们只关心是否注册成功）。
 */
function injectOnce(tag: "link" | "script", attrs: Record<string, string>): Promise<void> {
  return new Promise((resolve, reject) => {
    const key = tag + ":" + JSON.stringify(attrs);
    if (loaded.has(key)) {
      resolve();
      return;
    }
    loaded.add(key);

    const el = document.createElement(tag) as HTMLLinkElement | HTMLScriptElement;
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

/**
 * 加载 highlight.js 与默认 CSS；重复调用幂等。
 *
 * @returns hljs 全局对象（已注册的语法高亮器）。
 */
export async function loadHighlighter(): Promise<{
  highlight: (
    code: string,
    options: { language: string; ignoreIllegals?: boolean },
  ) => { value: string };
}> {
  await Promise.all([
    injectOnce("link", {
      rel: "stylesheet",
      href: HIGHLIGHT_THEME,
    }),
    injectOnce("script", { src: HIGHLIGHT_BUNDLE }),
  ]);
  const hljs = (window as unknown as {
    hljs?: {
      highlight: (
        code: string,
        options: { language: string; ignoreIllegals?: boolean },
      ) => { value: string };
      registerLanguage: (name: string, lang: unknown) => void;
      getLanguage: (name: string) => unknown;
    };
  }).hljs;
  if (!hljs) {
    throw new Error("highlight.js failed to attach window.hljs");
  }
  return hljs;
}

/**
 * 按 kind 把内容映射到 highlight.js 的语言名。
 * v1 仅两种；多块 / 多语言的扩展可后续在此处加 switch。
 */
export function languageFor(kind: "script" | "style"): string {
  return kind === "script" ? "javascript" : "css";
}