import type {
  ElementNode,
  RootNode,
  TemplateChildNode,
} from '@vue/compiler-core'
import { NodeTypes, ElementTypes, baseParse } from '@vue/compiler-core'

/**
 * 注入信息：描述需要在源码中插入的属性
 */
export interface AttrInjection {
  /** 插入位置（字符偏移量） */
  offset: number
  /** 属性字符串，如 ` data-source-file="src/Foo.vue:3:5"` */
  attr: string
  /** 节点标签名 */
  tag: string
  /** 行号 (1-based) */
  line: number
  /** 列号 (0-based) */
  column: number
}

/**
 * 遍历配置选项
 */
export interface WalkOptions {
  /** 注入的属性名 */
  attrName?: string
  /** 需要跳过的标签集合 */
  skipTags?: Set<string>
}

/**
 * 默认跳过的 Vue 内置标签
 */
const DEFAULT_SKIP_TAGS = new Set([
  'template',
  'slot',
  'component',
  'transition',
  'transition-group',
  'keep-alive',
  'teleport',
  'suspense',
])

/**
 * 解析 Vue 模板源码并遍历 AST，收集需要注入的属性信息
 *
 * @param templateSource - 模板源码字符串
 * @param filePath - 文件相对路径
 * @param options - 遍历配置
 * @returns 属性注入信息数组
 *
 * @example
 * ```ts
 * const injections = walkTemplateAST(
 *   '<div class="app"><span>hello</span></div>',
 *   'src/App.vue'
 * )
 * // injections[0].attr === ' data-source-file="src/App.vue:1:0"'
 * ```
 */
export function walkTemplateAST(
  templateSource: string,
  filePath: string,
  options: WalkOptions = {}
): AttrInjection[] {
  const {
    attrName = 'data-source-file',
    skipTags = DEFAULT_SKIP_TAGS,
  } = options

  // 1. 解析为 AST
  const ast = baseParse(templateSource, {
    comments: true,
  })

  // 2. 递归遍历收集注入信息
  const injections: AttrInjection[] = []
  walkNode(ast, filePath, attrName, skipTags, injections)

  return injections
}

/**
 * 递归遍历 AST 节点
 *
 * 支持的节点类型：
 * - ELEMENT: 普通元素和组件 → 注入属性 + 递归 children
 * - ROOT: 根节点 → 递归 children
 * - IF: v-if 节点 → 遍历 branches → 递归 branch.children
 * - FOR: v-for 节点 → 递归 children
 * - 其他: TEXT / INTERPOLATION / COMMENT → 跳过
 */
function walkNode(
  node: RootNode | TemplateChildNode,
  filePath: string,
  attrName: string,
  skipTags: Set<string>,
  injections: AttrInjection[]
): void {
  switch (node.type) {
    case NodeTypes.ELEMENT: {
      const el = node as ElementNode

      if (
        !skipTags.has(el.tag)
        && (el.tagType === ElementTypes.ELEMENT
          || el.tagType === ElementTypes.COMPONENT)
      ) {
        const { line, column } = el.loc.start
        const openTagEnd = findOpenTagEnd(el)

        injections.push({
          offset: openTagEnd,
          attr: ` ${attrName}="${filePath}:${line}:${column}"`,
          tag: el.tag,
          line,
          column,
        })
      }

      // 递归子节点
      for (const child of el.children) {
        walkNode(child, filePath, attrName, skipTags, injections)
      }
      break
    }

    case NodeTypes.ROOT: {
      for (const child of (node as RootNode).children) {
        walkNode(child, filePath, attrName, skipTags, injections)
      }
      break
    }

    case NodeTypes.IF: {
      for (const branch of node.branches) {
        for (const child of branch.children) {
          walkNode(child, filePath, attrName, skipTags, injections)
        }
      }
      break
    }

    case NodeTypes.FOR: {
      for (const child of node.children) {
        walkNode(child, filePath, attrName, skipTags, injections)
      }
      break
    }

    // TEXT, INTERPOLATION, COMMENT, etc. → skip
    default:
      break
  }
}

/**
 * 找到元素开始标签中 > 或 /> 的偏移位置
 */
function findOpenTagEnd(el: ElementNode): number {
  const source = el.loc.source
  if (el.isSelfClosing) {
    return el.loc.start.offset + source.indexOf('/>')
  }
  return el.loc.start.offset + source.indexOf('>')
}
