// overlay tsconfig 未引用 vite/client，这里手工声明 `*.css?inline` 的字符串模块。
declare module "*.css?inline" {
  const css: string;
  export default css;
}