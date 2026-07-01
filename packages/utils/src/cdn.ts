/**
 * CDN 脚本加载 —— loadScript cdn: scheme 的实现层。
 *
 * 物料库通过 `loadScript('cdn:<pkg>:<version>', './<relPath>')` 声明：
 * 「我要从 CDN 拉取这个包的这个文件作为 expand 拓展脚本」。
 * 但具体 CDN URL 怎么拼取决于用户环境 —— 用户在
 * `vueDevInspector({ cdn: (pkg, version) => '...' })` 中给出构造器。
 *
 * 该模块提供 builder 注入点（`setCdnBuilder` / `getCdnBuilder`），
 * 并封装一次 cdn fetch 调用。
 */
export type CdnBuilder = (pkg: string, version: string) => string | Promise<string>;

/** 模块级 builder 引用 —— 由 `@vue-dev-inspector/core` 在插件入口注入。 */
let _builder: CdnBuilder | undefined;

/** 注册/清空 cdn 构造器；用户没传 `cdn` 选项时 `_builder` 保持 undefined。 */
export function setCdnBuilder(builder: CdnBuilder | undefined): void {
  _builder = builder;
}

/** 读取当前 builder；未注册返回 undefined。 */
export function getCdnBuilder(): CdnBuilder | undefined {
  return _builder;
}

/**
 * 从 CDN 拉取指定包指定版本下的相对路径文件，返回文本内容。
 *
 * 拼 URL：`builder(pkg, version)` 返回值 + relPath（去掉前导 `./`）。
 * 例如 builder 返回 `https://cdn.jsdelivr.net/npm/jquery@3.7.0`，
 * relPath `./dist/jquery.min.js` → 最终 URL
 * `https://cdn.jsdelivr.net/npm/jquery@3.7.0/dist/jquery.min.js`。
 *
 * 网络失败抛 `[vdi] cdn fetch failed: <url>: <err>`。
 */
export async function loadCdnScript(
  pkg: string,
  version: string,
  relPath: string,
): Promise<string> {
  const builder = _builder;
  if (!builder) {
    throw new Error("[vdi] cdn builder 未注册；请在 vueDevInspector({ cdn }) 中提供");
  }
  const baseUrl = await builder(pkg, version);
  const cleaned = relPath.replace(/^\.\//, "");
  const finalUrl = cleaned ? `${baseUrl}/${cleaned}` : baseUrl;
  try {
    const res = await fetch(finalUrl);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return await res.text();
  } catch (err) {
    throw new Error(`[vdi] cdn fetch failed: ${finalUrl}: ${(err as Error).message}`);
  }
}