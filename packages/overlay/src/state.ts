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

export const clientConfig: ClientCfg = window.__DEV_INSPECTOR_CFG__

/** 全局可变状态 — 各模块通过 state.xxx 读写 */
export const state = {
  /** 配置常量快捷引用 */
  attrName: clientConfig.attrName,
  protocol: clientConfig.protocol,
  projectRoot: clientConfig.projectRoot,
  apiPrefix: clientConfig.apiPrefix,
  tagAttr: clientConfig.tagAttr,
  editor: clientConfig.editor,

  /** 审查开关与当前悬停、选中元素 */
  inspecting: false,
  hoveredElement: null as HTMLElement | null,
  selectedElement: null as HTMLElement | null,

  /** 悬停框 / 选中框 / 标签 */
  hoverOverlay: null as HTMLDivElement | null,
  selectOverlay: null as HTMLDivElement | null,
  tagTip: null as HTMLDivElement | null,

  /** 右键菜单 / 删除按钮 / 复制按钮 */
  contextMenu: null as HTMLDivElement | null,
  deleteButton: null as HTMLDivElement | null,
  copyButton: null as HTMLDivElement | null,

  /** 组件抽屉 */
  componentDrawer: null as HTMLDivElement | null,

  /** 属性编辑面板 */
  propPanel: null as HTMLDivElement | null,
  panelData: { file: '', line: 0, col: 0, tag: '', entries: [] as PropEntry[] } as PanelData,

  /** 右下角齿轮按钮（点击开启审查，开启后隐藏） */
  gearButton: null as HTMLDivElement | null,

  /** 选中框上方/下方的 + 按钮（同级插入） */
  insertBeforeButton: null as HTMLDivElement | null,
  insertAfterButton: null as HTMLDivElement | null,

}