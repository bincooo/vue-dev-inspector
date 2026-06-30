import type { Plugin } from "vite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse, compileTemplate } from "@vue/compiler-sfc";
import MagicString from "magic-string";
import {
  API_PREFIX,
  EDITOR_PROTOCOLS,
  resolveProjectRootIndex,
  toPosixRelative,
} from "@vdi/shared";
import type { DevInspectorOptions } from "./options";
import { DEFAULT_OPTIONS } from "./options";
import { createInspectorTransform } from "./transform";
import { createDevServer } from "../../client";

/**
 * 编译后的 overlay 脚本（由 @vdi/overlay 子工程构建产生）。
 * 通过文件系统读取单文件 IIFE，避免在插件源码中以字符串形式拼脚本。
 */
const overlayScript = loadOverlayScript();

function loadOverlayScript(): string {
  // 当前插件源码位于 packages/core/src/plugin.ts，
  // overlay 产物位于 packages/overlay/dist/overlay.iife.js
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(here, './overlay.iife.js'),
    path.resolve(here, "../../overlay/dist/overlay.iife.js"),
  ];
  for (const p of candidates) {
    try {
      return fs.readFileSync(p, "utf-8");
    } catch {
      /* try next */
    }
  }
  throw new Error(
    "[vdi] 未找到 @vdi/overlay 的构建产物，" +
    "请先运行 `pnpm -C packages/overlay build`。",
  );
}

/** 构造运行时配置对象 (window.__DEV_INSPECTOR_CFG__) 的 JSON 字符串。 */
function buildCfgJson(
  options: Required<Omit<DevInspectorOptions, "projectRoots">>,
  projectRoots: string[],
): string {
  // 保留每个 entry（含 name），抽屉用 entry 渲染左侧竖列 tab。
  // 同一 entry 内部多 groups；切换 tab 即切换整组渲染。
  const componentEntries = options.componentConfig ?? [];
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
 * Vue DevInspector Vite 插件
 *
 * 基于 AST 遍历，在 dev 模式下为 DOM 元素注入源码位置属性，
 * 并注入客户端审查脚本 + 服务端 API。
 */
export function vueDevInspector(opts: DevInspectorOptions = {}): Plugin {
  const options = { ...DEFAULT_OPTIONS, ...opts };
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
    },

    configureServer(server) {
      if (isDev && options.enabled) createDevServer(server, projectRoots);
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
      const cfgJson = buildCfgJson(options, projectRoots);
      const injection = `<script>window.__DEV_INSPECTOR_CFG__=${cfgJson};</script>\n<script type="module">\n${overlayScript}\n</script>`;
      return html.replace("</body>", injection + "\n</body>");
    },
  };
}

export default vueDevInspector;
