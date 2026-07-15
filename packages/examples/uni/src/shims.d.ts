/**
 * uview-pro 以 TS 源码发布且未声明 `types` 字段，补模块声明避免 TS 报错。
 * 运行时由 vite/uni 经 esbuild + @vitejs/plugin-vue 处理，类型不参与打包。
 */
declare module "uview-pro";
declare const uni: typeof import("@dcloudio/types");
