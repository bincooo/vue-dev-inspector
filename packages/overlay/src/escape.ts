const ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
};

/**
 * 转义 element-content 不安全字符（`&`、`<`、`>`）。
 * 注意：不转义 `"` 和 `'` —— 不可作为属性值使用。
 */
export function escape(value: string): string {
  return value.replace(/[&<>]/g, (char) => ESCAPE_MAP[char]!);
}
