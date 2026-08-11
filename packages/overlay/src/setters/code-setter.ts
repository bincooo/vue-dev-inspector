/**
 * CodeSetter -- Monaco 多行代码输入。
 *
 * 懒加载 Monaco，创建 model + editor 绑定 entry.value。
 * 切换 setter / 关闭面板时通过 __vdiCleanup 释放编辑器资源。
 * 行内编辑器右上角齿轮按钮可弹出大尺寸浮动编辑窗口（共享 model）。
 */
import { createElement, stripCommonIndent, applyIndent } from '../utils';
import { loadMonaco } from '../monaco';
import type { MonacoAPI, MonacoEditor, MonacoModel } from '../monaco';
import type { SetterDef } from './index';

/** 浮动窗口是否已打开（防止重复弹出） */
let popoutOpen = false;

/** 打开浮动代码编辑窗口：用共享 model 创建大尺寸 Monaco editor */
function openPopout(monaco: MonacoAPI, model: MonacoModel): void {
  if (popoutOpen) return;
  popoutOpen = true;

  const mask = createElement('div', '__vdi-code-popout-mask');
  mask.onmousedown = (e) => {
    e.stopPropagation();
    if (e.target === mask) close();
  };

  /**
   * Capture 阶段 focusin 拦截，阻断 antdv useLockFocus 的焦点回拉。
   * 与 events.ts 中 prop panel 的 focusin 拦截同模式（参见 42b1143）。
   */
  const focusGuard = (e: FocusEvent) => {
    if (mask.contains(e.target as Node)) {
      e.stopImmediatePropagation();
    }
  };
  window.addEventListener('focusin', focusGuard, true);

  // eslint-disable-next-line prefer-const -- 前向声明，close 闭包需在 editor 赋值前引用
  let editor: MonacoEditor;

  const close = () => {
    editor.dispose();
    window.removeEventListener('focusin', focusGuard, true);
    mask.remove();
    popoutOpen = false;
  };

  const popout = createElement('div', '__vdi-code-popout');
  const header = createElement('div', '__vdi-code-popout-header');
  const title = createElement('span', undefined, '代码编辑');
  const closeBtn = createElement<HTMLButtonElement>(
    'button',
    '__vdi-code-popout-close',
    '✕',
  );
  closeBtn.onclick = close;
  header.append(title, closeBtn);

  const body = createElement('div', '__vdi-code-popout-body');
  popout.append(header, body);
  mask.appendChild(popout);
  document.body.appendChild(mask);

  editor = monaco.editor.create(body, {
    model,
    automaticLayout: true,
    theme: 'vs-dark',
    fontSize: 14,
    minimap: { enabled: true },
    scrollBeyondLastLine: false,
    fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
    lineNumbers: 'on',
  });
  requestAnimationFrame(() => editor.focus());
}

export const codeSetter: SetterDef = {
  icon: '{ }',
  label: '代码',
  build(entry) {
    const container = createElement('div', '__vdi-prop-code-wrap');
    const loading = createElement(
      'div',
      '__vdi-prop-code-loading',
      '加载编辑器…',
    );
    container.appendChild(loading);
    const disposed = false;
    // 预处理：剥离公共前置缩进，编辑时顶格展示；保存时还原。
    const { text, indent } = stripCommonIndent(entry.value ?? '');
    loadMonaco()
      .then((monaco) => {
        if (disposed) return;
        const model = monaco.editor.createModel(text, 'javascript');
        model.updateOptions({ tabSize: 2 });
        const editor = monaco.editor.create(container, {
          model,
          automaticLayout: true,
          theme: 'vs-dark',
          fontSize: 12,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
          lineNumbers: 'off',
        });
        model.onDidChangeContent(() => {
          entry.value = applyIndent(editor.getValue(), indent);
        });
        loading.remove();

        // 存储 model 引用供齿轮按钮使用
        (container as unknown as { __vdiModel: MonacoModel }).__vdiModel =
          model;

        // 右上角齿轮按钮 -- 点击弹出大窗口编辑
        const expandBtn = createElement<HTMLButtonElement>(
          'button',
          '__vdi-prop-code-expand',
          '⚙',
        );
        expandBtn.title = '大窗口编辑';
        expandBtn.onclick = (e) => {
          e.stopPropagation();
          const storedModel = (
            container as unknown as { __vdiModel?: MonacoModel }
          ).__vdiModel;
          if (storedModel) openPopout(monaco, storedModel);
        };
        container.appendChild(expandBtn);
        (container as unknown as { __vdiCleanup: () => void }).__vdiCleanup =
          () => {
            editor.dispose();
            model.dispose();
          };
      })
      .catch(() => {
        loading.textContent = '编辑器加载失败';
      });
    return container;
  },
};
