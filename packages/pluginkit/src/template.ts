/**
 * 磁盘 template 行号 / 行映射工具。
 *
 * **编译环境隔离设计（core vs uni）**：
 * 这组工具需要调用 `@vue/compiler-sfc` 的 `parse` 读磁盘 SFC。但 core 与 uni
 * 取 `parse` 的方式不同：
 *   - core：直接 ESM `import { parse } from "@vue/compiler-sfc"`（用项目装的版本）。
 *   - uni：必须经 `createRequire(import.meta.url)` 在 `priming.ts` 预热 CJS 缓存
 *     **之后**取 `parse`，否则会被 `@dcloudio/vite-plugin-uni` 污染的
 *     `@vue/shared@3.4.21` 污染、丢掉 `genCacheKey`。
 *
 * 因此本模块**不直接 import `@vue/compiler-sfc`**，而是由调用方把 `parse` 作为
 * `SfcParser` 注入。pluginkit 的 tsup 构建把 `@vue/compiler-sfc` 标记为 external，
 * 保证不把它打进 bundle--无论 core 还是 uni，运行时用的都是各自解析到的版本。
 */
import type { SFCParseResult } from "@vue/compiler-sfc";
import { loadScript } from "@vue-dev-inspector/utils";
import fs from "node:fs";

/** 调用方注入的 `@vue/compiler-sfc` parse 函数形状。 */
export type SfcParser = (
  source: string,
  options: { filename: string },
) => SFCParseResult;

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
 * 必须取**磁盘文件**的行号，而非 transform 收到的 `code`：`enforce:"pre"`
 * 链中靠前的插件（如 unplugin-vue-setup-extend-plus、uni 的部分前置 transform）
 * 会在 `<template>` 之前前置注入内容，把 `<template>` 整体下推，使内存 code
 * 的 templateLine 偏大，进而把 data-source-file 的行号整体抬高（编辑器打开
 * 磁盘文件就会跳错行）。读盘失败（虚拟模块、权限等）返回 -1，调用方回落到
 * 内存 code 的偏移。
 */
export function getDiskTemplateLine(
  parse: SfcParser,
  diskPath: string,
): number {
  try {
    const diskCode = fs.readFileSync(diskPath, "utf8");
    const { descriptor, errors } = parse(diskCode, { filename: diskPath });
    if (errors.length || !descriptor.template) return -1;
    return offsetToLine(diskCode, descriptor.template.loc.start.offset);
  } catch {
    return -1;
  }
}

/**
 * 同时取磁盘 `<template>` 起始行号（1-based）与磁盘 template.content。
 *
 * uni 场景需要 content 做内存->磁盘逐行映射（见 `buildDiskLineMap`）；
 * core 只需行号（用 `getDiskTemplateLine` 即可）。读盘失败返回 null，
 * 调用方回落到内存 code 的偏移。
 */
export function getDiskTemplate(
  parse: SfcParser,
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
 * 构建内存 template.content -> 磁盘 template.content 的**逐行映射**（0-based）。
 *
 * 前置插件（如 @uni-ku/root 把模板包进 `<global-ku-root>...</global-ku-root>`）
 * 会在模板**内部**注入额外行，使 compileTemplate 给的 `el.loc.start.line` 是
 * "内存行"而非"磁盘行"，导致注入的 data-source-file 行号整体偏移、editor 找不到元素。
 * `getDiskTemplateLine` 只修了 `<template>` 之前的下推，没修模板内部注入--这里补上。
 *
 * 内存 content = 磁盘 content + 注入行（前置插件只注入、不删除/修改行），所以磁盘行是
 * 内存行的子序列。贪心匹配即可：逐内存行比对当前磁盘行，相等则映射、推进磁盘指针；
 * 不等则该内存行是注入行（映射 -1）。
 *
 * 返回 `map[memLineIdx0] = diskLineIdx0`（均为 0-based），注入行为 -1。
 */
export function buildDiskLineMap(
  memContent: string,
  diskContent: string,
): number[] {
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

/**
 * 编译后的 overlay 脚本（由 @vue-dev-inspector/overlay 子工程构建产生）。
 * 通过文件系统读取单文件 IIFE，避免在插件源码中以字符串形式拼脚本。
 *
 * 用懒加载单例避免模块顶层 IO：tsup 打包期会做 tree-shaking
 * 静态分析；只有 dev 模式下 `transformIndexHtml` 实际触发时才会读盘
 * （非 dev 模式完全跳过 transformIndexHtml 钩子）。
 *
 * `import.meta.url` 经 tsup inline 后落在 `<pkg>/dist/index.js`，两个相对候选
 * 都从该目录解析：
 *   1. `./overlay.iife.js` -- core/uni build 时 `cp` 进各自 `dist/`，自包含命中；
 *   2. `../../overlay/dist/overlay.iife.js` -- monorepo 内直接取 overlay 产物。
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
