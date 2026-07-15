/**
 * 运行时配置对象 (`window.__DEV_INSPECTOR_CFG__`) 的序列化与 expand 拓展脚本拼接。
 *
 * 这组纯函数在 core 与 uni 中逐字重复，统一到此。两者行为完全一致，无平台差异。
 */
import { API_PREFIX, EDITOR_PROTOCOLS } from "@vue-dev-inspector/shared";

/**
 * DevInspector 选项的"已合并"形状（`Required<Omit<…, "projectRoots"|"expandCdn">>`）。
 * core 与 uni 各自定义 `DevInspectorOptions`，但合并后字段集合一致，故在此用结构化
 * 类型描述所需子集，避免 pluginkit 反向依赖 core/uni 的 options 模块。
 */
export interface ResolvedInspectorOptions {
  attrName: string;
  editor: "vscode" | "webstorm" | "atom" | "sublime";
  shortcut: {
    altKey?: boolean;
    shiftKey?: boolean;
    ctrlKey?: boolean;
    metaKey?: boolean;
    code: string;
  };
  toggleBtn: boolean;
  componentConfig?: { expand?: string }[];
}

/** 构造运行时配置对象 (window.__DEV_INSPECTOR_CFG__) 的 JSON 字符串。 */
export function buildCfgJson(
  options: ResolvedInspectorOptions,
  projectRoots: string[],
): string {
  // componentEntries 注入浏览器前需要先剥离 expand 字段：
  // 拓展脚本体可能含 "</script>" 等敏感字串且体积大，不进 JSON 反而更干净；
  // 插件自己负责把这些 expand 体追加到 <body> 末尾。
  const componentEntries = (options.componentConfig ?? []).map(
    ({ expand: _, ...rest }) => rest,
  );
  const cfg = {
    attrName: options.attrName,
    protocol: EDITOR_PROTOCOLS[options.editor] || EDITOR_PROTOCOLS.vscode,
    editor: options.editor,
    apiPrefix: API_PREFIX,
    tagAttr: "data-inspector-tag",
    /** @deprecated v2 起使用 projectRoots；保留为 projectRoots[0] 兼容 overlay 旧代码 */
    projectRoot: projectRoots[0] ?? "",
    projectRoots,
    shortcut: options.shortcut,
    toggleBtn: options.toggleBtn,
    componentEntries,
  };
  // 防御：snippet 字符串里若出现 "</script>" 会切断外层 HTML 的 <script> 块，
  // 全部转义成 <\/script>。JSON.stringify 已处理普通字符转义，仅需补这一刀。
  return JSON.stringify(cfg).replace(/<\/(script)/gi, "<\\/$1");
}

/**
 * 收集所有 ComponentConfigEntry.expand 拓展脚本（按声明顺序拼接）。
 * 空集合返回空串；每条 entry 按内容形态选一种注入方式：
 *
 *   - URL（`https?://...` 或 `//...`）：emit `<script type="module" src=...>`，
 *     由浏览器负责拉取；本模块不发起任何网络请求。
 *   - 其它（构建产物 IIFE/ESM 文本）：emit `<script type="module">…</script>`
 *     内联。
 *
 * 入参直接读 `options.componentConfig`，不再需要 `configResolved` 阶段
 * 预 await expand（cdn scheme 已是 URL 字符串同步返回，pkg:/本地 scheme
 * 也已同步）。
 */
export function buildExpandScripts(
  componentConfig: { expand?: string }[],
): string {
  const bodies = (componentConfig ?? [])
    .map((e) => e.expand ?? "")
    .filter((s) => s.length > 0);
  if (bodies.length === 0) return "";
  return (
    bodies
      .map((b) => {
        if (/^https?:\/\//.test(b) || /^\/\//.test(b)) {
          return `<script type="module" src="${b}"></script>`;
        }
        return `<script type="module">\n${b}\n</script>`;
      })
      .join("\n") + "\n"
  );
}
