import type { Plugin } from "vite";
import path from "node:path";
import fs from "node:fs";
import { parse, compileTemplate } from "@vue/compiler-sfc";
import MagicString from "magic-string";
import { API_PREFIX, EDITOR_PROTOCOLS } from "@vue-dev-inspector/shared";
import { createDevServer } from "@vue-dev-inspector/client";
import {
  resolveProjectRootIndex,
  toPosixRelative,
  loadScript,
} from "@vue-dev-inspector/utils";
import { setCdnBuilder } from "@vue-dev-inspector/utils";
import type { DevInspectorOptions } from "./options";
import { DEFAULT_OPTIONS } from "./options";
import { createInspectorTransform } from "./transform";

/**
 * 编译后的 overlay 脚本（由 @vue-dev-inspector/overlay 子工程构建产生）。
 * 通过文件系统读取单文件 IIFE，避免在插件源码中以字符串形式拼脚本。
 *
 * 用懒加载单例避免模块顶层 IO：tsup 打包期会做 tree-shaking
 * 静态分析；只有 dev 模式下 `transformIndexHtml` 实际触发时才会读盘
 * （非 dev 模式完全跳过 transformIndexHtml 钩子）。
 *
 * loadScript 已同步（cdn scheme 改成 URL-only 之后），所以这里用
 * 同步单例 + try/catch 即可，不需要 Promise 缓存。
 */
let _overlayScript: string | null = null;
export function loadOverlayScript(): string {
  if (_overlayScript == null) {
    _overlayScript = loadScript(
      "./overlay.iife.js",
      "../../overlay/dist/overlay.iife.js",
    );
  }
  return _overlayScript;
}

/**
 * 把字节偏移转成 1-based 行号（统计 `offset` 之前的换行符数量 + 1）。
 *
 * 用于把 AST 节点的相对偏移转换为 SFC 全文行号。当 AST 来源只覆盖了
 * template 内容（如 compileTemplate 重新解析），其 loc.start 是相对
 * template.content 的，把字节 offset 攒回全文时需要先把"该字节在全文里
 * 是第几行"算清楚，再补一行（1-based）。
 */
export function offsetToLine(code: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset && i < code.length; i++) {
    if (code[i] === "\n") line++;
  }
  return line;
}

/**
 * 磁盘文件中 `<template>` 内容起始行号（1-based）。
 *
 * `el.loc.start.line` 是相对 `template.content` 的，前置插件改的是 template
 * 之前的内容、不会动 template 内部，所以 astLine 在磁盘 / 内存中一致；
 * 只有 `templateLine` 需要回到磁盘取。列号同理不受影响（template 内容起始
 * 列通常为 0）。
 *
 * 与 `client/src/server.ts` 的处理器一致：每次直接 readFileSync + parse，
 * 不做缓存——dev 期文件反复变动，缓存命中率低且引入 mtime 精度风险，
 * 不值得。读盘失败（虚拟模块、权限等）返回 -1，调用方回落到内存 code 的偏移。
 */
function getDiskTemplateLine(diskPath: string): number {
  try {
    const diskCode = fs.readFileSync(diskPath, "utf8");
    const { descriptor, errors } = parse(diskCode, { filename: diskPath });
    if (errors.length || !descriptor.template) return -1;
    return offsetToLine(diskCode, descriptor.template.loc.start.offset);
  } catch {
    return -1;
  }
}

