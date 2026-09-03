/**
 * 审查模式写操作的历史快照栈 —— 撤销 / 重做。
 *
 * 设计要点（见 openspec/changes/review-history-undo/design.md）：
 * - 快照记「写盘前旧全文」：撤销 = 旧文写回，无需为每种操作实现逆操作。
 * - 全局双栈（undoStack / redoStack）按时间序混排多文件：与「撤销我
 *   刚才那一下」的用户心智一致；任何新写操作清空 redoStack。
 * - 每文件上限 HISTORY_MAX_PER_FILE 条 FIFO 淘汰，防长会话大文件内存膨胀。
 * - 仅驻内存：dev server 重启即清空（与 currentSelection 同语义）。
 */
import fs from 'node:fs';
import path from 'node:path';

/** 单条快照：一次写操作之前的文件全文 + 动作摘要。 */
export interface Snapshot {
  /** 文件绝对路径（服务端内部定位用）。 */
  absolutePath: string;
  /** 写盘前的完整文件内容。 */
  content: string;
  /** 动作类型（路由名，如 'update-props'）。 */
  label: string;
  /** 快照时间戳（ms）。 */
  at: number;
}

/** 历史条目摘要（对外 API 返回形态，不携带全文）。 */
export interface HistoryEntry {
  file: string;
  label: string;
  at: number;
}

/** 撤销 / 重做 / 查询接口的统一响应形态。 */
export interface HistoryResult {
  success: boolean;
  error?: string;
  /** 本次撤销/重做回滚的条目摘要（查询/失败时为 null）。 */
  entry: HistoryEntry | null;
  canUndo: number;
  canRedo: number;
}

/** 每文件保留的快照上限（超出 FIFO 淘汰最旧一条）。 */
const HISTORY_MAX_PER_FILE = 50;

/** getHistory 返回的摘要条数上限。 */
const HISTORY_SUMMARY_LIMIT = 10;

/** 可撤销栈（全局按时间序）。 */
const undoStack: Snapshot[] = [];
/** 可重做栈（任何新写操作即清空）。 */
const redoStack: Snapshot[] = [];

/**
 * 相对 projectRoots 的 posix 路径——不向浏览器泄漏服务端绝对路径。
 * 无匹配根时退回绝对路径（仅本机 dev 场景，可接受）。
 */
function toRelativeFile(absolutePath: string, projectRoots: string[]): string {
  for (const root of projectRoots) {
    const rel = path.relative(root, absolutePath);
    if (rel && !rel.startsWith('..') && !path.isAbsolute(rel)) {
      return rel.split(path.sep).join('/');
    }
  }
  return absolutePath;
}

/** 快照转对外摘要（剥掉 content 全文）。 */
function toEntry(s: Snapshot, projectRoots: string[]): HistoryEntry {
  return {
    file: toRelativeFile(s.absolutePath, projectRoots),
    label: s.label,
    at: s.at,
  };
}

/** undoStack 内同一文件快照数超上限时，FIFO 淘汰该文件最旧一条。 */
function evictIfNeeded(absolutePath: string): void {
  const count = undoStack.filter((s) => s.absolutePath === absolutePath).length;
  if (count < HISTORY_MAX_PER_FILE) return;
  const idx = undoStack.findIndex((s) => s.absolutePath === absolutePath);
  if (idx >= 0) undoStack.splice(idx, 1);
}

/**
 * 带历史的写盘：所有写路由统一替换 fs.writeFileSync 的入口。
 *
 * 顺序：读旧全文 → push undoStack（清空 redoStack）→ 写入新内容。
 * 读旧文件异常（如首次写入前文件不存在）时不阻断写盘——历史缺失只影响
 * 该次操作不可撤销，不能因此让写操作本身失败。
 */
export function writeTracked(
  absolutePath: string,
  nextContent: string,
  label: string,
): void {
  try {
    const prev = fs.readFileSync(absolutePath, 'utf-8');
    evictIfNeeded(absolutePath);
    undoStack.push({ absolutePath, content: prev, label, at: Date.now() });
    redoStack.length = 0;
  } catch {
    // 入栈失败不阻断写盘（见函数注释）
  }
  fs.writeFileSync(absolutePath, nextContent, 'utf-8');
}

/** 栈内剩余可撤销 / 可重做条数。 */
function counts(): { canUndo: number; canRedo: number } {
  return { canUndo: undoStack.length, canRedo: redoStack.length };
}

/**
 * 撤销上一次写操作：undoStack 弹栈 → 盘上当前内容 push 进 redoStack →
 * 快照内容写回磁盘（HMR 兜底热更新）。
 */
export function undo(projectRoots: string[]): HistoryResult {
  const snapshot = undoStack.pop();
  if (!snapshot) {
    return { success: false, error: '无可撤销条目', entry: null, ...counts() };
  }
  // 盘上「撤销前内容」进重做栈；写回的 at 沿用原快照时间便于溯源
  const current = fs.readFileSync(snapshot.absolutePath, 'utf-8');
  redoStack.push({
    absolutePath: snapshot.absolutePath,
    content: current,
    label: snapshot.label,
    at: Date.now(),
  });
  fs.writeFileSync(snapshot.absolutePath, snapshot.content, 'utf-8');
  return {
    success: true,
    entry: toEntry(snapshot, projectRoots),
    ...counts(),
  };
}

/** 重做最近一次被撤销的操作：与 undo() 完全对称。 */
export function redo(projectRoots: string[]): HistoryResult {
  const snapshot = redoStack.pop();
  if (!snapshot) {
    return { success: false, error: '无可重做条目', entry: null, ...counts() };
  }
  const current = fs.readFileSync(snapshot.absolutePath, 'utf-8');
  undoStack.push({
    absolutePath: snapshot.absolutePath,
    content: current,
    label: snapshot.label,
    at: Date.now(),
  });
  fs.writeFileSync(snapshot.absolutePath, snapshot.content, 'utf-8');
  return {
    success: true,
    entry: toEntry(snapshot, projectRoots),
    ...counts(),
  };
}

/** 读取历史栈状态（供 overlay 刷新按钮禁用态）。 */
export function getHistory(projectRoots: string[]): {
  canUndo: number;
  canRedo: number;
  entries: HistoryEntry[];
} {
  const entries = undoStack
    .slice(-HISTORY_SUMMARY_LIMIT)
    .reverse()
    .map((s) => toEntry(s, projectRoots));
  return { ...counts(), entries };
}
