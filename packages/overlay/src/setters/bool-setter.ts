/**
 * BoolSetter -- Switch 拨动控件。
 *
 * 以滑轨 + 圆形拨钮呈现布尔值，点击切换。
 * 值仍存储为字符串 "true"/"false"，不改变 PropEntry.value 的类型。
 */
import { createElement } from "../utils";
import type { SetterDef } from "./index";

export const boolSetter: SetterDef = {
  icon: "◉",
  label: "开关",
  build(entry) {
    const wrap = createElement("div", "__vdi-prop-switch");
    const track = createElement("div", "__vdi-prop-switch-track");
    const knob = createElement("div", "__vdi-prop-switch-knob");
    track.appendChild(knob);
    wrap.appendChild(track);

    const sync = () => {
      let on = entry.value === "true";
      if (entry.value === undefined || entry.value === "") {
        on = true;
      }
      track.classList.toggle("__vdi-prop-switch-track--on", on);
    };
    sync();
    track.onclick = (e) => {
      e.stopPropagation();
      entry.value =
        entry.value === "true" ||
        entry.value === undefined ||
        entry.value === ""
          ? "false"
          : "";
      sync();
    };
    return wrap;
  },
};
