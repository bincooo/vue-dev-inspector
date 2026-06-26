/**
 * 属性编辑面板。
 */
import { state } from './state'
import { parsePosition, apiRequest, getElementTagName, createElement } from './utils'
import { escapeHtml } from './escapeHtml'

/** 关闭浮层 */
export function closePanel() { if (state.propPanel) { state.propPanel.remove(); state.propPanel = null } }

/** 弹出属性编辑模态 */
export function openPanel(el: HTMLElement): void {
  closePanel()
  state.contextMenu!.style.display = 'none'
  const pos = parsePosition(el.getAttribute(state.attrName)!)
  state.panelData = { file: pos.file, line: +pos.line, col: +pos.col, tag: el.tagName.toLowerCase(), entries: [] }

  const mask = createElement('div', '__vdi-panel-mask')
  mask.onmousedown = function (e: MouseEvent) { if (e.target === mask) closePanel() }

  const card = createElement('div', '__vdi-prop-card')

  const header = createElement('div', '__vdi-prop-header')
  header.innerHTML = '<div><div class="__vdi-prop-title">⚙️ 编辑属性</div>'
    + '<div class="__vdi-prop-subtitle">'
    + escapeHtml(getElementTagName(el)) + ' · ' + escapeHtml(pos.file) + ':' + pos.line
    + '<span class="__vdi-loading-hint">  加载中…</span></div></div>'
  const closeButton = createElement('button', '__vdi-close-btn', '✕') as any
  closeButton.onclick = closePanel; header.appendChild(closeButton)

  const list = createElement('div', '__vdi-prop-body')

  const footer = createElement('div', '__vdi-prop-footer')
  const hint = createElement('span', '__vdi-prop-hint', '修改后基于 AST 回写源码，Vite 自动热更新')
  const saveButton = createElement('button', '__vdi-save-btn', '💾 保存') as any
  saveButton.onclick = function () { submit(el) }
  footer.append(hint, saveButton)

  card.append(header, list, footer); mask.appendChild(card); document.body.appendChild(mask); state.propPanel = mask

  apiRequest('/get-props', { method: 'POST', body: JSON.stringify({ file: state.panelData.file, line: state.panelData.line, col: state.panelData.col }) })
    .then(function (response: any) {
      const loadingHint = header.querySelector('.__vdi-loading-hint'); if (loadingHint) loadingHint.remove()
      if (response && response.props) state.panelData.entries = response.props.map(function (prop: any) { return { key: prop.key, value: prop.value } })
      renderList(list)
    })
    .catch(function () { const loadingHint = header.querySelector('.__vdi-loading-hint'); if (loadingHint) loadingHint.textContent = '  读取失败' })
}

/** 渲染属性行 */
export function renderList(list: HTMLDivElement): void {
  list.innerHTML = ''
  if (!state.panelData.entries.length)
    list.appendChild(createElement('div', '__vdi-prop-empty-hint', '暂无属性，点击下方添加'))

  state.panelData.entries.forEach(function (entry, index) {
    const row = createElement('div', '__vdi-prop-row')
    const keyInput = createElement('input', '__vdi-prop-input __vdi-prop-key') as HTMLInputElement
    keyInput.value = entry.key; keyInput.placeholder = '属性名'; keyInput.oninput = function () { entry.key = keyInput.value }
    const equalsSign = createElement('span', '__vdi-prop-eq', '=')
    const valueInput = createElement('input', '__vdi-prop-input __vdi-prop-value') as HTMLInputElement
    valueInput.value = entry.value; valueInput.placeholder = '值（可空）'; valueInput.oninput = function () { entry.value = valueInput.value }
    const removeButton = createElement('button', '__vdi-prop-remove', '✕') as any
    removeButton.onmouseenter = function () { removeButton.style.color = '#ef4444'; removeButton.style.background = '#fef2f2' }
    removeButton.onmouseleave = function () { removeButton.style.color = '#cbd5e1'; removeButton.style.background = 'none' }
    removeButton.onclick = function () { state.panelData.entries.splice(index, 1); renderList(list) }
    row.append(keyInput, equalsSign, valueInput, removeButton); list.appendChild(row)
  })

  // 新增行
  const addRow = createElement('div', '__vdi-prop-add-row')
  const newKeyInput = createElement('input', '__vdi-prop-input __vdi-new-input') as HTMLInputElement
  newKeyInput.placeholder = '新属性名'
  const equalsSign2 = createElement('span', '__vdi-prop-eq', '=')
  const newValueInput = createElement('input', '__vdi-prop-input __vdi-prop-value __vdi-new-input') as HTMLInputElement
  newValueInput.placeholder = '值'
  const addButton = createElement('button', '__vdi-add-btn', '＋ 添加') as any
  const doAdd = function () {
    if (!newKeyInput.value.trim()) return
    state.panelData.entries.push({ key: newKeyInput.value.trim(), value: newValueInput.value }); newKeyInput.value = ''; newValueInput.value = ''; renderList(list)
  }
  addButton.onclick = doAdd
  newKeyInput.onkeydown = function (e: KeyboardEvent) { if (e.key === 'Enter') doAdd() }
  newValueInput.onkeydown = newKeyInput.onkeydown
  addRow.append(newKeyInput, equalsSign2, newValueInput, addButton); list.appendChild(addRow)
}

/** 收集 entries 回写源码 */
export function submit(el: HTMLElement): void {
  apiRequest('/update-props', {
    method: 'POST',
    body: JSON.stringify({
      file: state.panelData.file, line: state.panelData.line, col: state.panelData.col,
      props: state.panelData.entries.map(function (entry) { return { key: entry.key, value: entry.value } }),
    }),
  }).then(function (response: any) {
    if (response && response.success) {
      closePanel()
      console.log('%c[Vue DevInspector]%c 属性已更新', 'color:#10b981;font-weight:bold', 'color:inherit')
    }
  })
}