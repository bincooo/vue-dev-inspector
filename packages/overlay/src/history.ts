/**
 * 审查模式修改历史 —— overlay 侧请求与按钮状态同步。
 *
 * - requestUndo / requestRedo：POST /undo / /redo，用响应内嵌的
 *   canUndo / canRedo 直接刷新按钮禁用态（无需再发一次 /get-history）。
 * - refreshHistoryButtons：调 /get-history 同步初始态（开启审查模式时、
 *   各写操作成功回调后）。
 *
 * 服务端历史仅驻内存：dev server 重启即清空（按钮回到双置灰）。
 */
import { state } from './state';
import { apiRequest, logInfo, apiError, errMsg } from './utils';
import type { HistoryResponse, HistoryStateResponse } from './types';

/** 动作类型（路由名）→ 中文展示名。 */
const LABELS: Record<string, string> = {
  'update-props': '更新属性',
  'delete-element': '删除元素',
  'duplicate-element': '复制元素',
  'insert-component': '插入组件',
  'move-element': '移动元素',
  'update-block': '编辑代码块',
  'update-child-text': '编辑子节点',
};

/** 按钮置灰/恢复：canUndo/canRedo 为 0 时加置灰 class（pointer-events:none）。 */
function applyButtonState(
  undoBtn: HTMLDivElement,
  redoBtn: HTMLDivElement,
  canUndo: number,
  canRedo: number,
): void {
  undoBtn.classList.toggle('__vdi-history-btn--disabled', canUndo <= 0);
  redoBtn.classList.toggle('__vdi-history-btn--disabled', canRedo <= 0);
}

/** 统一响应处理：成功 logInfo 动作名，失败只刷新禁用态（不弹错误——按钮本应已置灰）。 */
function handleHistoryResponse(
  kind: '撤销' | '重做',
  undoBtn: HTMLDivElement,
  redoBtn: HTMLDivElement,
  res: HistoryResponse,
): void {
  applyButtonState(undoBtn, redoBtn, res.canUndo ?? 0, res.canRedo ?? 0);
  if (res.success) {
    const label = res.entry ? (LABELS[res.entry.label] ?? res.entry.label) : '';
    logInfo(`已${kind}：${label}`);
  }
}

/** 撤销上一次写操作。 */
export function requestUndo(): void {
  const undoBtn = state.undoButton;
  const redoBtn = state.redoButton;
  if (!undoBtn || !redoBtn) return;
  apiRequest<HistoryResponse>('/undo', {
    method: 'POST',
    body: '{}',
  })
    .then((res) => handleHistoryResponse('撤销', undoBtn, redoBtn, res))
    .catch((e: unknown) => {
      apiError('撤销失败', errMsg(e));
    });
}

/** 重做最近一次被撤销的操作。 */
export function requestRedo(): void {
  const undoBtn = state.undoButton;
  const redoBtn = state.redoButton;
  if (!undoBtn || !redoBtn) return;
  apiRequest<HistoryResponse>('/redo', {
    method: 'POST',
    body: '{}',
  })
    .then((res) => handleHistoryResponse('重做', undoBtn, redoBtn, res))
    .catch((e: unknown) => {
      apiError('重做失败', errMsg(e));
    });
}

/** 从服务端同步历史状态（开启审查模式 / 写操作成功后调用）。 */
export function refreshHistoryButtons(): void {
  const undoBtn = state.undoButton;
  const redoBtn = state.redoButton;
  if (!undoBtn || !redoBtn) return;
  apiRequest<HistoryStateResponse>('/get-history', {
    method: 'POST',
    body: '{}',
  })
    .then((res) => {
      applyButtonState(undoBtn, redoBtn, res.canUndo ?? 0, res.canRedo ?? 0);
    })
    .catch(() => {
      // 查询失败保守置灰，避免误导用户可撤销
      applyButtonState(undoBtn, redoBtn, 0, 0);
    });
}
