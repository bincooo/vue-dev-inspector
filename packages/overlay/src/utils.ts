/**
 * 纯计算工具函数——无 DOM 副作用。
 */
import { s } from './state'

export function pa(v: string): { f: string; l: string; c: string } {
  const b = v.lastIndexOf(':')
  const a = v.lastIndexOf(':', b - 1)
  return { f: v.substring(0, a), l: v.substring(a + 1, b), c: v.substring(b + 1) }
}

export function api(p: string, o?: RequestInit): Promise<any> {
  return fetch(s.API + p, Object.assign({ headers: { 'Content-Type': 'application/json' } }, o || {}))
    .then(function (r) { return r.json() })
}

export function tagName(el: HTMLElement): string {
  return el.getAttribute(s.TAG_ATTR) || el.tagName.toLowerCase()
}

export function mk(tag: string, css?: string, txt?: string): HTMLDivElement {
  const e = document.createElement(tag) as HTMLDivElement
  if (css) e.style.cssText = css
  if (txt) e.textContent = txt
  return e
}

export function find(el: EventTarget | null): HTMLElement | null {
  let node = el as HTMLElement | null
  while (node && node !== document.documentElement) {
    if ((node as HTMLElement).getAttribute && (node as HTMLElement).getAttribute(s.A)) return node
    node = (node as HTMLElement).parentElement
  }
  return null
}

export function boxOf(el: HTMLElement | null): HTMLElement | null {
  if (el && getComputedStyle(el).display === 'contents' && el.firstElementChild)
    return el.firstElementChild as HTMLElement
  return el
}

export function pos(overlay: HTMLDivElement, el: HTMLElement, d: number): void {
  const r = boxOf(el)!.getBoundingClientRect()
  Object.assign(overlay.style, {
    display: 'block',
    left: (r.left - d) + 'px',
    top: (r.top - d) + 'px',
    width: (r.width + d * 2) + 'px',
    height: (r.height + d * 2) + 'px',
  })
}
