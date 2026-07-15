/**
 * `data-source-file` 属性值的编码格式与解析正则。
 *
 * 格式：`r<rootIndex>:<posixRelativePath>:<line>:<col>`
 *   - rootIndex: 非负整数（projectRoots 序号，0-based）
 *   - path: posix 相对路径（由 `toPosixRelative` 产出，无冒号 -- Windows 也已转成 `/`）
 *   - line: 1-based；col: 0-based
 *
 * core 注入（transform 的 formatSourceRef）、client 解析（server.ts parseSource）、
 * overlay 解析（utils.ts parsePosition）三方共用此正则，保证编码/解码同源。
 * 任何不匹配（含旧无前缀格式、缺段、path 含冒号）一律不匹配。
 *
 * path 段用 `[^:]+` 而非 `.+`：posix 相对路径不含冒号，`[^:]+` 更严格，
 * 能拦住 `r0:C:\x:1:2` 这类异常输入（服务端另行 `path.isAbsolute` 校验）。
 */
export const SOURCE_REF_RE = /^r(\d+):([^:]+):(\d+):(\d+)$/;
