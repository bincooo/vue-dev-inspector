import { createRequire } from "node:module";

/**
 * uni-app H5 编译链预载 —— 必须在任何 @vue/compiler-sfc import 之前执行。
 *
 * @dcloudio/vite-plugin-uni 依赖 @vue/shared@3.4.21（无 genCacheKey），
 * 加载后会污染 CJS require 缓存。本模块作为 plugin.ts 的第一个 import，
 * 确保 Node ESM 深度优先执行到这里时，先用 createRequire 把 @vue/shared@3.5.38
 * 装入 CJS 缓存，后续 compiler-sfc.cjs.js 内部的 require('@vue/shared')
 * 才能拿到正确的 genCacheKey。
 */
const _require = createRequire(import.meta.url);
_require("@vue/shared");
_require("@vue/compiler-sfc");
