/**
 * 运行时配置类型。
 *
 * 由 vite-plugin 在注入 overlay 之前设置
 * window.__DEV_INSPECTOR_CFG__ 全局变量，
 * overlay IIFE 启动时读取。
 */
import type { ComponentConfigEntry } from "@vdi/shared";

export interface ClientCfg {
  attrName: string;
  protocol: string;
  editor: string;
  apiPrefix: string;
  tagAttr: string;
  /**
   * @deprecated 兼容字段：保留为 `projectRoots[0] ?? ""`。
   * 等价于第一个根；多根场景下旧代码（如"复制路径"的协议 URL 拼接）
   * 仍基于该字段，可能对兄弟根上的元素给出错误的绝对路径。
   * 新代码优先使用 `projectRoots`。
   */
  projectRoot: string;
  /**
   * 项目根目录列表（monorepo 下可声明多个 sub-project）。
   * 由 `vueDevInspector` 的 `projectRoots` 配置；未配置时为 `[config.root]`。
   * 每个元素都是绝对路径。
   */
  projectRoots: string[];
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
