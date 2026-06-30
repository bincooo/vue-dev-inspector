import path from "node:path";

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
 * 解析 `rN:<relativePath>:<line>:<col>` 格式的 source 字符串。
 *
 * - N 为非负整数（0-based，对应 projectRoots 序号）。
 * - 任何不匹配（含旧无前缀格式、缺段、行/列非整数）一律返回 null。
 * - 拒绝绝对路径（file 不能以 `/` 或盘符开头，避免客户端越权写入）。
 */
const SOURCE_RE = /^r(\d+):([^:]+):(\d+):(\d+)$/;

export interface SourceRef {
  rootIndex: number;
  file: string;
  line: number;
  col: number;
}

export function parseSource(value: string): SourceRef | null {
  if (!value) return null;
  const m = SOURCE_RE.exec(value);
  if (!m) return null;
  const rootIndex = Number(m[1]);
  const file = m[2];
  const line = Number(m[3]);
  const col = Number(m[4]);
  if (path.isAbsolute(file)) return null;
  return { rootIndex, file, line, col };
}

/**
 * 解析客户端发来的 source 引用并校验安全边界 —— 多根精确版本。
 *
 * - 直接定位 `projectRoots[ctx.rootIndex]`，拒绝越界。
 * - 拒绝空 `file` 与绝对路径（防止客户端逃逸到注册根之外）。
 * - 校验 `path.resolve(root, file)` 落在对应根范围内。
 */
export function safePath(
  projectRoots: string[],
  ctx: { rootIndex: number; file: string },
): { root: string; absolutePath: string } | null {
  if (!ctx.file) return null;
  if (path.isAbsolute(ctx.file)) return null;
  const root = projectRoots[ctx.rootIndex];
  if (!root) return null;
  const candidate = path.resolve(root, ctx.file);
  const sep = root.endsWith(path.sep) ? "" : path.sep;
  if (candidate === root || candidate.startsWith(root + sep)) {
    return { root, absolutePath: candidate };
  }
  return null;
}
