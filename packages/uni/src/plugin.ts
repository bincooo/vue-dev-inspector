// ⚠ 必须在所有其他 import 之前 -- 深度优先执行确保 CJS 缓存预热
// 早于 @dcloudio/vite-plugin-uni 污染的 @vue/shared@3.4.21
import "./priming";

import path from "node:path";
import { createRequire } from "node:module";
import type { Plugin } from "vite";
import MagicString from "magic-string";
import { createDevServer } from "@vue-dev-inspector/client";
import {
  resolveProjectRootIndex,
  toPosixRelative,
  setCdnBuilder,
} from "@vue-dev-inspector/utils";
import {
  createInspectorTransform,
  getDiskTemplate,
  offsetToLine,
  buildDiskLineMap,
  loadOverlayScript,
  buildCfgJson,
  buildExpandScripts,
} from "@vue-dev-inspector/pluginkit";
import { DEFAULT_OPTIONS } from "./options";
import type { UniDevInspectorOptions } from "./options";
import { resolvePlatform, isBrowserPlatform } from "./platform";
import { resolvePhoneShell, buildPhoneShellScript } from "./phone-shell";

// priming.ts 已将 @vue/shared@3.5.38 装入 CJS 缓存，这里直接走 createRequire
// 确保 transform() 使用的 parse/compileTemplate 拿到正确的 shared。
// parse 同样经此路径取，作为 SfcParser 注入 pluginkit 的 getDiskTemplate --
// 保证读盘解析与 transform 用的 compileTemplate 来自同一份 compiler-sfc。
const _require = createRequire(import.meta.url);
const { parse, compileTemplate } = _require("@vue/compiler-sfc");

// ─── 插件 ─────────────────────────────────────────────────

/**
 * uni-app 版 Vue DevInspector Vite 插件。
 *
 * 编译/注入逻辑与 `@vue-dev-inspector/core` 的 `vueDevInspector` 等价
 * -- uni H5 走 `@vue/compiler-sfc` parse + compileTemplate 到真实 DOM，
 * `createInspectorTransform` 的 AST 行/列注入统一来自 `@vue-dev-inspector/pluginkit`。
 * 本包仅保留 uni 专有能力（平台 no-op / phone-shell），不再内联 core helper。
 *
 * 额外能力：
 *   - `phoneShell` 配置项注入虚拟 iPhone 外观（仅浏览器平台 + dev 模式）。
 *   - 平台区分：非浏览器平台（mp-\* / app / quickapp 等）下插件整体 no-op，
 *     overlay 无法运行也不污染产物。`platform` 选项可显式覆盖。
 *
 * 用法：`plugins: [uniDevInspector({...options}), ...uni()]`。
 */
export function uniDevInspector(opts: UniDevInspectorOptions = {}): Plugin {
  const {
    phoneShell: rawShell,
    platform: explicitPlatform,
    ...coreOpts
  } = opts;
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
      // 惰性探测平台 -- overlay 仅在浏览器平台可运行；非浏览器平台不挂 dev server。
      const platform = resolvePlatform(explicitPlatform);
      if (!isBrowserPlatform(platform)) {
        server.config.logger.info(
          `[vdi-uni] 目标平台 "${platform}" 非浏览器平台，dev inspector 已跳过（overlay 仅支持 h5/web）`,
        );
        return;
      }
      createDevServer(server, projectRoots, options.componentConfig);
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
      const disk = getDiskTemplate(parse, id);
      const templateLine =
        disk != null
          ? disk.line
          : offsetToLine(code, template.loc.start.offset);
      // 行映射：内存 template.content -> 磁盘 template.content（0-based，注入行=-1）。
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
              options.portalComponents,
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
      if (shell.enabled)
        html = html
          .replace("<body>", "<body class='uni'>")
          .replace("</body>", buildPhoneShellScript(shell) + "\n</body>");

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
