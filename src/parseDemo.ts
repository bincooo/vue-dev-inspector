/**
 * Parse real Vue SFC files from packages/demo/ into an AST tree
 * that DemoApp can render and inspect.
 *
 * Uses @vue/compiler-sfc to parse SFC and @vue/compiler-core to
 * walk the template AST at BUILD TIME (code runs in browser but
 * the vue files are imported as raw strings via ?raw).
 */
import { parse as parseSFC } from '@vue/compiler-sfc'
import { baseParse, NodeTypes, ElementTypes } from '@vue/compiler-core'
import type { ElementNode, RootNode, TemplateChildNode, AttributeNode, DirectiveNode } from '@vue/compiler-core'

/* ── The El type used by DemoApp ── */
export interface El {
  id: string;
  tag: string;
  file: string;
  line: number;
  col: number;
  label: string;
  cls: string;
  nodeType: string;
  elementType: string;
  children?: El[];
  text?: string;
  props?: Record<string, string>;
}

/* ── Vue SFC file entry ── */
export interface VueFile {
  /** Relative path, e.g. "src/App.vue" */
  path: string;
  /** Raw source code */
  source: string;
}

/* Tags to skip when walking */
const SKIP = new Set(['template', 'slot', 'component', 'transition', 'keep-alive', 'teleport', 'suspense'])

/* Style class mapping — maps tag/component names to demo visual classes */
const CLS_MAP: Record<string, string> = {
  'App': 'demo-app',
  'Header': 'demo-header',
  'Logo': 'demo-logo',
  'NavBar': 'demo-nav',
  'main': 'demo-main',
  'Hero': 'demo-hero',
  'CardList': 'demo-cards',
  'Card': 'demo-card',
  'Footer': 'demo-footer',
}

/* Simple text content for leaf nodes */
const TEXT_MAP: Record<string, string> = {
  'Logo': '🚀 MyApp',
  'NavBar': '首页  关于  文档  博客',
  'Hero': '欢迎使用 MyApp',
  'Footer': '© 2024 MyApp',
}

let _uid = 0

function nextId(): string {
  return `ast_${_uid++}`
}

/**
 * Extract props from an AST element node
 */
function extractProps(node: ElementNode): Record<string, string> {
  const props: Record<string, string> = {}
  for (const p of node.props) {
    if (p.type === 6 /* NodeTypes.ATTRIBUTE */) {
      const attr = p as AttributeNode
      props[attr.name] = attr.value?.content ?? 'true'
    } else if (p.type === 7 /* NodeTypes.DIRECTIVE */) {
      const dir = p as DirectiveNode
      if (dir.name === 'bind' && dir.arg?.type === 4 /* SIMPLE_EXPRESSION */) {
        const key = dir.arg.content
        const val = dir.exp?.type === 4 ? dir.exp.content : 'true'
        props[`:${key}`] = val
      } else if (dir.name === 'for') {
        props['v-for'] = dir.exp?.type === 4 ? dir.exp.content : ''
      } else if (dir.name === 'if' || dir.name === 'else-if') {
        props[`v-${dir.name}`] = dir.exp?.type === 4 ? dir.exp.content : 'true'
      }
    }
  }
  return props
}

/**
 * Get a human-friendly label for a tag
 */
function getLabel(tag: string): string {
  // PascalCase component
  if (tag[0] === tag[0].toUpperCase() && tag[0] !== tag[0].toLowerCase()) return tag
  return tag
}

/**
 * Get element type string
 */
function getElType(node: ElementNode): string {
  if (node.tagType === ElementTypes.COMPONENT) return 'COMPONENT'
  return 'ELEMENT'
}

/**
 * Recursively walk AST nodes and build El tree
 */
