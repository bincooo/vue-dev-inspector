// ⚠ 必须在所有其他 import 之前 —— 深度优先执行确保 CJS 缓存预热
// 早于 @dcloudio/vite-plugin-uni 污染的 @vue/shared@3.4.21
import "./priming";

import path from "node:path";
import fs from "node:fs";
import { createRequire } from "node:module";
import type { Plugin } from "vite";
import MagicString from "magic-string";
import {
  resolveProjectRootIndex,
  toPosixRelative,
  loadScript,
} from "../../utils/src/paths";
import { setCdnBuilder } from "../../utils/src/cdn";
import { createDevServer } from "../../client";
import { API_PREFIX, EDITOR_PROTOCOLS } from "@vue-dev-inspector/shared";
import { DEFAULT_OPTIONS } from "./options";
import type {
  DevInspectorOptions,
  UniDevInspectorOptions,
} from "./options";
import { createInspectorTransform } from "./transform";
import { resolvePlatform, isBrowserPlatform } from "./platform";
import { resolvePhoneShell, buildPhoneShellScript } from "./phone-shell";

// priming.ts 已将 @vue/shared@3.5.38 装入 CJS 缓存，这里直接走 createRequire
// 确保 transform() 使用的 parse/compileTemplate 拿到正确的 shared
const _require = createRequire(import.meta.url);
const { parse, compileTemplate } = _require("@vue/compiler-sfc");

// ─── 内联自 core 的纯 helper（移除 core 依赖后自给自足）──────────

/**
 * 编译后的 overlay 脚本（由 @vue-dev-inspector/overlay 子工程构建产生）。
 *
 * 懒加载单例 —— tsup 打包期 tree-shaking 静态分析；只有 dev 模式下
 * `transformIndexHtml` 实际触发时才读盘（非 dev / 非浏览器平台完全跳过）。
 *
 * `loadScript` 同步读盘，候选顺序：
 *   1. `./overlay.iife.js` —— uni build 时 `cp` 进 `dist/`，自包含命中；
 *   2. `../../overlay/dist/overlay.iife.js` —— monorepo 内直接取 overlay 产物。
 *
 * `import.meta.url` 经 tsup inline 后落在 `uni/dist/index.js`，两个相对候选
 * 都从该目录解析。
 */
