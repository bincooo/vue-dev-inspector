/**
 * 所有跨模块共享的可变状态集中在一个对象上。
 *
 * 原来的 IIFE 字符串用闭包变量共享状态；模块化后
 * let 导出不是 live binding，所以用一个可变对象代替。
 */

import type { ClientCfg, PropEntry } from "./types";

declare global {
  var __DEV_INSPECTOR_CFG__: ClientCfg;
}

export const clientConfig: ClientCfg = window.__DEV_INSPECTOR_CFG__;

/** 拖拽放置方向（占目标元素盒的 Y 三分位） */
export type DropDirection = "before" | "inside" | "after";

/** 全局可变状态 — 各模块通过 state.xxx 读写 */
export const state = {
  /** 配置常量快捷引用 */
  attrName: clientConfig.attrName,
  protocol: clientConfig.protocol,
  /** 多根目录列表 — monorepo 跨子工程编辑的标识 */
  projectRoots: clientConfig.projectRoots ?? ['.'],
  apiPrefix: clientConfig.apiPrefix,
  tagAttr: clientConfig.tagAttr,
  editor: clientConfig.editor,

  /** 抽屉左侧竖列 tab：每个 entry 一个物料库；空时 drawer 回退内置默认 */
  componentEntries: clientConfig.componentEntries ?? [],

  /** 抽屉当前激活的物料 tab 下标（每次打开抽屉时由 drawer 决定默认值） */
  activeEntryIndex: 0,

  /** iconify 解析后的 SVG 缓存（key = `i-prefix:name`，value = svg 字符串） */
  iconCache: {} as Record<string, string>,

  /** 审查开关与当前悬停、选中元素 */
  inspecting: false,
  hoveredElement: null as HTMLElement | null,
  selectedElement: null as HTMLElement | null,

  /** 悬停框 / 选中框 / 标签 */
  hoverOverlay: null as HTMLDivElement | null,
  selectOverlay: null as HTMLDivElement | null,
  tagTip: null as HTMLDivElement | null,

  /** 右键菜单 */
  contextMenu: null as HTMLDivElement | null,

  /** 选中框右下角的「复制 / 删除」按钮 */
  deleteButton: null as HTMLDivElement | null,
  copyButton: null as HTMLDivElement | null,

  /** 选中框上下边中点的「同级插入 +」按钮 */
  insertBeforeButton: null as HTMLDivElement | null,
  insertAfterButton: null as HTMLDivElement | null,

  /** 拖拽放置指示器 */
  dropIndicator: null as HTMLDivElement | null,

  /** 组件抽屉 + 抽屉外层遮罩 */
  componentDrawer: null as HTMLDivElement | null,

  /** 属性编辑面板 */
  propPanel: null as HTMLDivElement | null,
  panelData: {
    rootIndex: 0,
    file: "",
    line: 0,
    col: 0,
    tag: "",
    entries: [] as PropEntry[],
  },

  /** 右下角齿轮按钮（点击开启审查，开启后隐藏） */
  gearButton: null as HTMLDivElement | null,

  /* ─── 拖拽（Ctrl + 鼠标按下进入，mouseup 提交 /move-element） ─── */
  dragging: false,
  dragSource: null as HTMLElement | null,
  dropTarget: null as HTMLElement | null,
  dropDirection: null as DropDirection | null,
};

/** 选中框旁的 4 个动作按钮：getter 数组，每次访问都拿最新引用。 */
export function actionButtons(): (HTMLDivElement | null)[] {
  return [
    state.deleteButton,
    state.copyButton,
    state.insertBeforeButton,
    state.insertAfterButton,
  ];
}
/**
 * 切换"选中元素"时同步挂/卸这个 class。
 * CSS 用 `body.__vdi-ctrl .__vdi-draggable` 收窄可拖拽光标：
 * 必须同时满足 ①审查开着、②按住 Ctrl、③当前已选中 → 才有 move 光标。
 */
export const DRAGGABLE_CLASS = "__vdi-draggable";

/** selectedElement 写入助手：旧节点先卸 class，避免停电/取消选中后残留。 */
export function setSelectedElement(next: HTMLElement | null): void {
  if (state.selectedElement && state.selectedElement !== next) {
    state.selectedElement.classList.remove(DRAGGABLE_CLASS);
  }
  state.selectedElement = next;
  if (next) next.classList.add(DRAGGABLE_CLASS);
}
