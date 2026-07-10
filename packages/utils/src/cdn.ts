/**
 * CDN 脚本加载 —— loadScript cdn: scheme 的实现层。
 *
 * 物料库通过 `loadScript('cdn:<pkg>:<version>', './<relPath>')` 声明：
 * 「我要从 CDN 拉取这个包的这个文件作为 expand 拓展脚本」。
 * 但具体 CDN URL 怎么拼取决于用户环境 —— 用户在
 * `vueDevInspector({ cdn: (pkg, version) => '...' })` 中给出构造器。
 *
 * 该模块提供 builder 注入点（`setCdnBuilder` / `getCdnBuilder`），
 * 并把 cdn scheme 解析为 URL 字符串，由 core 在
 * `transformIndexHtml` 阶段以 `<script type="module" src=url>` 注入。
 * 模块本身不发起任何网络请求 —— 网络层由浏览器处理。
 */
export type CdnBuilder = (pkg: string, version: string) => string;

/** 模块级 builder 引用 —— 由 `@vue-dev-inspector/core` 在插件入口注入。 */
let _builder: CdnBuilder | undefined = (pkg, ver) => {
  return `//cdn.jsdelivr.net/npm/${pkg}@${ver}/dist/expand.iife.js`;
};

/** 注册/清空 cdn 构造器；用户没传 `cdn` 选项时 `_builder` 保持 undefined。 */
export function setCdnBuilder(builder: CdnBuilder | undefined): void {
  _builder = builder;
}

/** 读取当前 builder；未注册返回 undefined。 */
export function getCdnBuilder(): CdnBuilder | undefined {
  return _builder;
}

/**
 * 拼出 CDN 上的目标文件 URL —— 同步、纯字符串拼接、不发起任何网络请求。
 *
 * 拼 URL：`builder(pkg, version)` 返回值。
 * 例如 builder 返回 `https://cdn.jsdelivr.net/npm/jquery@3.7.0`，
 * `https://cdn.jsdelivr.net/npm/jquery@3.7.0/dist/jquery.min.js`。
 *
 * builder 未注册抛 `[vdi] cdn builder 未注册`。
 *
 * core 插件在 `transformIndexHtml` 检测到 expand 是 URL 后会直接以
 * `<script type="module" src="...">` 形式注入 —— 浏览器在加载页面时
 * 自然发起对 CDN 的请求，本模块不参与 IO。
 */
export function buildCdnUrl(pkg: string, version: string): string {
  const builder = _builder;
  if (!builder) {
    throw new Error(
      "[vdi] cdn builder 未注册；请在 vueDevInspector({ cdn }) 中提供",
    );
  }
  return builder(pkg, version);
}
