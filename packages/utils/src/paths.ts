import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import { buildCdnUrl } from "./cdn";
/**
 * 跨平台 POSIX 风格的相对路径转换（用于注入 `data-source-file` 等场景）。
 *
 * `path.relative` 在 Windows 上返回反斜杠分隔，注入到 HTML 属性里再被浏览器解析时
 * 反斜杠会被当作普通字符而不是路径分隔符，所以统一换成 `/`。
 */
export function toPosixRelative(root: string, absolutePath: string): string {
  return path.relative(root, absolutePath).split(path.sep).join("/");
}

/**
 * 在多根列表里找 `target` 所属的根（字符串）。顺序遍历命中即返回。
 *
 * - 与 `resolveProjectRootIndex` 行为一致，仅返回 root 字符串而非序号。
 * - 调用方大多已迁移到 `resolveProjectRootIndex`；该函数仅作对外兼容保留。
 */
export function findProjectRoot(
  roots: string[],
  target: string,
): string | null {
  const idx = resolveProjectRootIndex(roots, target);
  return idx < 0 ? null : roots[idx];
}

/**
 * 多根序号定位：在 projectRoots 中找 id 所属根的索引。
 *
 * - 顺序遍历，第一个满足「target 等于 root 或以 root + sep 开头」的根胜出。
 * - 不在任一根下时返回 -1。
 */
export function resolveProjectRootIndex(roots: string[], id: string): number {
  for (let i = 0; i < roots.length; i++) {
    const root = roots[i];
    const sep = root.endsWith(path.sep) ? "" : path.sep;
    if (id === root || id.startsWith(root + sep)) return i;
  }
  return -1;
}

/**
 * 加载构建产物。
 *
 * 支持三种调用形式：
 *
 *   1. loadScript(...candidates)
 *      相对 `import.meta.url` 解析（原始 API）。
 *      适用于直接调用方：例如 `core/dist/index.js` 这种**未被 bundle** 的真实
 *      文件路径场景，相对路径按 dist/ 目录解析。
 *
 *   2. loadScript('pkg:@vue-dev-inspector/<pkg>', ...candidates)
 *      以 `@vue-dev-inspector/<pkg>` 包根为锚点解析（pnpm 解析 + createRequire）。
 *      用于 esbuild / rollup 把本调用方打进另一个 bundle 之后 `import.meta.url`
 *      指向 bundle 文件（而非本包 dist/），相对路径全部失效的场景。
 *
 *   3. loadScript('cdn:<pkg>:<version>', ...candidates)
 *      CDN 模式。第一个参数形如 `cdn:@scope/name:1.2.3`；后续参数为
 *      包内相对路径（按声明顺序取第一个成功的）。本函数**只拼 URL，不下载**：
 *      返回值就是 CDN 上的目标文件 URL 字符串。core 插件在
 *      `transformIndexHtml` 阶段会以 `<script type="module" src="...">`
 *      形式注入，由浏览器负责拉取。
 *
 * 多个候选按顺序尝试，命中即返回；全部失败抛错。
 */
export function loadScript(...args: string[]): string {
  return loadScriptSpecifier(import.meta.resolve, ...args);
}

export function loadScriptSpecifier(
  resolve: (specifier: string) => string,
  ...args: string[]
): string {
  if (args.length === 0) {
    throw new Error("[vdi] loadScript: 至少需要一个参数");
  }

  // 形式 3：cdn scheme（必须在 pkg: 之前匹配，避免 cdn: 前缀被当成包名）
  const cdnMatch = /^cdn:([^:]+):([^:]+)$/.exec(args[0]);
  if (cdnMatch) {
    const pkg = cdnMatch[1];
    const version = cdnMatch[2];
    const candidates = args.slice(1);
    if (candidates.length === 0) {
      throw new Error("[vdi] loadScript(cdn:...) 至少需要一个相对路径参数");
    }
    // 走 buildCdnUrl 顺序尝试；cdn builder 未注册会在第一次尝试时抛错。
    // 因为现在只是 URL 拼装（无 IO），理论上不应失败 —— 但保留候选重试
    // 行为以便将来加 builder-side 校验（例如白名单）时无缝扩展。
    let lastErr: unknown;
    for (const cd of candidates) {
      try {
        return buildCdnUrl(pkg, version, cd);
      } catch (err) {
        lastErr = err;
      }
    }
    throw new Error(
      `[vdi] cdn 所有候选路径均失败: ${candidates.join(", ")}: ${(lastErr as Error)?.message ?? "unknown"}`,
    );
  }

  // 形式 2：包名锚点
  let baseDir: string | undefined;
  let candidates = args;
  if (args.length > 0 && /^pkg:/.test(args[0])) {
    const pkgName = args[0].split(":")[1];
    try {
      // 用 ESM 解析解到包 entry（dist/index.js 或 main 字段），
      // 再 dirname 两次（entry → dist/ → 包根）。这是因为：
      //   - createRequire(...).resolve(pkgName) 在 exports 只有 import/types
      //     没有 default 时会抛 "No exports main defined"。
      //   - createRequire(...).resolve(`${pkgName}/package.json`) 在 exports
      //     没暴露 ./package.json 时会抛 ERR_PACKAGE_PATH_NOT_EXPORTED。
      // import.meta.resolve 总能解出 entry（即便 ESM 也能用），不依赖 exports。
      const entry = resolve(pkgName);
      const pkg = fileURLToPath(entry);
      // dirname 两次：entry（dist/index.js） → dist/ → 包根
      baseDir = path.dirname(path.dirname(pkg));
      candidates = args.slice(1);
    } catch (err) {
      throw new Error(`[vdi] 未找到包 ${pkgName}: ${(err as Error).message}`);
    }
  }

  // 形式 1：本地 fs 读取
  const here = baseDir ?? path.dirname(fileURLToPath(import.meta.url));
  for (const cd of candidates) {
    try {
      const p = path.isAbsolute(cd) ? cd : path.resolve(here, cd);
      return fs.readFileSync(p, "utf-8");
    } catch {
      // intentionally ignored
    }
  }
  throw new Error(
    `[vdi] 未找到构建产物（候选：${candidates.join(", ")}）`,
  );
}
