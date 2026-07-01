import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
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
 * 支持两种调用形式：
 *   loadScript(...candidates)
 *     相对 `import.meta.url` 解析（原始 API）。
 *     适用于直接调用方：例如 `core/dist/index.js` 这种**未被 bundle** 的真实
 *     文件路径场景，相对路径按 dist/ 目录解析。
 *
 *   loadScript('@vdi/<pkg>', ...candidates)
 *     以 `@vdi/<pkg>` 包根为锚点解析（pnpm 解析 + createRequire）。
 *     用于 esbuild / rollup 把本调用方打进另一个 bundle 之后 `import.meta.url`
 *     指向 bundle 文件（而非本包 dist/），相对路径全部失效的场景。
 *     典型例子：Vite 的 config loader 把 antdv 打进
 *     `demo/node_modules/.vite-temp/vite.config.ts.*.mjs`，此时
 *     `import.meta.url` 是临时 mjs 的 URL，相对 `./expand.iife.js` 自然找不到。
 *     `createRequire(import.meta.url).resolve('@vdi/antdv/package.json')`
 *     从 bundle URL 所在目录向上走 pnpm 的 node_modules，定位到 antdv 实体，
 *     再以 `dirname` 拿到 `antdv/dist/`，候选路径再按它解。
 *
 * 多个候选按顺序尝试，命中即返回；全部失败抛错。
 */
export function loadScript(...args: string[]): string {
  let baseDir: string | undefined;
  let candidates = args;

  // 可选包名前缀：第一个参数匹配 `@vdi/<pkg>` 时，把它当作包名解析
  if (args.length > 0 && /^@vdi\//.test(args[0])) {
    const pkgName = args[0];
    try {
      // 用 ESM 解析解到包 entry（dist/index.js 或 main 字段），
      // 再 dirname 两次（entry → dist/ → 包根）。这是因为：
      //   - createRequire(...).resolve(pkgName) 在 exports 只有 import/types
      //     没有 default 时会抛 "No exports main defined"。
      //   - createRequire(...).resolve(`${pkgName}/package.json`) 在 exports
      //     没暴露 ./package.json 时会抛 ERR_PACKAGE_PATH_NOT_EXPORTED。
      // import.meta.resolve 总能解出 entry（即便 ESM 也能用），不依赖 exports。
      const pkgEntryUrl = import.meta.resolve(pkgName);
      const pkgEntry = fileURLToPath(pkgEntryUrl);
      baseDir = path.dirname(path.dirname(pkgEntry));
      candidates = args.slice(1);
    } catch (err) {
      throw new Error(
        `[vdi] 未找到包 ${pkgName}：${(err as Error).message}`,
      );
    }
  }

  const here = baseDir ?? path.dirname(fileURLToPath(import.meta.url));
  for (const cd of candidates) {
    try {
      const p = path.isAbsolute(cd) ? cd : path.resolve(here, cd);
      return fs.readFileSync(p, "utf-8");
    } catch {
      // intentionally ignored
    }
  }
  throw new Error("[vdi] 未找到构建产物。");
}
