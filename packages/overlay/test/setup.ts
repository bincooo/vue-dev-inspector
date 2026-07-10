/**
 * vitest setupFiles — 在所有测试文件之前执行。
 * 提供 window.__DEV_INSPECTOR_CFG__ 默认值，防止 state.ts 在 jsdom 中
 * 读到 undefined 而崩溃。
 */
window.__DEV_INSPECTOR_CFG__ = {
  attrName: "data-source-file",
  protocol: "vscode",
  editor: "code",
  apiPrefix: "/__dev-inspector-api__",
  tagAttr: "data-inspector-tag",
  projectRoot: "/project",
  projectRoots: ["/project"],
  shortcut: {
    altKey: true,
    shiftKey: true,
    ctrlKey: false,
    metaKey: false,
    code: "KeyI",
  },
  toggleBtn: true,
  componentEntries: [],
};
