import type { Plugin } from "vite";
import path from "node:path";
import { parse, compileTemplate } from "@vue/compiler-sfc";
import MagicString from "magic-string";
import { createDevServer } from "@vue-dev-inspector/client";
import {
  resolveProjectRootIndex,
  toPosixRelative,
  setCdnBuilder,
} from "@vue-dev-inspector/utils";
import {
  createInspectorTransform,
  getDiskTemplateLine,
  offsetToLine,
  loadOverlayScript,
  buildCfgJson,
  buildExpandScripts,
} from "@vue-dev-inspector/pluginkit";
import type { DevInspectorOptions } from "./options";
import { DEFAULT_OPTIONS } from "./options";

// core / PC 场景直接 ESM import 取 npm 装的 @vue/compiler-sfc；
// 传给 pluginkit 的 getDiskTemplateLine 作为 SfcParser。
// （uni 走 createRequire + priming 隔离，不经此路径。）

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
      // 不再预 await expand -- loadScript cdn: scheme 已返回同步 URL 字符串，
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
      const diskLine = getDiskTemplateLine(parse, id);
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
              options.portalComponents,
              templateLine,
              // core/PC 无前置模板内部注入（无 @uni-ku/root），不做磁盘行映射
              null,
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
      return html
        .replace("<body>", "<body class='pc'>")
        .replace("</body>", injection + "\n</body>");
    },
  };
}

export default vueDevInspector;
