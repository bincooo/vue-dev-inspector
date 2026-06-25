/**
 * 全局事件绑定 + 初始化。
 *
 *   mousemove    悬停追踪（跳过 delBtn/copBtn 区域，免闪烁）
 *   click        菜单关闭 / 复制按钮 / 删除按钮 / 选中切换
 *   contextmenu  右键弹出菜单
 *   keydown      Esc 逐级关闭（抽屉 → 面板 → 退出审查）+ 快捷键开关
 *   scroll/resize 重绘 overlay
 *   createUI()   初始化 + 控制台就绪日志
 */
import { s } from './state'
import { cfg } from './state'
import { find, pa, mk } from './utils'
import { createUI, hover, hide, drawSel, toggle, dupEl, delEl } from './inspector'
import { showMenu } from './menu'
import { closePanel } from './panel'
import { closeDrawer, openDrawerFor } from './drawer'

/** 快捷键判定 */
function isShortcut(e: KeyboardEvent): boolean {
  const k = cfg.shortcut
  return !!k.altKey === e.altKey
    && !!k.shiftKey === e.shiftKey
    && !!k.ctrlKey === e.ctrlKey
    && !!k.metaKey === e.metaKey
    && e.code === k.code
}

/** 绑定所有事件 + 初始化 UI */
export function init(): void {
  document.addEventListener('mousemove', function (e) {
    if (!s.on) return
    const el = find(e.target)
    /* 鼠标在操作按钮上时不触发悬停切换，避免闪烁 */
    if ((s.delBtn!.style.display === 'flex' && s.delBtn!.contains(e.target as Node))
     || (s.copBtn!.style.display === 'flex' && s.copBtn!.contains(e.target as Node))
     || (s.insertBeforeBtn!.style.display === 'flex' && s.insertBeforeBtn!.contains(e.target as Node))
     || (s.insertAfterBtn!.style.display === 'flex' && s.insertAfterBtn!.contains(e.target as Node))) return
    if (el !== s.cur) { s.cur = el; el ? hover(el) : hide() }
  }, true)

  document.addEventListener('click', function (e) {
    /* 点击菜单内部先处理菜单关闭 */
    if (s.menu!.style.display === 'block') {
      if (s.menu!.contains(e.target as Node)) { s.menu!.style.display = 'none'; return }
      s.menu!.style.display = 'none'
    }
    if (!s.on || !s.cur) return

    /* 复制按钮 */
    if (s.copBtn!.style.display === 'flex' && s.copBtn!.contains(e.target as Node)) {
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation()
      dupEl(s.sel!); return
    }
    /* 删除按钮 */
    if (s.delBtn!.style.display === 'flex' && s.delBtn!.contains(e.target as Node)) {
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation()
      delEl(s.sel!); return
    }
    /* 同级插入 + 按钮（上方/下方）— 动作在按钮自身 onclick 中触发
       （openDrawerFor），捕获阶段只 return，不能 stopImmediatePropagation，
       否则按钮的冒泡阶段 onclick 会被阻断，抽屉打不开 */
    if (s.insertBeforeBtn!.style.display === 'flex' && s.insertBeforeBtn!.contains(e.target as Node)) {
      return
    }
    if (s.insertAfterBtn!.style.display === 'flex' && s.insertAfterBtn!.contains(e.target as Node)) {
      return
    }

    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation()
    s.sel = (s.sel === s.cur) ? null : s.cur; drawSel()
  }, true)

  document.addEventListener('contextmenu', function (e) {
    if (!s.on) return
    const el = find(e.target)
    if (!el) return
    e.preventDefault()
    s.cur = el; hover(el); showMenu(e.clientX, e.clientY, el)
  }, true)

  document.addEventListener('keydown', function (e) {
    if (e.code === 'Escape') {
      if (s.drawer)  { closeDrawer(); return }
      if (s.panel)   { closePanel(); return }
      s.menu!.style.display = 'none'
      s.sel = null; s.sov!.style.display = 'none'
      s.delBtn!.style.display = 'none'; s.copBtn!.style.display = 'none'
      s.insertBeforeBtn!.style.display = 'none'; s.insertAfterBtn!.style.display = 'none'
      toggle(false); return
    }
    if (isShortcut(e)) { e.preventDefault(); toggle() }
  })

  window.addEventListener('scroll', function () { if (s.on) { s.cur && hover(s.cur); drawSel() } }, true)
  window.addEventListener('resize', function () { if (s.on) { s.cur && hover(s.cur); drawSel() } })

  /* 启动 */
  createUI()

  /* 右下角齿轮按钮（配置可控） */
  if (cfg.toggleBtn) {
    const gear = mk('div',
      'position:fixed;bottom:20px;right:20px;z-index:9997;width:36px;height:36px;display:flex;align-items:center;justify-content:center;'
      + 'background:#1e293b;color:#e2e8f0;border-radius:50%;cursor:pointer;user-select:none;font-size:26px;line-height:1;padding-bottom:1px;'
      + 'box-shadow:0 2px 10px rgba(15,23,42,.35);transition:opacity .2s,transform .2s;opacity:.7',
      '⚙')
    gear.title = '开启审查模式'
    gear.onmouseenter = function () { gear.style.opacity = '1'; gear.style.transform = 'scale(1.1)' }
    gear.onmouseleave = function () { gear.style.opacity = '.7'; gear.style.transform = 'scale(1)' }
    gear.onclick = function (e) {
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation()
      toggle()
    }
    document.body.appendChild(gear)
    s.gearBtn = gear
  }

  console.log('%c[Vue Dev Inspector]%c Ready — Alt+Shift+I to inspect', 'color:#10b981;font-weight:bold', 'color:inherit')
}