/**
 * 组件抽屉（右侧滑入面板）。
 *
 * 搜索 → 分组列表 → 点击插入组件。
 * 插入方向由 s.insertDirection 决定：
 *   'inside' (默认) 插入选中元素内部末尾
 *   'before'          插入选中元素同级上方
 *   'after'           插入选中元素同级下方
 */
import { s } from './state'
import { pa, api, mk } from './utils'
import { drawSel } from './inspector'

/** 关闭抽屉（先动画滑出，200ms 后移除 DOM；同时移除遮罩） */
export function closeDrawer(): void {
  if (!s.drawer) return
  s.drawer.style.transform = 'translateX(100%)'
  const d = s.drawer; s.drawer = null
  if (_backdrop) { _backdrop.remove(); _backdrop = null }
  setTimeout(function () { d.remove() }, 200)
}

/** 抽屉遮罩（点击非面板区域关闭） */
let _backdrop: HTMLDivElement | null = null

/** 打开抽屉（已打开则关闭） */
export function openDrawer(): void {
  s.menu!.style.display = 'none'
  if (s.drawer) { closeDrawer(); return }
  const direction = s.insertDirection
  buildDrawer(direction, direction === 'inside' ? '选中元素后点击组件插入到其内部' : direction === 'before' ? '插入到选中元素的同级上方' : '插入到选中元素的同级下方')
}

/** 由 + 按钮调用：设定方向后打开抽屉 */
export function openDrawerFor(direction: 'before' | 'after'): void {
  s.menu!.style.display = 'none'
  if (s.drawer) { closeDrawer(); return }
  s.insertDirection = direction
  buildDrawer(direction, direction === 'before' ? '插入到选中元素的同级上方' : '插入到选中元素的同级下方')
}

