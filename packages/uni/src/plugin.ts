// ⚠ 必须在所有其他 import 之前 —— 深度优先执行确保 CJS 缓存预热
// 早于 @dcloudio/vite-plugin-uni 污染的 @vue/shared@3.4.21
import "./priming";

import path from "node:path";
import { createRequire } from "node:module";
import type { Plugin } from "vite";
import MagicString from "magic-string";
import {
  resolveProjectRootIndex,
  toPosixRelative,
  setCdnBuilder,
} from "@vue-dev-inspector/utils";
import { createDevServer } from "@vue-dev-inspector/client";
import {
  DEFAULT_OPTIONS,
  createInspectorTransform,
  offsetToLine,
  buildCfgJson,
  buildExpandScripts,
  loadOverlayScript,
} from "@vue-dev-inspector/core";
import { resolvePhoneShell, buildPhoneShellScript } from "./phone-shell";
import type { UniDevInspectorOptions } from "./options";

// priming.ts 已将 @vue/shared@3.5.38 装入 CJS 缓存，这里直接走 createRequire
// 确保 transform() 使用的 parse/compileTemplate 拿到正确的 shared
const _require = createRequire(import.meta.url);
const { parse, compileTemplate } = _require("@vue/compiler-sfc");

/**
 * uni-app H5 版 Vue DevInspector Vite 插件。
 *
 * 编译/注入逻辑与 `@vue-dev-inspector/core` 的 `vueDevInspector` 等价
 * —— uni H5 走 `@vue/compiler-sfc` parse + compileTemplate 到真实 DOM，
 * `createInspectorTransform` 的 AST 行/列注入可原样复用。
 *
 * 额外能力：`phoneShell` 配置项注入虚拟 iPhone 外观（仅 dev 模式）。
 *
 * 用法：`plugins: [uniDevInspector({...options}), ...uni()]`。
 */
export function uniDevInspector(opts: UniDevInspectorOptions = {}): Plugin {
  const { phoneShell: rawShell, ...coreOpts } = opts;
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
      if (isDev && options.enabled) createDevServer(server, projectRoots);
    },

    transform(code, id) {
      if (!isDev || !options.enabled) return null;
      if (!id.endsWith(".vue")) return null;
      if (options.exclude.some((re) => re.test(id))) return null;

      const rootIndex = resolveProjectRootIndex(projectRoots, id);
      if (rootIndex < 0) return null;

      const { descriptor, errors } = parse(code, { filename: id });
      if (errors.length || !descriptor.template) return null;

      const template = descriptor.template;
      const s = new MagicString(code);
      const relativePath = toPosixRelative(projectRoots[rootIndex], id);
      const templateLine = offsetToLine(code, template.loc.start.offset);

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