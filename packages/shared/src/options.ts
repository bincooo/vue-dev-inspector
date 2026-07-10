/** API 路径前缀 */
export const API_PREFIX = "/__dev-inspector-api__";
/** 编辑器 URL Protocol 映射 */
export const EDITOR_PROTOCOLS: Record<string, string> = {
  vscode: "vscode://file/",
  webstorm: "webstorm://open?file=",
  atom: "atom://open?url=file://",
  sublime: "subl://open?url=file://",
};
