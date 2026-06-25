/**
 * 审查层 — overlay UI 创建与状态机。
 *
 *   createUI   创建所有固定定位的浮层（悬停框/选中框/标签/菜单/删除/复制按钮）
 *   dupEl      复制选中元素（调 /duplicate-element，AST 同级副本）
 *   delEl      删除选中元素（调 /delete-element）
 *   posAction  定位「复制 / 删除」两按钮到选中框右下角
 *   hover      悬停时更新虚线框与标签
 *   hide       收起悬停态
 *   drawSel    重绘选中框 + 联动按钮显隐
 *   toggle     开关审查模式（关时清一切浮层，含 copBtn）
 */
import { s } from './state'
import { pa, api, tagName, mk, boxOf, pos } from './utils'
import { openDrawerFor } from './drawer'

/** 创建所有 UI 浮层并挂到 DOM */
export function createUI(): void {
  const _ov = mk('div', 'position:fixed;pointer-events:none;z-index:9996;border:1px dashed #475569;background:rgba(71,85,105,0.06);transition:all .12s ease-out;display:none')
  const _sov = mk('div', 'position:fixed;pointer-events:none;z-index:9995;border:1px solid #3b82f6;background:rgba(59,130,246,.10);display:none')
  const _tip = mk('div', 'position:fixed;z-index:9999;pointer-events:none;background:#5377aa;color:#e2e8f0;padding:4px 10px;border-radius:3px;font-size:11px;font-weight:600;font-family:ui-monospace,"SF Mono",Menlo,Consolas,monospace;white-space:nowrap;box-shadow:0 4px 14px rgba(15,23,42,.22);display:none')
  const _menu = mk('div', 'position:fixed;z-index:9999;display:none;min-width:200px;padding:6px 0;background:#fff;border-radius:3px;border:1px solid #e2e8f0;box-shadow:0 8px 24px rgba(0,0,0,.15);font-family:system-ui,sans-serif')
  const _delBtn = mk('div', 'position:fixed;z-index:9998;pointer-events:auto;width:16px;height:16px;display:none;align-items:center;justify-content:center;background:#ef4444;color:#fff;border-radius:3px;font-size:11px;line-height:1;cursor:pointer;user-select:none;box-shadow:0 1px 4px rgba(239,68,68,.35)', '×')
  _delBtn.onmouseenter = function () { _delBtn.style.background = '#dc2626' }
  _delBtn.onmouseleave = function () { _delBtn.style.background = '#ef4444' }
  const _copBtn = mk('div', 'position:fixed;z-index:9998;pointer-events:auto;width:16px;height:16px;display:none;align-items:center;justify-content:center;background:#3b82f6;color:#fff;border-radius:3px;font-size:11px;line-height:1;cursor:pointer;user-select:none;box-shadow:0 1px 4px rgba(59,130,246,.35)', '⧉')
  _copBtn.onmouseenter = function () { _copBtn.style.background = '#2563eb' }
  _copBtn.onmouseleave = function () { _copBtn.style.background = '#3b82f6' }

  /* 上方/下方同级插入按钮 */
  const _insBeforeBtn = mkInsertBtn()
  _insBeforeBtn.title = '在同级上方插入组件'
  _insBeforeBtn.onclick = function (e) {
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation()
    s.insertDirection = 'before'; openDrawerFor('before')
  }
  const _insAfterBtn = mkInsertBtn()
  _insAfterBtn.title = '在同级下方插入组件'
  _insAfterBtn.onclick = function (e) {
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation()
    s.insertDirection = 'after'; openDrawerFor('after')
  }

  ;[_ov, _sov, _tip, _menu, _delBtn, _copBtn, _insBeforeBtn, _insAfterBtn].forEach(function (e) { document.body.appendChild(e) })
  s.ov = _ov; s.sov = _sov; s.tip = _tip; s.menu = _menu; s.delBtn = _delBtn; s.copBtn = _copBtn
  s.insertBeforeBtn = _insBeforeBtn; s.insertAfterBtn = _insAfterBtn
}

/** 构造一个 + 插入按钮 */
function mkInsertBtn(): HTMLDivElement {
  const b = mk('div', 'position:fixed;z-index:9998;pointer-events:auto;width:16px;height:16px;padding-bottom:1px;display:none;align-items:center;justify-content:center;background-color:#3a78fc;color:#fff;border-radius:50%;font-size:13px;line-height:1;cursor:pointer;user-select:none;transition:transform .12s,background .12s', '+')
  return b
}

