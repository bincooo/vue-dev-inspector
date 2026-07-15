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

/**
 * 动态挂载组件（a-modal 等）的源码位置 class 通道。
 *
 * 这类组件经 Teleport/Portal 把真实 DOM 挂到 `document.body`，编译期注入的
 * `data-source-file` 会在挂载过程中丢失（fallthrough attrs 不随 Teleport 走）。
 * 但组件标签上的 `class` 属性会被组件库透传到挂载后的根元素（如 `.ant-modal`），
 * 因此改把位置信息编码成一个 class 名安全的 token 注入 `class`，运行时由 overlay
 * 解码后重新写回 `data-source-file` + `data-inspector-tag`。
 *
 * 编码：`tag \u0000 ref` 的 UTF-8 base64url（`+`->`-`、`/`->`_`、去 padding），
 * 仅含 `[A-Za-z0-9_-]`，作为 class 名安全。`\u0000`（NUL）分隔 tag 与 ref ——
 * tag 是合法标签名、ref 是 `rN:path:line:col`，二者都不含 NUL，即便文件名含空格
 * 也不会与分隔符冲突。
 *
 * `TextEncoder`/`TextDecoder` + `btoa`/`atob` 在 Node 18+ 与现代浏览器均为全局可用，
 * 因此 encode（pluginkit，Node 编译期）与 decode（overlay，浏览器运行期）共用同一份实现。
 */
export const SOURCE_CLASS_PREFIX = "__vdi-src-";

/** 把 `{ tag, ref }` 编码为带 `SOURCE_CLASS_PREFIX` 前缀的 class 名安全 token。 */
export function encodeSourceClass(tag: string, ref: string): string {
  const payload = tag + ":" + ref;
  return SOURCE_CLASS_PREFIX + payload;
}

/** 解码 `encodeSourceClass` 产出的 token；非本格式或解码失败返回 null。 */
export function decodeSourceClass(token: string): {
  tag: string;
  ref: string;
} | null {
  if (!token.startsWith(SOURCE_CLASS_PREFIX)) return null;
  const payload = token.slice(SOURCE_CLASS_PREFIX.length);
  const [tag, ...rest] = payload.split(":");
  return { tag, ref: rest.join(":") };
}
