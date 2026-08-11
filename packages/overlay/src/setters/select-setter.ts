/**
 * SelectSetter -- 下拉选择（消费 ComponentAttr.options）。
 *
 * 当前值不在 options 中时额外追加一条，避免 select 显示空白。
 */
import { createElement } from '../utils';
import type { SetterDef } from './index';

export const selectSetter: SetterDef = {
  icon: '☰',
  label: '下拉选择',
  build(entry, attr) {
    const options = attr?.options ?? [];
    const select = createElement<HTMLSelectElement>(
      'select',
      '__vdi-prop-input __vdi-prop-value __vdi-prop-select',
    );
    const emptyOpt = createElement<HTMLOptionElement>(
      'option',
      undefined,
      '（选择值）',
    );
    emptyOpt.value = '';
    select.appendChild(emptyOpt);
    // 当前值不在 options 中时额外追加一条，避免 select 显示空白
    if (entry.value && !options.includes(entry.value)) {
      const curOpt = createElement<HTMLOptionElement>(
        'option',
        undefined,
        entry.value,
      );
      curOpt.value = entry.value;
      select.appendChild(curOpt);
    }
    options.forEach((opt) => {
      const option = createElement<HTMLOptionElement>('option', undefined, opt);
      option.value = opt;
      select.appendChild(option);
    });
    select.value = entry.value ?? '';
    select.onchange = () => (entry.value = select.value);
    if (!options.length) select.disabled = true;
    return select;
  },
};