/** 构造抽屉。direction 决定「点击组件」时的插入语义 */
function buildDrawer(direction: 'inside' | 'before' | 'after', hint: string): void {
  // 遮罩：覆盖全屏、位于抽屉之下；点击非面板区域（即遮罩本身）关闭抽屉
  const backdrop = mk('div', 'position:fixed;inset:0;z-index:9998;background:rgba(15,23,42,.18);backdrop-filter:blur(1px)')
  backdrop.onclick = function (e) {
    // 仅响应点击遮罩本身（点抽屉内部由抽屉的 stopPropagation 处理）
    if (e.target === backdrop) closeDrawer()
  }
  document.body.appendChild(backdrop)
  _backdrop = backdrop

  const drawer = mk('div', 'position:fixed;top:0;right:0;height:100vh;width:320px;max-width:90vw;z-index:9999;background:#fff;box-shadow:-8px 0 32px rgba(0,0,0,.15);display:flex;flex-direction:column;font-family:system-ui,sans-serif;transform:translateX(100%);transition:transform .2s ease-out')
  // 点击抽屉内部不冒泡到遮罩的关闭逻辑
  drawer.onclick = function (e) { e.stopPropagation() }
  document.body.appendChild(drawer)
  s.drawer = drawer
  requestAnimationFrame(function () { drawer.style.transform = 'translateX(0)' })

  // 头部
  const head = mk('div', 'display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid #f1f5f9')
  const htitle = mk('div', 'font-size:14px;font-weight:600;color:#1e293b', '🧩 组件面板')
  const hintWrap = mk('div', 'font-size:10px;color:#94a3b8;margin-top:2px', hint)
  const xbd = mk('button', 'border:none;background:none;font-size:16px;color:#94a3b8;cursor:pointer;padding:4px 8px;border-radius:3px', '✕') as any
  xbd.onclick = closeDrawer
  const tl = mk('div'); tl.append(htitle, hintWrap); head.append(tl, xbd)
  drawer.appendChild(head)

  // 搜索
  const searchWrap = mk('div', 'padding:12px 18px;border-bottom:1px solid #f8fafc')
  const search = mk('input', 'width:100%;box-sizing:border-box;padding:7px 10px;font-size:12px;border:1px solid #e2e8f0;border-radius:3px;background:#f8fafc;outline:none') as HTMLInputElement
  search.placeholder = '搜索组件…'
  searchWrap.appendChild(search)
  drawer.appendChild(searchWrap)

  // 列表
  const list = mk('div', 'flex:1;overflow-y:auto;padding:8px')
  drawer.appendChild(list)

  const footer = mk('div', 'display:flex;align-items:center;justify-content:space-between;padding:10px 18px;border-top:1px solid #f1f5f9;background:#f8fafc;font-size:11px;color:#94a3b8')

  api('/list-components', { method: 'POST', body: JSON.stringify({}) }).then(function () {}).catch(function () {})

  // 内置组件目录
  const catalog = [
    { group: 'antdv/通用', items: [
      { tag: 'a-button', label: 'Button 按钮', snippet: '<a-button type="primary">按钮</a-button>' },
      { tag: 'a-tag', label: 'Tag 标签', snippet: '<a-tag color="blue">标签</a-tag>' },
    ]},
    { group: 'antdv/布局', items: [
      { tag: 'a-divider', label: 'Divider 分割线', snippet: '<a-divider />' },
      { tag: 'a-space',   label: 'Space 间距',    snippet: '<a-space><span>项</span></a-space>' },
    ]},
    { group: 'antdv/表单', items: [
      { tag: 'a-input',           label: 'Input 输入框',    snippet: '<a-input placeholder="请输入" />' },
      { tag: 'a-input-password',  label: 'InputPassword 密码框', snippet: '<a-input-password placeholder="请输入密码" />' },
      { tag: 'a-select',         label: 'Select 选择器',   snippet: '<a-select placeholder="请选择" style="width:100%" />' },
      { tag: 'a-date-picker',     label: 'DatePicker 日期', snippet: '<a-date-picker style="width:100%" />' },
      { tag: 'a-switch',         label: 'Switch 开关',    snippet: '<a-switch />' },
      { tag: 'a-checkbox',       label: 'Checkbox 复选',  snippet: '<a-checkbox>复选框</a-checkbox>' },
      { tag: 'a-radio',          label: 'Radio 单选',     snippet: '<a-radio value="a">选项</a-radio>' },
    ]},
    { group: 'antdv/反馈', items: [
      { tag: 'a-alert', label: 'Alert 提示', snippet: '<a-alert message="提示信息" type="info" show-icon />' },
    ]},
    { group: 'antdv/数据展示', items: [
      { tag: 'a-card', label: 'Card 卡片', snippet: '<a-card title="标题"><p>内容</p></a-card>' },
    ]},
  ]

  function render(filter: string) {
    list.innerHTML = ''
    let any = false
    catalog.forEach(function (g) {
      const matched = g.items.filter(function (it) {
        return !filter || it.label.toLowerCase().indexOf(filter) >= 0 || it.tag.indexOf(filter) >= 0
      })
      if (!matched.length) return
      any = true
      const gt = mk('div', 'padding:8px 10px 4px;font-size:11px;font-weight:600;color:#94a3b8;letter-spacing:.5px', g.group)
      list.appendChild(gt)
      matched.forEach(function (it) {
        const row = mk('div', 'display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:3px;cursor:pointer;transition:background .12s')
        row.onmouseenter = function () { row.style.background = '#f1f5f9' }
        row.onmouseleave = function () { row.style.background = 'transparent' }

        const icon = mk('div', 'width:28px;height:28px;display:flex;align-items:center;justify-content:center;background:#f1f5f9;border-radius:3px;font-size:13px;color:#475569;flex-shrink:0;font-family:monospace', it.tag.substring(0, 2))
        const tx = mk('div', 'flex:1;min-width:0')
        const t1 = mk('div', 'font-size:12px;font-weight:600;color:#1e293b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis', it.label)
        const t2 = mk('div', 'font-size:10px;color:#94a3b8;font-family:monospace;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis', it.tag)
        tx.append(t1, t2); row.append(icon, tx)

        row.onclick = function () {
          if (!s.sel) { footer.textContent = '请先选中一个元素再插入'; return }
          const d = pa(s.sel.getAttribute(s.A)!)
          const dir = s.insertDirection === 'before' ? 'before' : s.insertDirection === 'after' ? 'after' : 'inside'
          api('/insert-component', { method: 'POST', body: JSON.stringify({ file: d.f, line: +d.l, col: +d.c, componentTag: it.tag, direction: dir }) })
            .then(function (r: any) {
              if (r && r.success) { footer.textContent = '已插入 ' + it.tag + '（HMR 刷新中）' }
              else footer.textContent = (r && r.error) || '插入失败'
            })
        }
        list.appendChild(row)
      })
    })
    if (!any) list.appendChild(mk('div', 'text-align:center;color:#cbd5e1;font-size:12px;padding:24px 0', '无匹配组件'))
  }

  render('')
  search.oninput = function () { render(search.value.trim().toLowerCase()) }
  drawer.appendChild(footer)
}

// keep drawSel referenced (drawer triggers HMR; selection may re-render)
void drawSel