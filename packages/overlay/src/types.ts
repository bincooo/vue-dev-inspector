/**
 * 运行时配置类型。
 *
 * 由 vite-plugin 在注入 overlay 之前设置
 * window.__DEV_INSPECTOR_CFG__ 全局变量，
 * overlay IIFE 启动时读取。
 */
import type { ComponentConfigEntry } from "@vue-dev-inspector/shared";

export interface ClientCfg {
  attrName: string;
  protocol: string;
  editor: string;
  apiPrefix: string;
  tagAttr: string;
  projectRoot: string;
  shortcut: {
    altKey: boolean;
    shiftKey: boolean;
    ctrlKey: boolean;
    metaKey: boolean;
    code: string;
  };
  /** 是否显示右下角齿轮按钮 */
  toggleBtn: boolean;
  /**
   * 抽屉左侧竖列 tab 的物料库条目。
   * 数组顺序决定 tab 从左到右渲染顺序；
   * 为空时 overlay 回退到内置 antdv 默认物料（仅一个 tab）。
   */
  componentEntries: ComponentConfigEntry[];
}

export interface PropEntry {
  key: string;
  value: string;
}
