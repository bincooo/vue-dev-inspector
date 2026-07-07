/**
 * 运行时配置类型。
 *
 * 由 vite-plugin 在注入 overlay 之前设置
 * window.__DEV_INSPECTOR_CFG__ 全局变量，
 * overlay IIFE 启动时读取。
 */
import type { ComponentConfigEntry } from "@vue-dev-inspector/shared";
// 从 shared 重导出，保持 overlay 内 `import type { ... } from "./types"` 的单一入口。
export type { ChildTextData } from "@vue-dev-inspector/shared";

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

/**
 * 「编辑代码」抽屉支持的 SFC 顶层块类型（v1 仅 script / style）。
 * <template> 编辑留作后续；多 <style scoped> 与 <script> + <script setup>
 * 共存的场景同样留作 v2（参见 plan 末尾的「已知限制」）。
 */
export type CodeBlockKind = "script" | "style";

/**
 * 单个 SFC 块的当前内容与字符偏移区间。
 *
 * - `start` / `end` 是「块在 SFC 全文中的字节偏移」，对应 `<script>...</script>`
 *   这段完整子串（含标签自身）；服务端 update 用这两个值做 MagicString overwrite。
 * - `content` 仅是标签内的源码（不含 <script> / </script> 标签）。
 */
export interface CodeBlockData {
  kind: CodeBlockKind;
  content: string;
  start: number;
  end: number;
}

/** /get-block 响应：缺失的块（文件无 <style>）则对应字段省略。 */
export interface GetBlocksResponse {
  script?: CodeBlockData;
  style?: CodeBlockData;
}