/** 构造运行时配置对象 (window.__DEV_INSPECTOR_CFG__) 的 JSON 字符串。 */
export function buildCfgJson(
  options: Required<Omit<DevInspectorOptions, "projectRoots" | "expandCdn">>,
  projectRoots: string[],
): string {
  // componentEntries 注入浏览器前需要先剥离 expand 字段：
  // 拓展脚本体可能含 "</script>" 等敏感字串且体积大，不进 JSON 反而更干净；
  // core 插件自己负责把这些 expand 体追加到 <body> 末尾。
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

/**
 * Vue DevInspector Vite 插件
 *
 * 基于 AST 遍历，在 dev 模式下为 DOM 元素注入源码位置属性，
 * 并注入客户端审查脚本 + 服务端 API。
 */
export function vueDevInspector(opts: DevInspectorOptions = {}): Plugin {
  const options = { ...DEFAULT_OPTIONS, ...opts };
  // 注入 cdn 构造器：用户配置 vueDevInspector({ cdn }) 时由 utils 模块的
  // loadScript('cdn:...') 消费。未配置时 _builder 保持 undefined，
  // loadScript('cdn:...') 调用会抛明确错误。
  if (options.expandCdn) setCdnBuilder(options.expandCdn);
  let isDev = false;
  let projectRoots: string[] = [];

  return {
    name: "vue-dev-inspector",
    enforce: "pre",

    configResolved(config) {
      isDev = config.command === "serve";
      const userRoots = options.projectRoots;
      if (Array.isArray(userRoots) && userRoots.length > 0) {
        // 相对路径以 config.root 为基准（与 monorepo 用户的目录直觉一致）
        projectRoots = userRoots.map((p) => path.resolve(config.root, p));
      } else {
        projectRoots = [path.resolve(config.root)];
      }
      // 不再预 await expand —— loadScript cdn: scheme 已返回同步 URL 字符串，
      // pkg:/本地 scheme 也是同步；expand 同步求值放在 transformIndexHtml。
    },

    configureServer(server) {
      if (isDev && options.enabled)
        createDevServer(server, projectRoots, options.componentConfig);
    },

    transform(code, id) {
      if (!isDev || !options.enabled) return null;
      if (!id.endsWith(".vue")) return null;
      if (options.exclude.some((re) => re.test(id))) return null;

      // 多根支持：只在声明的根下注入，避免越界文件被错误标记
      const rootIndex = resolveProjectRootIndex(projectRoots, id);
      if (rootIndex < 0) return null;

      const { descriptor, errors } = parse(code, { filename: id });
      if (errors.length || !descriptor.template) return null;

      const template = descriptor.template;
      const s = new MagicString(code);
      const relativePath = toPosixRelative(projectRoots[rootIndex], id);
      // template 内容在 SFC 文件中的起始行号（1-based）。
      // 当 <script> 在 <template> 上方时，AST 给出的 el.loc.start.line 是相对
      // template.content 的行号，必须加上这个偏移才能在编辑器里点准位置。
      //
      // 必须取**磁盘文件**的行号，而非 transform 收到的 `code`：`enforce:"pre"`
      // 链中靠前的插件（如 unplugin-vue-setup-extend-plus）会在 <template> 之前
      // 前置注入内容，把 <template> 整体下推，使内存 code 的 templateLine 偏大，
      // 进而把 data-source-file 的行号整体抬高（编辑器打开磁盘文件就会跳错行）。
      // 磁盘读失败时回落到内存 code 的偏移，保持旧行为。
      const diskLine = getDiskTemplateLine(id);
      const templateLine =
        diskLine >= 0
          ? diskLine
          : offsetToLine(code, template.loc.start.offset);

      compileTemplate({
        source: template.content,
        filename: id,
        id,
        compilerOptions: {
          // 透传 expressionPlugins，与 vue() 插件保持一致。
          // 否则内联表达式里只要含 TS/部分现代语法就会先在这里爆
          // "Error parsing JavaScript expression: Unexpected token"，
          // 阻断本插件的 nodeTransforms 注入。
          expressionPlugins: options.expressionPlugins,
          nodeTransforms: [
            createInspectorTransform(
              s,
              template,
              { rootIndex, relativePath },
              options.attrName,
              options.wrapComponents,
              templateLine,
            ),
          ],
        },
      });

      return s.hasChanged()
        ? {
          code: s.toString(),
          map: s.generateMap({
            source: id,
            includeContent: true,
            hires: true,
          }),
        }
        : null;
    },

    transformIndexHtml(html) {
      if (!isDev || !options.enabled) return html;
      const overlayScript = loadOverlayScript();
      const cfgJson = buildCfgJson(options, projectRoots);
      const expandInjection = buildExpandScripts(options.componentConfig ?? []);
      const injection =
        `<script>window.__DEV_INSPECTOR_CFG__=${cfgJson};</script>\n` +
        `<script type="module">\n${overlayScript}\n</script>\n` +
        expandInjection;
      return html.replace("<body>", "<body class='pc'>")
        .replace("</body>", injection + "\n</body>");
    },
  };
}

export default vueDevInspector;
