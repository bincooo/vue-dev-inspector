/**
 * 解析 data-source-file 属性值
 * 格式: "src/components/Foo.vue:12:5"
 * 从右侧拆分，兼容 Windows 盘符路径中的 ':'
 */
export function parseSourceAttr(value: string): {
  file: string
  line: string
  col: string
} {
  const lastColon = value.lastIndexOf(':')
  const secondLastColon = value.lastIndexOf(':', lastColon - 1)
  return {
    file: value.substring(0, secondLastColon),
    line: value.substring(secondLastColon + 1, lastColon),
    col: value.substring(lastColon + 1),
  }
}

/**
 * 编辑器 URL Protocol 映射表
 */
export const EDITOR_PROTOCOLS: Record<string, string> = {
  vscode: 'vscode://file/',
  webstorm: 'webstorm://open?file=',
  atom: 'atom://open?url=file://',
  sublime: 'subl://open?url=file://',
}

/**
 * Vue 内置标签 — AST 遍历时应跳过
 */
export const VUE_BUILTIN_TAGS = [
  'template',
  'slot',
  'component',
  'transition',
  'transition-group',
  'keep-alive',
  'teleport',
  'suspense',
] as const

/**
 * 默认属性名
 */
export const DEFAULT_ATTR_NAME = 'data-source-file'
