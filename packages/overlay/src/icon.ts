/**
 * 图标渲染工具。
 *
 * 支持三种传入形态：
 *   1. iconify 短串：`i-ant-design:button`、`i-mdi:apple`
 *      → 首次出现时 fetch https://api.iconify.design/{prefix}.svg?{name}.svg
 *        走 iconify 官方（无需 key；离线时网络失败 → 回退到首字符占位
 *      → 后续命中缓存
 *   2. 纯文本/emoji：`🧩` `Button` `Aa`
 *      → 原样渲染
 *   3. 内联 SVG 字符串：`<svg>...</svg>`
 *      → DOMParser 解析后挂到容器
 *
 * 设计原则：dev-only 工具，不阻塞主流程；fetch 失败不抛错，回退占位即可。
 */
import { state } from "./state";

/** 形如 `i-prefix:name` 的 iconify 短串；无空白，前后非空。 */
const ICONIFY_RE = /^i-([a-z0-9][a-z0-9-]*):([a-z0-9-]+)$/i;

function isIconifySpec(icon: string): boolean {
  return ICONIFY_RE.test(icon);
}

function parseIconifySpec(icon: string): { prefix: string; name: string } {
  const [, prefix, name] = icon.match(ICONIFY_RE)!;
  return { prefix, name };
}

/**
 * 同步取出缓存的 SVG；命中即返字符串，未命中则返 null。
 */
function getCachedIcon(icon: string): string | null {
  const hit = state.iconCache[icon];
  return typeof hit === "string" ? hit : null;
}

/**
 * 把 SVG 字符串挂入容器（color 跟随 currentColor）。
 */
function paintSvg(container: HTMLElement, svg: string): void {
  container.innerHTML = svg;
  const svgEl = container.firstElementChild;
  if (svgEl && svgEl.tagName.toLowerCase() === "svg") {
    (svgEl as SVGElement).setAttribute("width", "1em");
    (svgEl as SVGElement).setAttribute("height", "1em");
  }
}

/**
 * 把整个「icon 字符串 → DOM」流程跑完（含缓存、fetch、降级）。
 *
 * @param container 单个 DOM 元素；内层会被清空再渲染
 * @param icon      用户配置中的 icon 字符串；undefined/空 → 走默认 (defaultText)
 * @param defaultText  缓存未命中 + fetch 失败时的占位字符
 */
export function renderIcon(
  container: HTMLElement,
  icon: string | undefined,
  defaultText: string,
): void {
  container.innerHTML = "";

  // 缺省 → 默认占位
  if (!icon) {
    container.textContent = defaultText;
    return;
  }

  // 内联 SVG —— 用粗略正则判定首字符为 `<`
  if (icon.trim().startsWith("<svg")) {
    try {
      paintSvg(container, icon);
    } catch {
      container.textContent = defaultText;
    }
    return;
  }

  // iconify 路径
  if (isIconifySpec(icon)) {
    const cached = getCachedIcon(icon);
    if (cached) {
      paintSvg(container, cached);
      return;
    }
    // 先用 defaultText 占位，再后台 fetch
    container.textContent = defaultText;
    fetchIconify(icon).then((svg) => {
      // 仅当 container 仍是当前激活 tab 的子节点时才更新（用户已切走就丢弃）
      if (svg && container.isConnected) paintSvg(container, svg);
    });
    return;
  }

  // emoji / 普通文本 —— 原样展示
  container.textContent = icon;
}

/**
 * 异步拉取 iconify：fetch 官方 SVG 端点，写入 state.iconCache。
 * 失败（网络/404）静默吃掉，调用方保持当前 defaultText 占位。
 *
 * URL 形态：https://api.iconify.design/{prefix}/{name}.svg
 * 默认 fill="currentColor" —— 宿主页面 CSS color 直接接管染色。
 */
function fetchIconify(icon: string): Promise<string | null> {
  if (state.iconCache[icon]) return Promise.resolve(state.iconCache[icon]);
  const { prefix, name } = parseIconifySpec(icon);
  return fetch("https://api.iconify.design/" + prefix + "/" + name + ".svg")
    .then((resp) => (resp.ok ? resp.text() : null))
    .then((svg) => {
      // 失败不写缓存，允许下一次重新尝试
      if (svg && svg.includes("<svg")) {
        state.iconCache[icon] = svg;
        return svg;
      }
      return null;
    })
    .catch(() => null);
}