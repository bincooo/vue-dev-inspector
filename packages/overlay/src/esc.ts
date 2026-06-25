/**
 * HTML 实体转义
 */
export function esc(v: string): string {
  return String(v).replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>')
}