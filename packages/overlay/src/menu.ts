/**
 * 右键菜单。
 */
import { s } from './state'
import { pa, api, tagName, mk } from './utils'
import { esc } from './esc'
import { drawSel } from './inspector'
import { openPanel } from './panel'
import { openDrawer } from './drawer'

export function showMenu(x: number, y: number, el: HTMLElement): void {
  const d = pa(el.getAttribute(s.A)!)
  const tag = tagName(el)
  s.menu!.style.display = 'block'
  s.menu!.style.left = Math.min(x, innerWidth - 220) + 'px'
  s.menu!.style.top = Math.min(y, innerHeight - 200) + 'px'

  // 标题区
  s.menu!.innerHTML =
    '<div style="padding:8px 12px 6px;border-bottom:1px solid #e2e8f0;margin-bottom:4px">'
    + '<div style="font-size:14px;font-weight:600;color:#186eff;padding-bottom:2px">' + esc(tag) + '</div>'
    + '<div style="font-size:10px;color:#94a3b8;font-family:monospace;margin-top:2px">'
      + esc(d.f) + ':' + d.l + ':' + d.c + '</div>'
    + '</div>'

  const items = [
    { l: '📦 在编辑器中打开', a: 'open' },
    { l: '⚙️ 编辑属性', a: 'props' },
    { l: '🧩 组件面板', a: 'catalog' },
    { l: '📋 复制路径', a: 'copy' },
    { l: '🗑️ 删除', a: 'del', d: true },
  ]

  items.forEach(function (o) {
    const b = mk('button',
      'display:block;width:100%;padding:7px 12px;text-align:left;font-size:12px;'
      + 'border:none;background:none;cursor:pointer;color:'
      + (o.d ? '#ef4444' : '#475569') + ';background-color:'
      + (o.d ? '#fef2f2' : 'transparent'),
      o.l
    ) as any
    b.onmouseenter = function () { b.style.backgroundColor = o.d ? '#fee2e2' : '#f1f5f9' }
    b.onmouseleave = function () { b.style.backgroundColor = o.d ? '#fef2f2' : 'transparent' }
    b.onclick = function () {
      if (o.a === 'copy') {
        navigator.clipboard.writeText(s.P + s.R + '/' + d.f + ':' + d.l + ':' + d.c)
        s.menu!.style.display = 'none'
      }
      if (o.a === 'open') {
        api('/open-in-editor', { method: 'POST', body: JSON.stringify({ file: d.f, line: +d.l, col: +d.c, editor: s.EDT }) })
        s.menu!.style.display = 'none'
      }
      if (o.a === 'del') {
        api('/delete-element', { method: 'POST', body: JSON.stringify({ file: d.f, line: +d.l, col: +d.c, tag }) })
          .then(function () { if (s.sel === el) { s.sel = null; drawSel() } el.remove(); s.menu!.style.display = 'none' })
      }
      if (o.a === 'props') openPanel(el)
      if (o.a === 'catalog') openDrawer()
    }
    s.menu!.appendChild(b)
  })
}