let _overlayScript: string | null = null;
function loadOverlayScript(): string {
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
function offsetToLine(code: string, offset: number): number {
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
 * 必须取**磁盘文件**的行号，而非 transform 收到的 `code`：`enforce:"pre"`
 * 链中靠前的插件（如 unplugin-vue-setup-extend-plus、uni 的部分前置 transform）
 * 会在 `<template>` 之前前置注入内容，把 `<template>` 整体下推，使内存 code
 * 的 templateLine 偏大，进而把 data-source-file 的行号整体抬高（编辑器打开
 * 磁盘文件就会跳错行）。读盘失败（虚拟模块、权限等）返回 -1，调用方回落到
 * 内存 code 的偏移。
 */
function getDiskTemplate(
  diskPath: string,
): { line: number; content: string } | null {
  try {
    const diskCode = fs.readFileSync(diskPath, "utf8");
    const { descriptor, errors } = parse(diskCode, { filename: diskPath });
    if (errors.length || !descriptor.template) return null;
    return {
      line: offsetToLine(diskCode, descriptor.template.loc.start.offset),
      content: descriptor.template.content,
    };
  } catch {
    return null;
  }
}

/**
 * 构建内存 template.content → 磁盘 template.content 的**逐行映射**（0-based）。
 *
 * 前置插件（如 @uni-ku/root 把模板包进 `<global-ku-root>...</global-ku-root>`）
 * 会在模板**内部**注入额外行，使 compileTemplate 给的 `el.loc.start.line` 是
 * "内存行"而非"磁盘行"，导致注入的 data-source-file 行号整体偏移、editor 找不到元素。
 * `getDiskTemplateLine` 只修了 `<template>` 之前的下推，没修模板内部注入——这里补上。
 *
 * 内存 content = 磁盘 content + 注入行（前置插件只注入、不删除/修改行），所以磁盘行是
 * 内存行的子序列。贪心匹配即可：逐内存行比对当前磁盘行，相等则映射、推进磁盘指针；
 * 不等则该内存行是注入行（映射 -1）。
 *
 * 返回 `map[memLineIdx0] = diskLineIdx0`（均为 0-based），注入行为 -1。
 */
function buildDiskLineMap(memContent: string, diskContent: string): number[] {
  const mem = memContent.split("\n");
  const disk = diskContent.split("\n");
  const map = new Array<number>(mem.length).fill(-1);
  let di = 0;
  for (let mi = 0; mi < mem.length; mi++) {
    if (di < disk.length && mem[mi] === disk[di]) {
      map[mi] = di;
      di++;
    }
  }
  return map;
}


/** 构造运行时配置对象 (window.__DEV_INSPECTOR_CFG__) 的 JSON 字符串。 */
function buildCfgJson(
  options: Required<Omit<DevInspectorOptions, "projectRoots" | "expandCdn">>,
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
 */
function buildExpandScripts(componentConfig: { expand?: string }[]): string {
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

// ─── 插件 ─────────────────────────────────────────────────

/**
 * uni-app 版 Vue DevInspector Vite 插件。
 *
 * 编译/注入逻辑与 `@vue-dev-inspector/core` 的 `vueDevInspector` 等价
 * —— uni H5 走 `@vue/compiler-sfc` parse + compileTemplate 到真实 DOM，
 * `createInspectorTransform` 的 AST 行/列注入可原样复用。本包已把 core
 * 的相关 helper 内联，不再依赖 `@vue-dev-inspector/core`。
 *
 * 额外能力：
 *   - `phoneShell` 配置项注入虚拟 iPhone 外观（仅浏览器平台 + dev 模式）。
 *   - 平台区分：非浏览器平台（mp-\* / app / quickapp 等）下插件整体 no-op，
 *     overlay 无法运行也不污染产物。`platform` 选项可显式覆盖。
 *
 * 用法：`plugins: [uniDevInspector({...options}), ...uni()]`。
 */
export function uniDevInspector(opts: UniDevInspectorOptions = {}): Plugin {
  const { phoneShell: rawShell, platform: explicitPlatform, ...coreOpts } = opts;
  const options = { ...DEFAULT_OPTIONS, ...coreOpts };
  if (options.expandCdn) setCdnBuilder(options.expandCdn);
  let isDev = false;
  let projectRoots: string[] = [];

  const shell = resolvePhoneShell(rawShell);

  return {
    name: "vue-dev-inspector-uni",
    enforce: "pre",

    configResolved(config) {
      isDev = config.command === "serve";
      const userRoots = options.projectRoots;
      if (Array.isArray(userRoots) && userRoots.length > 0) {
        projectRoots = userRoots.map((p) => path.resolve(config.root, p));
      } else {
        projectRoots = [path.resolve(config.root)];
      }
    },

    configureServer(server) {
      if (!isDev || !options.enabled) return;
      // 惰性探测平台 —— overlay 仅在浏览器平台可运行；非浏览器平台不挂 dev server。
      const platform = resolvePlatform(explicitPlatform);
      if (!isBrowserPlatform(platform)) {
        server.config.logger.info(
          `[vdi-uni] 目标平台 "${platform}" 非浏览器平台，dev inspector 已跳过（overlay 仅支持 h5/web）`,
        );
        return;
      }
      createDevServer(server, projectRoots);
    },

    transform(code, id) {
      if (!isDev || !options.enabled) return null;
      // 非浏览器平台：不注入 data-source-file，保持 mp/app 产物干净。
      if (!isBrowserPlatform(resolvePlatform(explicitPlatform))) return null;
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
      // 取磁盘文件的 template 起始行号 + 磁盘 template.content。
      // 前置插件会把 <template> 下推、或在模板内部注入行（如 @uni-ku/root 包 <global-ku-root>），
      // 使内存 code 的行号/内容与磁盘不一致；editor 读的是磁盘文件，必须按磁盘对齐。
      // 读盘失败回落到内存 code 的偏移、且不做行映射（退化行为）。
      const disk = getDiskTemplate(id);
      const templateLine =
        disk != null ? disk.line : offsetToLine(code, template.loc.start.offset);
      // 行映射：内存 template.content → 磁盘 template.content（0-based，注入行=-1）。
      // compileTemplate 给的 el.loc.start.line 是"内存行"，需经此映射换算成"磁盘行"，
      // fileLine 才对得上磁盘文件（修 get-props 404 / open-in-editor 跳错行）。
      const diskLineMap =
        disk != null ? buildDiskLineMap(template.content, disk.content) : null;

      compileTemplate({
        source: template.content,
        filename: id,
        id,
        compilerOptions: {
          expressionPlugins: options.expressionPlugins,
          nodeTransforms: [
            createInspectorTransform(
              s,
              template,
              { rootIndex, relativePath },
              options.attrName,
              options.wrapComponents,
              templateLine,
              diskLineMap,
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
      // 非浏览器平台：无 HTML 浏览器上下文，不注入 overlay / phone-shell。
      if (!isBrowserPlatform(resolvePlatform(explicitPlatform))) return html;

      // phone shell 注入（在 overlay 脚本之前，先铺好壳避免遮挡）
      if (shell.enabled) html = html.replace("</body>", buildPhoneShellScript(shell) + "\n</body>");

      const overlayScript = loadOverlayScript();
      const cfgJson = buildCfgJson(options, projectRoots);
      const expandInjection = buildExpandScripts(options.componentConfig ?? []);
      const injection =
        `<script>window.__DEV_INSPECTOR_CFG__=${cfgJson};</script>\n` +
        `<script type="module">\n${overlayScript}\n</script>\n` +
        expandInjection;
      return html.replace("</body>", injection + "\n</body>");
    },
  };
}

export default uniDevInspector;
