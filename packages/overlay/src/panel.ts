/**
 * 属性编辑面板。
 */
import { s } from './state'
import { pa, api, tagName, mk } from './utils'
import { esc } from './esc'

/** 关闭浮层 */
export function closePanel() { if (s.panel) { s.panel.remove(); s.panel = null } }

/** 弹出属性编辑模态 */
export function openPanel(el: HTMLElement): void {
  closePanel()
  s.menu!.style.display = 'none'
  const d = pa(el.getAttribute(s.A)!)
  s.pdata = { file: d.f, line: +d.l, col: +d.c, tag: el.tagName.toLowerCase(), entries: [] }

  const mask = mk('div', 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.25);backdrop-filter:blur(2px);display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif')
  mask.onmousedown = function (e: MouseEvent) { if (e.target === mask) closePanel() }

  const card = mk('div', 'width:520px;max-width:92vw;max-height:80vh;display:flex;flex-direction:column;background:#fff;border-radius:3px;box-shadow:0 20px 60px rgba(0,0,0,.25);overflow:hidden')

  const head = mk('div', 'display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid #f1f5f9')
  head.innerHTML = '<div><div style="font-size:14px;font-weight:600;color:#1e293b">⚙️ 编辑属性</div>'
    + '<div style="font-size:11px;color:#94a3b8;font-family:monospace;margin-top:2px">'
    + esc(tagName(el)) + ' · ' + esc(d.f) + ':' + d.l
    + '<span id="__ld">  加载中…</span></div></div>'
  const xb = mk('button', 'border:none;background:none;font-size:16px;color:#94a3b8;cursor:pointer;padding:4px 8px;border-radius:3px', '✕') as any
  xb.onclick = closePanel; head.appendChild(xb)

  const list = mk('div', 'flex:1;overflow-y:auto;padding:14px 18px')

  const foot = mk('div', 'display:flex;align-items:center;justify-content:space-between;padding:12px 18px;border-top:1px solid #f1f5f9;background:#f8fafc')
  const hint = mk('span', 'font-size:11px;color:#94a3b8', '修改后基于 AST 回写源码，Vite 自动热更新')
  const save = mk('button', 'border:none;background:#3b82f6;color:#fff;font-size:12px;font-weight:600;padding:8px 16px;border-radius:3px;cursor:pointer', '💾 保存') as any
  save.onclick = function () { submit(el) }
  foot.append(hint, save)

  card.append(head, list, foot); mask.appendChild(card); document.body.appendChild(mask); s.panel = mask

  api('/get-props', { method: 'POST', body: JSON.stringify({ file: s.pdata.file, line: s.pdata.line, col: s.pdata.col }) })
    .then(function (r: any) {
      const ld = document.getElementById('__ld'); if (ld) ld.remove()
      if (r && r.props) s.pdata.entries = r.props.map(function (p: any) { return { key: p.key, value: p.value } })
      renderList(list)
    })
    .catch(function () { const ld = document.getElementById('__ld'); if (ld) ld.textContent = '  读取失败' })
}

/** 渲染属性行 */
export function renderList(list: HTMLDivElement): void {
  list.innerHTML = ''
  if (!s.pdata.entries.length)
    list.appendChild(mk('div', 'text-align:center;color:#cbd5e1;font-size:12px;padding:20px 0', '暂无属性，点击下方添加'))

  s.pdata.entries.forEach(function (e, i) {
    const row = mk('div', 'display:flex;align-items:center;gap:8px;margin-bottom:8px')
    const ki = mk('input', 'flex:1;min-width:0;padding:7px 10px;font-size:12px;font-family:monospace;background:#f8fafc;border:1px solid #e2e8f0;border-radius:3px;color:#1d4ed8;font-weight:600') as HTMLInputElement
    ki.value = e.key; ki.placeholder = '属性名'; ki.oninput = function () { e.key = ki.value }
    const eq = mk('span', 'color:#cbd5e1;font-size:12px', '=')
    const vi = mk('input', 'flex:1.5;min-width:0;padding:7px 10px;font-size:12px;font-family:monospace;background:#f8fafc;border:1px solid #e2e8f0;border-radius:3px;color:#334155') as HTMLInputElement
    vi.value = e.value; vi.placeholder = '值（可空）'; vi.oninput = function () { e.value = vi.value }
    const rm = mk('button', 'border:none;background:none;color:#cbd5e1;cursor:pointer;padding:4px 8px;border-radius:3px;font-size:12px', '✕') as any
    rm.onmouseenter = function () { rm.style.color = '#ef4444'; rm.style.background = '#fef2f2' }
    rm.onmouseleave = function () { rm.style.color = '#cbd5e1'; rm.style.background = 'none' }
    rm.onclick = function () { s.pdata.entries.splice(i, 1); renderList(list) }
    row.append(ki, eq, vi, rm); list.appendChild(row)
  })

  // 新增行
  const ar = mk('div', 'display:flex;align-items:center;gap:8px;margin-top:14px;padding-top:14px;border-top:1px dashed #e2e8f0')
  const nk = mk('input', 'flex:1;min-width:0;padding:7px 10px;font-size:12px;font-family:monospace;background:#fff;border:1px solid #e2e8f0;border-radius:3px') as HTMLInputElement
  nk.placeholder = '新属性名'
  const eq2 = mk('span', 'color:#cbd5e1;font-size:12px', '=')
  const nv = mk('input', 'flex:1.5;min-width:0;padding:7px 10px;font-size:12px;font-family:monospace;background:#fff;border:1px solid #e2e8f0;border-radius:3px') as HTMLInputElement
  nv.placeholder = '值'
  const ab = mk('button', 'border:none;background:#10b981;color:#fff;font-size:12px;font-weight:600;padding:7px 12px;border-radius:3px;cursor:pointer;white-space:nowrap', '＋ 添加') as any
  const doAdd = function () {
    if (!nk.value.trim()) return
    s.pdata.entries.push({ key: nk.value.trim(), value: nv.value }); nk.value = ''; nv.value = ''; renderList(list)
  }
  ab.onclick = doAdd
  nk.onkeydown = function (e: KeyboardEvent) { if (e.key === 'Enter') doAdd() }
  nv.onkeydown = nk.onkeydown
  ar.append(nk, eq2, nv, ab); list.appendChild(ar)
}

/** 收集 entries 回写源码 */
export function submit(el: HTMLElement): void {
  api('/update-props', {
    method: 'POST',
    body: JSON.stringify({
      file: s.pdata.file, line: s.pdata.line, col: s.pdata.col,
      props: s.pdata.entries.map(function (e) { return { key: e.key, value: e.value } }),
    }),
  }).then(function (r: any) {
    if (r && r.success) {
      closePanel()
      console.log('%c[Vue DevInspector]%c 属性已更新', 'color:#10b981;font-weight:bold', 'color:inherit')
    }
  })
}