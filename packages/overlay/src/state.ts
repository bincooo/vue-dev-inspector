import type { ClientCfg, PanelData, PropEntry } from './types'

/**
 * 所有跨模块共享的可变状态集中在一个对象上。
 *
 * 原来的 IIFE 字符串用闭包变量共享状态；模块化后
 * let 导出不是 live binding，所以用一个可变对象代替。
 */

declare global {
  var __DEV_INSPECTOR_CFG__: ClientCfg
}

export const cfg: ClientCfg = window.__DEV_INSPECTOR_CFG__

/** 全局可变状态 — 各模块通过 s.xxx 读写 */
export const s = {
  /** 配置常量快捷引用 */
  A: cfg.attrName,
  P: cfg.protocol,
  R: cfg.projectRoot,
  API: cfg.apiPrefix,
  TAG_ATTR: cfg.tagAttr,
  EDT: cfg.editor,

  /** 审查开关与当前悬停、选中元素 */
  on: false,
  cur: null as HTMLElement | null,
  sel: null as HTMLElement | null,

  /** 悬停框 / 选中框 / 标签 */
  ov: null as HTMLDivElement | null,
  sov: null as HTMLDivElement | null,
  tip: null as HTMLDivElement | null,

  /** 右键菜单 / 删除按钮 / 复制按钮 */
  menu: null as HTMLDivElement | null,
  delBtn: null as HTMLDivElement | null,
  copBtn: null as HTMLDivElement | null,

  /** 组件抽屉 */
  drawer: null as HTMLDivElement | null,

  /** 属性编辑面板 */
  panel: null as HTMLDivElement | null,
  pdata: { file: '', line: 0, col: 0, tag: '', entries: [] as PropEntry[] } as PanelData,

  /** 右下角齿轮按钮（点击开启审查，开启后隐藏） */
  gearBtn: null as HTMLDivElement | null,

  /** 选中框上方/下方的 + 按钮（同级插入） */
  insertBeforeBtn: null as HTMLDivElement | null,
  insertAfterBtn: null as HTMLDivElement | null,

  /** 同级插入方向 'before' | 'after' */
  insertDirection: 'before' as 'before' | 'after',
}