/** 复制元素 */
export function dupEl(el: HTMLElement): void {
  const d = pa(el.getAttribute(s.A)!)
  api('/duplicate-element', { method: 'POST', body: JSON.stringify({ file: d.f, line: +d.l, col: +d.c }) })
    .then(function (r: any) {
      if (r && r.success) console.log('%c[Vue DevInspector]%c 元素已复制', 'color:#3b82f6;font-weight:bold', 'color:inherit')
    })
}

/** 删除元素 */
export function delEl(el: HTMLElement): void {
  const d = pa(el.getAttribute(s.A)!)
  const tag = tagName(el)
  api('/delete-element', { method: 'POST', body: JSON.stringify({ file: d.f, line: +d.l, col: +d.c, tag }) })
    .then(function () { if (s.sel === el) { s.sel = null; drawSel() } el.remove() })
}

/** 定位 复制/删除 按钮到选中框右下角；定位 +/- 同级插入按钮到上下边框中点 */
export function posAction(): void {
  if (!s.sel || !s.sov || s.sov.style.display === 'none') {
    s.delBtn!.style.display = 'none'
    s.copBtn!.style.display = 'none'
    s.insertBeforeBtn!.style.display = 'none'
    s.insertAfterBtn!.style.display = 'none'
    return
  }
  const sr = boxOf(s.sel)!.getBoundingClientRect()
  /* 复制/删除：右下角 */
  s.delBtn!.style.display = 'flex'
  s.delBtn!.style.left = (sr.right - 18) + 'px'
  s.delBtn!.style.top = (sr.bottom - 18) + 'px'
  s.copBtn!.style.display = 'flex'
  s.copBtn!.style.left = (sr.right - 36) + 'px'
  s.copBtn!.style.top = (sr.bottom - 18) + 'px'
  /* 同级插入：上边框中点 / 下边框中点 */
  s.insertBeforeBtn!.style.display = 'flex'
  s.insertBeforeBtn!.style.left = (sr.left + sr.width / 2 - 9) + 'px'
  s.insertBeforeBtn!.style.top = (sr.top - 9) + 'px'
  s.insertAfterBtn!.style.display = 'flex'
  s.insertAfterBtn!.style.left = (sr.left + sr.width / 2 - 9) + 'px'
  s.insertAfterBtn!.style.top = (sr.bottom - 9) + 'px'
}

/** 悬停态 */
export function hover(el: HTMLElement): void {
  if (!el || !s.ov) return
  if (el === s.sel) s.ov.style.display = 'none'; else pos(s.ov, el, 1)
  s.tip!.textContent = tagName(el)
  s.tip!.style.display = 'block'
  const r = boxOf(el)!.getBoundingClientRect()
  s.tip!.style.left = Math.max(0, r.left) + 'px'
  s.tip!.style.top = Math.max(0, r.top - 24) + 'px'
}

/** 收起悬停态 */
export function hide(): void {
  s.ov!.style.display = 'none'
  s.tip!.style.display = 'none'
  s.cur = null
}

/** 选中框重绘 */
export function drawSel(): void {
  if (!s.sov) return
  if (s.sel && document.body.contains(s.sel)) { pos(s.sov, s.sel, 1); posAction() }
  else {
    s.sov.style.display = 'none'
    s.delBtn!.style.display = 'none'; s.copBtn!.style.display = 'none'
    s.insertBeforeBtn!.style.display = 'none'; s.insertAfterBtn!.style.display = 'none'
    s.sel = null
  }
}

/** 审查开关 */
export function toggle(f?: boolean): void {
  s.on = f !== undefined ? f : !s.on
  if (!s.on) {
    hide(); s.sel = null; s.sov!.style.display = 'none'
    s.delBtn!.style.display = 'none'; s.copBtn!.style.display = 'none'
    s.insertBeforeBtn!.style.display = 'none'; s.insertAfterBtn!.style.display = 'none'
  }
  /* 齿轮按钮：审查开启时隐藏，关闭时显示 */
  if (s.gearBtn) s.gearBtn.style.display = s.on ? 'none' : 'flex'
}