/**
 * iPhone 经典款虚拟外观 —— CSS + 运行时 DOM 脚本。
 *
 * 所有尺寸以 375px（iPhone 6/7/8/X 逻辑宽度）为基准，
 * 按 `cfg.width / 375` 等比缩放适配自定义宽高。
 *
 * `buildPhoneShellScript()` 返回一段 `<script>` IIFE 字符串，
 * 由 `uniDevInspector` 的 `transformIndexHtml` 钩子注入到 `</body>` 前。
 */

// ─── 常量：基准设计稿尺寸（375px）───────────────────────────────

/** 设计稿基准宽度 */
const BASE_W = 375;

/** 屏幕内容区顶部留白（含刘海 + 状态栏），基准 px */
const SCREEN_PAD_TOP = 65;

// 听筒
const SPEAKER_W = 60, SPEAKER_H = 4, SPEAKER_TOP = 7;
// 前置摄像头
const CAM_SIZE = 10, CAM_LEFT = 44, CAM_TOP = 4;
// 侧边按钮
const BTN_W = 3, BTN_EXT = 8; // 宽度 + 伸出量
const BTN_L1_TOP = 130, BTN_L1_H = 24;
const BTN_L2_TOP = 166, BTN_L2_H = 52;
const BTN_L3_TOP = 230, BTN_L3_H = 52;
const BTN_RIGHT_TOP = 170, BTN_RIGHT_H = 80;
// 刘海
const NOTCH_W = 140, NOTCH_H = 22, NOTCH_R = 18;
// Home bar
const BAR_BOTTOM = 8, BAR_W = 134, BAR_H = 5;
// 手机边框圆角
const PHONE_RADIUS = 30;

// ─── 类型 ─────────────────────────────────────────────────────

export interface PhoneShellConfig {
  enabled: boolean;
  width: number;
  height: number;
}

// ─── 选项解析 ───────────────────────────────────────────────

/** 解析 `phoneShell` 选项 → 标准化配置。 */
export function resolvePhoneShell(
  raw?: boolean | { width?: number; height?: number },
): PhoneShellConfig {
  if (raw === false || raw === undefined) return { enabled: false, width: 375, height: 812 };
  const obj = raw === true ? {} : raw;
  return { enabled: true, width: obj.width ?? 375, height: obj.height ?? 812 };
}

// ─── CSS 生成 ─────────────────────────────────────────────────

/** 预览级 CSS（编译期计算所有缩放后尺寸，不依赖运行时 JS 变量）。 */
function buildCss(cfg: PhoneShellConfig): string {
  const r = cfg.width / BASE_W;
  const rnd = (v: number) => Math.round(v * r);
  const px = (v: number) => `${rnd(v)}px`;

  // 单行 CSS：模板字面量换行会在注入到 JS 字符串时破坏语法
  return [
    `[data-vdi-phone-shell]{--vdi-w:${cfg.width}px;--vdi-h:${cfg.height}px;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;padding:28px 0;box-sizing:border-box}`,
    `[data-vdi-phone-frame]{position:relative;flex-shrink:0;width:var(--vdi-w);height:var(--vdi-h);background:linear-gradient(180deg,#0d0d0d,#1a1a1a 10%,#1f1f1f 90%,#0d0d0d);border-radius:${px(PHONE_RADIUS)};box-shadow:0 0 0 2px #3a3a3a,0 0 0 3px #0d0d0d,0 0 0 4px #4a4a52,0 0 0 5px #0d0d0d,0 16px 48px rgba(0,0,0,.35),0 4px 12px rgba(0,0,0,.2),inset 0 0 2px rgba(255,255,255,.06)}`,
    `[data-vdi-phone-speaker]{position:absolute;top:${px(SPEAKER_TOP)};left:50%;transform:translateX(-50%);width:${px(SPEAKER_W)};height:${px(SPEAKER_H)};background:gray;border-radius:4px;z-index:56}`,
    `[data-vdi-phone-cam]{position:absolute;top:${px(CAM_TOP)};left:calc(50% + ${px(CAM_LEFT)});width:${px(CAM_SIZE)};height:${px(CAM_SIZE)};background:gray;border-radius:50%;z-index:56;box-shadow:inset 0 0 2px rgba(255,255,255,.15)}`,
    `[data-vdi-phone-btn]{position:absolute;background:#1a1a1a;z-index:30;border-radius:3px 0 0 3px}`,
    `[data-vdi-phone-btn-l1]{top:${px(BTN_L1_TOP)};left:-${px(BTN_EXT)};width:${px(BTN_W)};height:${px(BTN_L1_H)}}`,
    `[data-vdi-phone-btn-l2]{top:${px(BTN_L2_TOP)};left:-${px(BTN_EXT)};width:${px(BTN_W)};height:${px(BTN_L2_H)}}`,
    `[data-vdi-phone-btn-l3]{top:${px(BTN_L3_TOP)};left:-${px(BTN_EXT)};width:${px(BTN_W)};height:${px(BTN_L3_H)}}`,
    `[data-vdi-phone-btn-right]{top:${px(BTN_RIGHT_TOP)};right:-${px(BTN_EXT)};width:${px(BTN_W)};height:${px(BTN_RIGHT_H)};box-shadow:inset 1px 0 2px rgba(255,255,255,.06);border-radius:0 3px 3px 0}`,
    `[data-vdi-phone-notch]{position:absolute;left:50%;transform:translateX(-50%);width:${px(NOTCH_W)};height:${px(NOTCH_H)};background:#0d0d0d;border-radius:0 0 ${px(NOTCH_R)} ${px(NOTCH_R)};z-index:55}`,
    `[data-vdi-phone-screen]{position:relative;width:100%;height:100%;z-index:50;padding:${rnd(SCREEN_PAD_TOP)}px 0 0 0;box-sizing:border-box;background:#fff;border-radius:${px(PHONE_RADIUS)};overflow-y:auto;overflow-x:hidden}`,
    `[data-vdi-phone-screen] uni-page-head,[data-vdi-phone-screen] .uni-page-head{position:absolute!important;top:0!important;left:0!important;right:0!important;width:100%!important;z-index:50;padding-top:20px;height: 65px}`,
    `[data-vdi-phone-bar]{position:absolute;bottom:${px(BAR_BOTTOM)};left:50%;transform:translateX(-50%);width:${px(BAR_W)};height:${px(BAR_H)};background:rgba(128,128,128,.5);border-radius:3px;z-index:100}`,
  ].join("");
}

