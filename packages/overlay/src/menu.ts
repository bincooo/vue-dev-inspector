/**
 * 右键菜单。
 */
import { state } from './state'
import { parsePosition, apiRequest, getElementTagName, createElement } from './utils'
import { escapeHtml } from './escapeHtml'
import { redrawSelection } from './inspector'
import { openPanel } from './panel'
import { openDrawer } from './drawer'

export function showMenu(x: number, y: number, element: HTMLElement): void {
  const pos = parsePosition(element.getAttribute(state.attrName)!)
  const tag = getElementTagName(element)
  state.contextMenu!.style.display = 'block'
  state.contextMenu!.style.left = Math.min(x, innerWidth - 220) + 'px'
  state.contextMenu!.style.top = Math.min(y, innerHeight - 200) + 'px'

  // 标题区
  state.contextMenu!.innerHTML =
    '<div class="__vdi-menu-title">'
    + '<div class="__vdi-menu-title-tag">' + escapeHtml(tag) + '</div>'
    + '<div class="__vdi-menu-title-path">'
      + escapeHtml(pos.file) + ':' + pos.line + ':' + pos.col + '</div>'
    + '</div>'

  const menuItems = [
    { label: '📦 在编辑器中打开', action: 'open' },
    { label: '⚙️ 编辑属性', action: 'props' },
    { label: '🧩 组件面板', action: 'catalog' },
    { label: '📋 复制路径', action: 'copy' },
    { label: '🗑️ 删除', action: 'del', isDanger: true },
  ]

  menuItems.forEach(function (option) {
    const button = createElement('button',
      '__vdi-menu-item ' + (option.isDanger ? '__vdi-menu-item--danger' : '__vdi-menu-item--normal'),
      option.label
    ) as any
    button.onmouseenter = function () { button.style.backgroundColor = option.isDanger ? '#fee2e2' : '#f1f5f9' }
    button.onmouseleave = function () { button.style.backgroundColor = option.isDanger ? '#fef2f2' : 'transparent' }
    button.onclick = function () {
      if (option.action === 'copy') {
        navigator.clipboard.writeText(state.protocol + state.projectRoot + '/' + pos.file + ':' + pos.line + ':' + pos.col)
        state.contextMenu!.style.display = 'none'
      }
      if (option.action === 'open') {
        apiRequest('/open-in-editor', { method: 'POST', body: JSON.stringify({ file: pos.file, line: +pos.line, col: +pos.col, editor: state.editor }) })
        state.contextMenu!.style.display = 'none'
      }
      if (option.action === 'del') {
        apiRequest('/delete-element', { method: 'POST', body: JSON.stringify({ file: pos.file, line: +pos.line, col: +pos.col, tag }) })
          .then(function () { if (state.selectedElement === element) { state.selectedElement = null; redrawSelection() } element.remove(); state.contextMenu!.style.display = 'none' })
      }
      if (option.action === 'props') openPanel(element)
      if (option.action === 'catalog') openDrawer()
    }
    state.contextMenu!.appendChild(button)
  })
}