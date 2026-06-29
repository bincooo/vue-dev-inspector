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
 * 在多根列表里找 `target` 所属的根。
 *
 * - 顺序遍历，第一个满足「target 等于 root 或以 root + sep 开头」的根胜出。
 * - 这种"先匹配先得"语义要求用户在配置时把更具体/更内层的根放在前面。
 * - 不在任一根下时返回 null。
 */
export function findProjectRoot(
  roots: string[],
  target: string,
): string | null {
  for (const root of roots) {
    const sep = root.endsWith(path.sep) ? "" : path.sep;
    if (target === root || target.startsWith(root + sep)) return root;
  }
  return null;
}

/**
 * 解析客户端发来的相对文件路径并校验安全边界 —— 多根版本。
 *
 * - 拒绝空 `file` 和绝对路径（防止客户端逃逸到注册根之外）。
 * - 顺序遍历 `projectRoots`，第一个 resolved 后落在对应根下（含等于/前缀）的胜出。
 * - 通过后返回 `{ root, absolutePath }`，调用方据此读盘。
 */
export function safePath(
  projectRoots: string[],
  file: string,
): { root: string; absolutePath: string } | null {
  if (!file) return null;
  if (path.isAbsolute(file)) return null;
  for (const root of projectRoots) {
    const candidate = path.resolve(root, file);
    const sep = root.endsWith(path.sep) ? "" : path.sep;
    if (candidate === root || candidate.startsWith(root + sep)) {
      return { root, absolutePath: candidate };
    }
  }
  return null;
}