// ─── 运行时脚本 ──────────────────────────────────────────────

/**
 * 构建运行时 `<script>` IIFE，插入到 `</body>` 前。
 * 脚本在页面解析时同步执行：
 *   1. 注入 phone shell CSS
 *   2. 创建 phone 壳 DOM 元素
 *   3. 将 body 全部子节点搬进 phone-screen
 *   4. MutationObserver 监听 uni 运行时后续注入的 uni-page-head
 */
export function buildPhoneShellScript(cfg: PhoneShellConfig): string {
  const css = buildCss(cfg);

  // 内联 IIFE — 字符串拼接以避免依赖任何运行时模块
  const body = `
    !function(){
      if(document.querySelector("[data-vdi-phone-shell]")) return;
      var c = document.createElement("style");
      c.textContent='${css}';
      document.head.appendChild(c);
      var shell=document.createElement("div"); shell.setAttribute("data-vdi-phone-shell","");
      var frame=document.createElement("div"); frame.setAttribute("data-vdi-phone-frame","");
      frame.innerHTML="<div data-vdi-phone-speaker></div><div data-vdi-phone-cam></div><div data-vdi-phone-btn data-vdi-phone-btn-l1></div><div data-vdi-phone-btn data-vdi-phone-btn-l2></div><div data-vdi-phone-btn data-vdi-phone-btn-l3></div><div data-vdi-phone-btn data-vdi-phone-btn-right></div><div data-vdi-phone-notch></div><div data-vdi-phone-screen></div><div data-vdi-phone-bar></div>";
      shell.appendChild(frame);
      var screen=frame.querySelector("[data-vdi-phone-screen]");
      var body=document.body;
      while(body.firstChild&&body.firstChild!==shell)screen.appendChild(body.firstChild);
      body.appendChild(shell);
      new MutationObserver(function(ms){for(var i=0;i<ms.length;i++){var ad=ms[i].addedNodes;for(var j=0;j<ad.length;j++){var n=ad[j];if(n.nodeType!==1)continue;if(n.tagName==="UNI-PAGE-HEAD"||(n.classList&&n.classList.contains("uni-page-head"))){if(!screen.contains(n))screen.insertBefore(n,screen.firstChild)}}}}).observe(body,{childList:true,subtree:true});
      setTimeout(function(){if(!screen.firstChild){var app=document.getElementById("app");if(app&&!screen.contains(app))screen.appendChild(app);}},1000);
    }();`

  return `<script>${body}</script>`;
}