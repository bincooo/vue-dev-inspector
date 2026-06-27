/**
 * 运行时配置类型。
 *
 * 由 vite-plugin 在注入 overlay 之前设置
 * window.__DEV_INSPECTOR_CFG__ 全局变量，
 * overlay IIFE 启动时读取。
 */
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
}

export interface PropEntry {
  key: string;
  value: string;
}

export interface PanelData {
  file: string;
  line: number;
  col: number;
  tag: string;
  entries: PropEntry[];
}