function walkNode(
  node: RootNode | TemplateChildNode,
  file: string,
  results: El[]
): void {
  if (node.type === NodeTypes.ELEMENT) {
    const el = node as ElementNode
    if (SKIP.has(el.tag)) {
      // still walk children of skipped tags (like <template>)
      for (const child of el.children) walkNode(child, file, results)
      return
    }

    const label = getLabel(el.tag)
    const cls = CLS_MAP[label] || CLS_MAP[el.tag] || ''
    const props = extractProps(el)
    const text = TEXT_MAP[label] || ''

    const item: El = {
      id: nextId(),
      tag: el.tag,
      file,
      line: el.loc.start.line,
      col: el.loc.start.column,
      label,
      cls,
      nodeType: `ELEMENT (${NodeTypes.ELEMENT})`,
      elementType: getElType(el),
      props: Object.keys(props).length ? props : undefined,
      text: text || undefined,
    }

    // Walk children
    const childEls: El[] = []
    for (const child of el.children) {
      walkNode(child, file, childEls)
    }
    if (childEls.length > 0) {
      item.children = childEls
    }

    // If component and no text/children, try to get text content
    if (!item.text && !item.children) {
      // Gather text content from child text/interpolation nodes
      const texts: string[] = []
      for (const child of el.children) {
        if (child.type === NodeTypes.TEXT) texts.push(child.content.trim())
        if (child.type === NodeTypes.INTERPOLATION && child.content.type === 4) {
          texts.push(`{{ ${child.content.content} }}`)
        }
      }
      if (texts.length) item.text = texts.join(' ')
    }

    results.push(item)
    return
  }

  if (node.type === NodeTypes.ROOT) {
    for (const child of (node as RootNode).children) {
      walkNode(child, file, results)
    }
    return
  }

  // IF node — walk branches
  if (node.type === NodeTypes.IF) {
    for (const branch of (node as any).branches) {
      for (const child of branch.children) {
        walkNode(child, file, results)
      }
    }
    return
  }

  // FOR node — walk children
  if (node.type === NodeTypes.FOR) {
    for (const child of (node as any).children) {
      walkNode(child, file, results)
    }
  }
}

/**
 * Parse a single Vue SFC file and return the AST tree
 */
export function parseVueSFC(file: VueFile): El[] {
  const { descriptor } = parseSFC(file.source, { filename: file.path })
  if (!descriptor.template) return []

  const ast = baseParse(descriptor.template.content, {
    comments: false,
  })

  const results: El[] = []
  walkNode(ast, file.path, results)
  return results
}

/**
 * Parse all demo Vue files and return the complete tree.
 * The App.vue is the root, and component children are resolved
 * by matching component tags to their parsed results.
 */
export function parseDemoProject(files: VueFile[]): El[] {
  _uid = 0

  // Parse each file independently
  const parsed = new Map<string, El[]>()
  for (const f of files) {
    parsed.set(f.path, parseVueSFC(f))
  }

  // Find App.vue tree as root
  const appFile = files.find(f => f.path.endsWith('App.vue'))
  if (!appFile) return []

  const appTree = parsed.get(appFile.path)
  if (!appTree || appTree.length === 0) return []

  // Build a component name → file path map
  const componentFiles = new Map<string, string>()
  for (const f of files) {
    if (f.path === appFile.path) continue
    const name = f.path.split('/').pop()?.replace('.vue', '') || ''
    componentFiles.set(name, f.path)
  }

  // Recursively resolve component references:
  // If a node is a COMPONENT and we have a parsed file for it,
  // replace its children/text with the parsed result from that file
  function resolveComponents(tree: El[]): El[] {
    return tree.map(node => {
      if (node.elementType === 'COMPONENT' && componentFiles.has(node.label)) {
        const compPath = componentFiles.get(node.label)!
        const compTree = parsed.get(compPath)
        if (compTree && compTree.length > 0) {
          // Use the component file's root element(s), but keep the
          // original node's file/line/col (where it's used)
          const resolved = compTree[0]
          return {
            ...node,
            // If the component's template has children, show those
            children: resolved.children ? resolveComponents(resolved.children) : node.children,
            // If no text was set but component has text, use it
            text: node.text || resolved.text || TEXT_MAP[node.label],
            // Merge props
            cls: node.cls || resolved.cls || CLS_MAP[node.label] || '',
          }
        }
      }
      return {
        ...node,
        children: node.children ? resolveComponents(node.children) : undefined,
      }
    })
  }

  return resolveComponents(appTree)
}
