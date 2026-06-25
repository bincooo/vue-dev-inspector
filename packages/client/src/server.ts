import type { ViteDevServer } from 'vite'
import fs from 'node:fs'
import path from 'node:path'
import { exec } from 'node:child_process'
import { getElementProps, editElementProps, insertComponent, duplicateElement, deleteElement } from './editor'
import type { PropEntry } from './editor'
import { API_PREFIX, EDITOR_PROTOCOLS } from '../../vite-plugin-vue-dev-inspector/src/options'

// ─── Helpers ────────────────────────────────────────────

function parseBody(req: { on: Function }): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (c: Buffer) => { body += c.toString() })
    req.on('end', () => { try { resolve(JSON.parse(body)) } catch (e) { reject(e) } })
    req.on('error', reject)
  })
}

function json(res: any, status: number, data: unknown) {
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.writeHead(status)
  res.end(JSON.stringify(data))
}

/** 解析文件路径并校验安全边界 */
function safePath(projectRoot: string, file: string): string | null {
  const fp = path.resolve(projectRoot, file)
  return fp.startsWith(projectRoot) ? fp : null
}

// ─── Route handlers ────────────────────────────────────

function handleGetProps(projectRoot: string, body: any, res: any) {
  const fp = safePath(projectRoot, body.file)
  if (!fp) return json(res, 403, { error: 'Forbidden' })
  const source = fs.readFileSync(fp, 'utf-8')
  const result = getElementProps(source, body.file, body.line, body.col)
  result ? json(res, 200, result) : json(res, 404, { error: 'Element not found' })
}

function handleUpdateProps(projectRoot: string, body: any, res: any) {
  const fp = safePath(projectRoot, body.file)
  if (!fp) return json(res, 403, { error: 'Forbidden' })
  const source = fs.readFileSync(fp, 'utf-8')
  const result = editElementProps(source, body.file, body.line, body.col, body.props)
  fs.writeFileSync(fp, result, 'utf-8')
  json(res, 200, { success: true })
}

function handleDeleteElement(projectRoot: string, body: any, res: any) {
  const fp = safePath(projectRoot, body.file)
  if (!fp) return json(res, 403, { error: 'Forbidden' })
  const source = fs.readFileSync(fp, 'utf-8')
  const result = deleteElement(source, body.file, body.line, body.col)
  if (result === source) return json(res, 404, { error: 'Element not found' })
  fs.writeFileSync(fp, result, 'utf-8')
  json(res, 200, { success: true })
}

/**
 * 用 shell 指令在编辑器中打开源码文件并定位到具体行。
 * 不同编辑器用不同的命令行打开方式：
 *   vscode:  code -g file:line
 *   webstorm: webstorm file:line
 *   Others fall back to the editor protocol URL via `open`/`xdg-open`/`start`.
 */
/**
 * 扫描 projectRoot 下所有 .vue 文件（排除 node_modules），返回相对路径列表。
 * 供组件面板渲染目录树。
 */
function handleListComponents(projectRoot: string, _body: any, res: any) {
  const result: { path: string; name: string }[] = []
  const EXCLUDE = /(node_modules|dist|\.vite)/
  function walk(dir: string) {
    let ents: fs.Dirent[]
    try { ents = fs.readdirSync(dir, { withFileTypes: true }) } catch { return }
    for (const ent of ents) {
      if (EXCLUDE.test(ent.name)) continue
      const full = path.join(dir, ent.name)
      if (ent.isDirectory()) walk(full)
      else if (ent.isFile() && ent.name.endsWith('.vue')) {
        result.push({ path: path.relative(projectRoot, full).replace(/\\/g, '/'), name: ent.name })
      }
    }
  }
  walk(projectRoot)
  result.sort((a, b) => a.path.localeCompare(b.path))
  json(res, 200, { components: result })
}

/** 把组件插入到 (line,col) 指定的元素位置，direction 决定语义 */
function handleInsertComponent(projectRoot: string, body: any, res: any) {
  const fp = safePath(projectRoot, body.file)
  if (!fp) return json(res, 403, { error: 'Forbidden' })
  const source = fs.readFileSync(fp, 'utf-8')
  const tag = body.componentTag || body.tag || ''
  const direction = body.direction === 'before' || body.direction === 'after' ? body.direction : 'inside'
  const result = insertComponent(source, body.file, body.line, body.col, tag, direction)
  if (result === null) return json(res, 404, { error: 'Target element not found' })
  fs.writeFileSync(fp, result, 'utf-8')
  json(res, 200, { success: true })
}

function handleDuplicateElement(projectRoot: string, body: any, res: any) {
  const fp = safePath(projectRoot, body.file)
  if (!fp) return json(res, 403, { error: 'Forbidden' })
  const source = fs.readFileSync(fp, 'utf-8')
  const result = duplicateElement(source, body.file, body.line, body.col)
  if (result === null) return json(res, 404, { error: 'Element not found' })
  fs.writeFileSync(fp, result, 'utf-8')
  json(res, 200, { success: true })
}

function handleOpenInEditor(projectRoot: string, body: any, res: any) {
  const fp = safePath(projectRoot, body.file)
  if (!fp) return json(res, 403, { error: 'Forbidden' })
  const line = body.line || 1
  const col = body.col || 1
  const editor = body.editor || 'vscode'
  const lineArg = col ? `${line}:${col}` : `${line}`

  let cmd: string
  switch (editor) {
    case 'vscode':
      cmd = `code -g "${fp}:${lineArg}"`
      break
    case 'webstorm':
    case 'idea':
      cmd = `webstorm "${fp}:${line}"`
      break
    case 'atom':
      cmd = `atom "${fp}:${line}:${col}"`
      break
    case 'sublime':
      cmd = `subl "${fp}:${line}:${col}"`
      break
    default: {
      // 回退：用编辑器 URL protocol 走系统默认 handler
      const proto = EDITOR_PROTOCOLS[editor] || EDITOR_PROTOCOLS.vscode
      const url = `${proto}${fp}:${line}:${col}`
      cmd = process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`
    }
  }

  exec(cmd, (err) => {
    if (err) return json(res, 500, { error: err.message })
    json(res, 200, { success: true })
  })
}

// ─── Server middleware ───────────────────────────────────

/** 路由表 */
const ROUTES: Record<string, Record<string, (root: string, body: any, res: any) => void>> = {
  '/get-props':      { POST: handleGetProps },
  '/update-props':   { POST: handleUpdateProps },
  '/delete-element': { POST: handleDeleteElement },
  '/open-in-editor': { POST: handleOpenInEditor },
  '/list-components': { POST: handleListComponents },
  '/insert-component': { POST: handleInsertComponent },
  '/duplicate-element': { POST: handleDuplicateElement },
}

/**
 * 创建 DevInspector 服务端中间件
 * 统一处理所有 /__dev-inspector-api__/* 请求
 */
export function createDevServer(server: ViteDevServer, projectRoot: string) {
  server.middlewares.use(async (req, res, next) => {
    const url = req.url || ''
    if (!url.startsWith(API_PREFIX + '/')) return next()

    const pathname = url.split('?')[0].replace(API_PREFIX, '')
    const route = ROUTES[pathname]
    const handler = route?.[req.method || '']

    // CORS preflight
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
      res.writeHead(204); res.end(); return
    }

    if (!handler) return next()

    try {
      const body = await parseBody(req)
      handler(projectRoot, body, res)
    } catch (err: unknown) {
      json(res, 500, { error: err instanceof Error ? err.message : 'Unknown error' })
    }
  })
}
