/**
 * 全局事件绑定 + 初始化。
 *
 *   mousemove    悬停追踪（跳过 deleteButton/copyButton 区域，免闪烁）
 *   click        菜单关闭 / 复制按钮 / 删除按钮 / 选中切换
 *   contextmenu  右键弹出菜单
 *   keydown      Esc 逐级关闭（抽屉 → 面板 → 退出审查）+ 快捷键开关
 *   scroll/resize 重绘 overlay
 *   createUI()   初始化 + 控制台就绪日志
 */
import { state, clientConfig } from './state'
import { findInspectableElement, parsePosition, createElement } from './utils'
import { createUI, hover, hide, redrawSelection, toggle, duplicateElement, deleteElement } from './inspector'
import { showMenu } from './menu'
import { closePanel } from './panel'
import { closeDrawer } from './drawer'

/** Heroicons (MIT) 齿轮 SVG path */
const GEAR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" 
       width="20" height="20" 
       viewBox="0 0 24 24" 
       fill="rgb(226, 232, 240)">
    <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
  </svg>`

/** 快捷键判定 */
function isShortcut(e: KeyboardEvent): boolean {
  const shortcut = clientConfig.shortcut
  return !!shortcut.altKey === e.altKey
    && !!shortcut.shiftKey === e.shiftKey
    && !!shortcut.ctrlKey === e.ctrlKey
    && !!shortcut.metaKey === e.metaKey
    && e.code === shortcut.code
}

/** 绑定所有事件 + 初始化 UI */
export function init(): void {
  document.addEventListener('mousemove', function (e) {
    if (!state.inspecting) return
    const el = findInspectableElement(e.target)
    /* 鼠标在操作按钮上时不触发悬停切换，避免闪烁 */
    if ((state.deleteButton!.style.display === 'flex' && state.deleteButton!.contains(e.target as Node))
     || (state.copyButton!.style.display === 'flex' && state.copyButton!.contains(e.target as Node))
     || (state.insertBeforeButton!.style.display === 'flex' && state.insertBeforeButton!.contains(e.target as Node))
     || (state.insertAfterButton!.style.display === 'flex' && state.insertAfterButton!.contains(e.target as Node))) return
    if (el !== state.hoveredElement) { state.hoveredElement = el; el ? hover(el) : hide() }
  }, true)

  document.addEventListener('click', function (e) {
    /* 点击菜单内部先处理菜单关闭 */
    if (state.contextMenu!.style.display === 'block') {
      if (state.contextMenu!.contains(e.target as Node)) { state.contextMenu!.style.display = 'none'; return }
      state.contextMenu!.style.display = 'none'
    }
    if (!state.inspecting || !state.hoveredElement) return

    /* 复制按钮 */
    if (state.copyButton!.style.display === 'flex' && state.copyButton!.contains(e.target as Node)) {
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation()
      duplicateElement(state.selectedElement!); return
    }
    /* 删除按钮 */
    if (state.deleteButton!.style.display === 'flex' && state.deleteButton!.contains(e.target as Node)) {
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation()
      deleteElement(state.selectedElement!); return
    }
    /* 同级插入 + 按钮（上方/下方）— 动作在按钮自身 onclick 中触发
       （openDrawerFor），捕获阶段只 return，不能 stopImmediatePropagation，
       否则按钮的冒泡阶段 onclick 会被阻断，抽屉打不开 */
    if (state.insertBeforeButton!.style.display === 'flex' && state.insertBeforeButton!.contains(e.target as Node)) {
      return
    }
    if (state.insertAfterButton!.style.display === 'flex' && state.insertAfterButton!.contains(e.target as Node)) {
      return
    }

    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation()
    state.selectedElement = (state.selectedElement === state.hoveredElement) ? null : state.hoveredElement; redrawSelection()
  }, true)

  document.addEventListener('contextmenu', function (e) {
    if (!state.inspecting) return
    const el = findInspectableElement(e.target)
    if (!el) return
    e.preventDefault()
    state.hoveredElement = el; hover(el); showMenu(e.clientX, e.clientY, el)
  }, true)

  document.addEventListener('keydown', function (e) {
    if (e.code === 'Escape') {
      if (state.componentDrawer)  { closeDrawer(); return }
      if (state.propPanel)   { closePanel(); return }
      state.contextMenu!.style.display = 'none'
      state.selectedElement = null; state.selectOverlay!.style.display = 'none'
      state.deleteButton!.style.display = 'none'; state.copyButton!.style.display = 'none'
      state.insertBeforeButton!.style.display = 'none'; state.insertAfterButton!.style.display = 'none'
      toggle(false); return
    }
    if (isShortcut(e)) { e.preventDefault(); toggle() }
  })

  window.addEventListener('scroll', function () { if (state.inspecting) { state.hoveredElement && hover(state.hoveredElement); redrawSelection() } }, true)
  window.addEventListener('resize', function () { if (state.inspecting) { state.hoveredElement && hover(state.hoveredElement); redrawSelection() } })

  /* 启动 */
  createUI()

  /* 右下角齿轮按钮（配置可控） */
  if (clientConfig.toggleBtn) {
    const gearButton = createElement('div', '__vdi-gear-btn')
    gearButton.title = '开启审查模式'
    gearButton.innerHTML = GEAR_SVG
    gearButton.style = 'opacity: 0.7;transform: scale(1)';
    gearButton.onmouseenter = function () { gearButton.style.opacity = '1'; gearButton.style.transform = 'scale(1.1)' }
    gearButton.onmouseleave = function () { gearButton.style.opacity = '.7'; gearButton.style.transform = 'scale(1)' }
    gearButton.onclick = function (e) {
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation()
      toggle()
    }
    document.body.appendChild(gearButton)
    state.gearButton = gearButton
  }

  console.log('%c[Vue Dev Inspector]%c Ready — Alt+Shift+I to inspect', 'color:#10b981;font-weight:bold', 'color:inherit')
}