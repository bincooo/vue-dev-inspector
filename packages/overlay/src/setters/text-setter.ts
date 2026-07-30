/**
 * TextSetter -- 纯文本输入。
 *
 * 从原 prop-panel.ts 抽取，由 setters/index.ts 聚合进注册表。
 */
import { createElement } from "../utils";
import type { SetterDef } from "./index";

export const textSetter: SetterDef = {
  icon: "Aa",
  label: "文本",
  build(entry) {
    const input = createElement<HTMLInputElement>(
      "input",
      "__vdi-prop-input __vdi-prop-value",
    );
    input.value = entry.value ?? "";
    input.placeholder = "值（可空）";
    input.oninput = () => (entry.value = input.value);
    return input;
  },
};
