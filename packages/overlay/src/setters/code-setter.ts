/**
 * CodeSetter -- Monaco 多行代码输入。
 *
 * 懒加载 Monaco，创建 model + editor 绑定 entry.value。
 * 切换 setter / 关闭面板时通过 __vdiCleanup 释放编辑器资源。
 */
import { createElement } from "../utils";
import { loadMonaco } from "../monaco";
import type { SetterDef } from "./index";

export const codeSetter: SetterDef = {
  icon: "{ }",
  label: "代码",
  build(entry) {
    const container = createElement("div", "__vdi-prop-code-wrap");
    const loading = createElement(
      "div",
      "__vdi-prop-code-loading",
      "加载编辑器…",
    );
    container.appendChild(loading);
    const disposed = false;
    loadMonaco()
      .then((monaco) => {
        if (disposed) return;
        const model = monaco.editor.createModel(
          entry.value ?? "",
          "javascript",
        );
        model.updateOptions({ tabSize: 2 });
        const editor = monaco.editor.create(container, {
          model,
          automaticLayout: true,
          theme: "vs-dark",
          fontSize: 12,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
          lineNumbers: "off",
        });
        model.onDidChangeContent(() => {
          entry.value = editor.getValue();
        });
        loading.remove();
        (container as unknown as { __vdiCleanup: () => void }).__vdiCleanup =
          () => {
            editor.dispose();
            model.dispose();
          };
      })
      .catch(() => {
        loading.textContent = "编辑器加载失败";
      });
    return container;
  },
};
