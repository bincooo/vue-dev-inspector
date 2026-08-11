/**
 * setter 注册表 + 推断函数。
 *
 * 各 setter 实现在 setters/ 目录下的独立文件中，本文件聚合为注册表
 * 并导出 getSetters / inferDefaultSetter 供 panel/control 消费。
 */
import type { ComponentAttr } from '@vue-dev-inspector/shared';
import type { PropEntry } from '../types';
import { textSetter } from './text-setter';
import { codeSetter } from './code-setter';
import { selectSetter } from './select-setter';
import { boolSetter } from './bool-setter';

/** setter 工厂：根据 entry + attr 构造值控件，绑定 entry.value。 */
export interface SetterDef {
  icon: string;
  label: string;
  build(entry: PropEntry, attr: ComponentAttr | null): HTMLElement;
}

/** setter 注册表 */
export const setters: Record<string, SetterDef> = {
  TextSetter: textSetter,
  CodeSetter: codeSetter,
  SelectSetter: selectSetter,
  BoolSetter: boolSetter,
};

/**
 * 根据属性特征推断可用的 setter 列表。
 *
 * 推断规则：
 * - 始终包含 TextSetter 和 CodeSetter（通用兜底）
 * - 有 options -> 追加 SelectSetter
 * - options 为 [true, false] 或当前值为 true/false -> 追加 BoolSetter
 * - 显式声明 attr.setter 时直接使用，跳过推断
 */
export function getSetters(
  attr: ComponentAttr | null,
  entry: PropEntry,
): string[] {
  if (attr?.setter?.length) return attr.setter;
  const options = attr?.options ?? [];
  const isBoolOptions =
    options.length === 2 &&
    options.includes('true') &&
    options.includes('false');
  const isBoolValue = entry.value === 'true' || entry.value === 'false';
  const list = ['TextSetter', 'CodeSetter'];
  if (options.length) list.push('SelectSetter');
  if (isBoolOptions || isBoolValue) list.push('BoolSetter');
  return list;
}

/**
 * 根据属性特征推断默认 setter。
 *
 * 优先级：
 * 1. 属性名以 : / @ / v-model 开头 -> CodeSetter（Vue 绑定/事件表达式）
 * 2. 当前值为 true/false -> BoolSetter
 * 3. 有 options -> SelectSetter
 * 4. 其他 -> TextSetter
 */
export function inferDefaultSetter(
  attr: ComponentAttr | null,
  entry: PropEntry,
): string {
  const name = entry.key;
  if (
    name.startsWith(':') ||
    name.startsWith('@') ||
    name.startsWith('v-model')
  )
    return 'CodeSetter';
  if (entry.value === 'true' || entry.value === 'false') return 'BoolSetter';
  if (attr?.options?.length) {
    if (
      attr.options.length == 2 &&
      attr.options.includes('true') &&
      attr.options.includes('false')
    ) {
      return 'BoolSetter';
    }
    return 'SelectSetter';
  }
  return 'TextSetter';
}
