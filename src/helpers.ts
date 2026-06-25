/** Minimal DOM helper — replaces JSX */
export function h(
  tag: string,
  attrs?: Record<string, any> | null,
  ...children: (Node | string | null | undefined | false)[]
): HTMLElement {
  const el = document.createElement(tag)
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue
      if (k === 'className') el.className = v
      else if (k.startsWith('on') && typeof v === 'function')
        el.addEventListener(k.slice(2).toLowerCase(), v)
      else if (k === 'style' && typeof v === 'object')
        Object.assign(el.style, v)
      else el.setAttribute(k, String(v))
    }
  }
  for (const c of children) {
    if (c == null || c === false) continue
    el.append(typeof c === 'string' ? document.createTextNode(c) : c)
  }
  return el
}

/** Set innerHTML and return container */
export function html(parent: HTMLElement, content: string): HTMLElement {
  parent.innerHTML = content
  return parent
}

/** Query helper */
export function $(selector: string, root: Element | Document = document): HTMLElement | null {
  return root.querySelector(selector)
}

/** Escape HTML */
export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
