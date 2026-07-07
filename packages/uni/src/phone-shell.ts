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
// const SCREEN_PAD_TOP = 65;

// 听筒
const SPEAKER_W = 60,
  SPEAKER_H = 4,
  SPEAKER_TOP = 7;
// 前置摄像头
const CAM_SIZE = 10,
  CAM_LEFT = 44,
  CAM_TOP = 4;
// 侧边按钮
const BTN_W = 3,
  BTN_EXT = 8; // 宽度 + 伸出量
const BTN_L1_TOP = 130,
  BTN_L1_H = 24;
const BTN_L2_TOP = 166,
  BTN_L2_H = 52;
const BTN_L3_TOP = 230,
  BTN_L3_H = 52;
const BTN_RIGHT_TOP = 170,
  BTN_RIGHT_H = 80;
// 刘海
const NOTCH_W = 140,
  NOTCH_H = 22,
  NOTCH_R = 18;
// Home bar
const BAR_BOTTOM = 8,
  BAR_W = 134,
  BAR_H = 5;
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
  const w = 340, h = 750;
  if (raw === false || raw === undefined)
    return { enabled: false, width: w, height: h };
  const obj = raw === true ? {} : raw;
  return { enabled: true, width: obj.width ?? w, height: obj.height ?? h };
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
    // phone-wrap：定位包裹层（flex item，375×812），侧边按钮挂它上面（left:-8px 伸出框外）。
    `[data-vdi-phone-wrap]{position:relative;flex-shrink:0;width:var(--vdi-w);height:var(--vdi-h)}`,
    // frame：填满 wrap。transform(固定 fixed 后代的包含块) + overflow:hidden + border-radius ——
    // 把 fixed 的 tabBar/navbar/遮罩 与 screen 内容一起裁成圆角。
    // overflow:hidden 放 frame（不能放 wrap，否则裁掉侧边按钮）；侧边按钮是 frame 的兄弟、挂 wrap 上。
    `[data-vdi-phone-frame]{position:absolute;top:0;left:0;width:100%;height:100%;overflow:hidden;transform:translateZ(0);background:linear-gradient(180deg,#0d0d0d,#1a1a1a 10%,#1f1f1f 90%,#0d0d0d);border-radius:${px(PHONE_RADIUS)};box-shadow:0 0 0 2px #3a3a3a,0 0 0 3px #0d0d0d,0 0 0 4px #4a4a52,0 0 0 5px #0d0d0d,0 16px 48px rgba(0,0,0,.35),0 4px 12px rgba(0,0,0,.2),inset 0 0 2px rgba(255,255,255,.06)}`,
    `[data-vdi-phone-speaker]{position:absolute;top:${px(SPEAKER_TOP)};left:50%;transform:translateX(-50%);width:${px(SPEAKER_W)};height:${px(SPEAKER_H)};background:gray;border-radius:4px;z-index:56}`,
    `[data-vdi-phone-cam]{position:absolute;top:${px(CAM_TOP)};left:calc(50% + ${px(CAM_LEFT)});width:${px(CAM_SIZE)};height:${px(CAM_SIZE)};background:gray;border-radius:50%;z-index:56;box-shadow:inset 0 0 2px rgba(255,255,255,.15)}`,
    `[data-vdi-phone-btn]{position:absolute;background:#1a1a1a;z-index:30;border-radius:3px 0 0 3px}`,
    `[data-vdi-phone-btn-l1]{top:${px(BTN_L1_TOP)};left:-${px(BTN_EXT)};width:${px(BTN_W)};height:${px(BTN_L1_H)}}`,
    `[data-vdi-phone-btn-l2]{top:${px(BTN_L2_TOP)};left:-${px(BTN_EXT)};width:${px(BTN_W)};height:${px(BTN_L2_H)}}`,
    `[data-vdi-phone-btn-l3]{top:${px(BTN_L3_TOP)};left:-${px(BTN_EXT)};width:${px(BTN_W)};height:${px(BTN_L3_H)}}`,
    `[data-vdi-phone-btn-right]{top:${px(BTN_RIGHT_TOP)};right:-${px(BTN_EXT)};width:${px(BTN_W)};height:${px(BTN_RIGHT_H)};box-shadow:inset 1px 0 2px rgba(255,255,255,.06);border-radius:0 3px 3px 0}`,
    `[data-vdi-phone-notch]{position:absolute;left:50%;transform:translateX(-50%);width:${px(NOTCH_W)};height:${px(NOTCH_H)};background:#0d0d0d;border-radius:0 0 ${px(NOTCH_R)} ${px(NOTCH_R)};z-index:55}`,
    // screen：滚动容器（overflow-y:auto）。⚠ transform 放 frame、不放 screen ——
    //   screen 是 overflow:auto 滚动容器，一旦它成为 fixed 后代的包含块(加 transform)，
    //   Chromium 里 fixed 的 tabBar/navbar 会随 screen 滚动（"页脚跟随滚动/标题偏移"的根因）。
    //   transform 放 frame（非滚动容器），fixed 后代以 frame 为包含块、不随 screen 滚动；
    //   frame 的 overflow:hidden+border-radius 负责把它们裁成圆角。
    // padding-top=0：状态栏由 app 自己的 u-status-bar 处理（uni 补丁把 statusBarHeight 报成刘海高，
    //   u-status-bar=22 + navbar-inner=44 = navbar 66；placeholder=navbarHeight+statusBarHeight=66 正好匹配，
    //   hero 紧接 navbar 底部）。phone-shell 再加 padding 反而让 padding+placeholder > navbar、placeholder 又被挤出。
    `uni-page-head + uni-page-wrapper{padding-top:65px;height:calc(100% - env(safe-area-inset-top)) !important}`,
    `[data-vdi-phone-screen]{position:relative;width:100%;height:100%;z-index:50;padding:0;box-sizing:border-box;background:#fff;border-radius:${px(PHONE_RADIUS)};overflow-y:auto;overflow-x:hidden}`,
    `[data-vdi-phone-screen] uni-page-head,[data-vdi-phone-screen] .uni-page-head{position:absolute!important;top:0!important;left:0!important;right:0!important;width:100%!important;z-index:50;padding-top:20px;height: 65px}`,
    // 注：uview-pro 的 u-navbar 标题偏移 / placeholder 挤出等问题不再用 .u-* CSS 兜底
    // (耦合太强)，改由 IIFE 里的 uni 系统信息补丁统一解决（报告 375×812 + statusBarHeight）。
    `[data-vdi-phone-bar]{position:absolute;bottom:${px(BAR_BOTTOM)};left:50%;transform:translateX(-50%);width:${px(BAR_W)};height:${px(BAR_H)};background:rgba(128,128,128,.5);border-radius:3px;z-index:100}`,
  ].join("");
}

// ─── 运行时脚本 ──────────────────────────────────────────────

/**
 * 构建运行时 `<script>` IIFE，插入到 `</body>` 前。
 * 脚本在页面解析时同步执行：
 *   1. 注入 phone shell CSS
 *   2. 创建 phone 壳 DOM 元素
 *   3. 将 body 中的元素节点（#app 等）搬进 phone-screen，跳过 <script>/<style>/<link>
 *   4. MutationObserver 监听 uni 运行时后续注入的 uni-page-head
 */
export function buildPhoneShellScript(cfg: PhoneShellConfig): string {
  const css = buildCss(cfg);

  // 内联 IIFE — 字符串拼接以避免依赖任何运行时模块
  const body = `
    !function(){
      if(document.querySelector("[data-vdi-phone-shell]")) return;
      // === uni 系统信息补丁（通用，不耦合任何 UI 库）===
      // 根因：app 用 uni.getSystemInfoSync().windowWidth(桌面=浏览器视口宽)/statusBarHeight
      // (桌面=0，读 env(safe-area-inset-top)) 做布局，phone-shell 却把可视区收成 375×812，
      // 导致 u-navbar 标题算偏、placeholder 高度不对、等一堆问题。逐个 .u-* CSS 兜底耦合太强。
      // 这里直接让 uni 报告手机框尺寸：window.uni 由 /src/pages-json-js 做 window.uni=uni
      // 普通赋值，本 IIFE 早于 main.ts 执行，用 defineProperty setter 拦截、原地 patch
      // getSystemInfoSync/getWindowInfo/upx2px 等，所有组件自动对齐手机框。
      if(!window.__vdi_uni_patched){
        window.__vdi_uni_patched=true;
        var UW=${cfg.width},UH=${cfg.height},USB=${Math.round((NOTCH_H * cfg.width) / BASE_W)};
        var upatch=function(o){if(!o)return o;o.windowWidth=UW;o.windowHeight=UH;o.screenWidth=UW;o.screenHeight=UH;o.statusBarHeight=USB;if(!o.safeArea)o.safeArea={};o.safeArea.left=0;o.safeArea.right=UW;o.safeArea.top=USB;o.safeArea.bottom=UH;o.safeArea.width=UW;o.safeArea.height=UH-USB;if(!o.safeAreaInsets)o.safeAreaInsets={};o.safeAreaInsets.top=USB;o.safeAreaInsets.bottom=0;o.safeAreaInsets.left=0;o.safeAreaInsets.right=0;return o;};
        var uwrap=function(u){if(!u||u.__vdi_wrapped)return;try{["getSystemInfoSync","getWindowInfo","getDeviceInfo","getAppBaseInfo","getSystemSetting"].forEach(function(k){if(typeof u[k]==="function"){var o=u[k];try{Object.defineProperty(u,k,{configurable:true,writable:true,value:function(){return upatch(o.call(this));}});}catch(e){try{u[k]=function(){return upatch(o.call(this));};}catch(e2){}}}});if(typeof u.upx2px==="function"){try{Object.defineProperty(u,"upx2px",{configurable:true,writable:true,value:function(r){return Number(r)*UW/750;}});}catch(e){try{u.upx2px=function(r){return Number(r)*UW/750;};}catch(e2){}}}u.__vdi_wrapped=true;}catch(e){console.warn("[vdi] uni patch failed",e);}};
        try{var ucur=window.uni;if(ucur)uwrap(ucur);Object.defineProperty(window,"uni",{configurable:true,get:function(){return ucur;},set:function(v){ucur=v;uwrap(v);}});}catch(e){console.warn("[vdi] window.uni setter failed",e);}
      }
      var c = document.createElement("style");
      c.textContent='${css}';
      document.head.appendChild(c);
      var shell=document.createElement("div"); shell.setAttribute("data-vdi-phone-shell","");
      var wrap=document.createElement("div"); wrap.setAttribute("data-vdi-phone-wrap","");
      var frame=document.createElement("div"); frame.setAttribute("data-vdi-phone-frame","");
      frame.innerHTML="<div data-vdi-phone-speaker></div><div data-vdi-phone-cam></div><div data-vdi-phone-notch></div><div data-vdi-phone-screen></div><div data-vdi-phone-bar></div>";
      wrap.appendChild(frame);
      // 侧边按钮挂 wrap（frame 的兄弟），不被 frame 的 overflow:hidden 裁掉，能伸出框外
      wrap.insertAdjacentHTML("beforeend","<div data-vdi-phone-btn data-vdi-phone-btn-l1></div><div data-vdi-phone-btn data-vdi-phone-btn-l2></div><div data-vdi-phone-btn data-vdi-phone-btn-l3></div><div data-vdi-phone-btn data-vdi-phone-btn-right></div>");
      shell.appendChild(wrap);
      var screen=frame.querySelector("[data-vdi-phone-screen]");
      var body=document.body;
      // 只搬元素节点进 screen，跳过 <script>/<style>/<link>/<noscript>。
      // 关键：搬动一个尚未执行的 parser-inserted module script（如 /src/main.ts）
      // 会让它不再执行 —— main.ts 不跑则 Vue 不挂载、页面空白。脚本必须留在 body
      // 原位由解析器正常触发；#app 搬进 screen 后，main.ts 仍能 getElementById 命中并挂载。
      for(var n=body.firstChild;n;n=next){var next=n.nextSibling;if(n===shell)break;if(n.nodeType===1&&/^(SCRIPT|STYLE|LINK|NOSCRIPT)$/.test(n.tagName))continue;screen.appendChild(n);}
      body.appendChild(shell);
      new MutationObserver(function(ms){for(var i=0;i<ms.length;i++){var ad=ms[i].addedNodes;for(var j=0;j<ad.length;j++){var n=ad[j];if(n.nodeType!==1)continue;if(n.tagName==="UNI-PAGE-HEAD"||(n.classList&&n.classList.contains("uni-page-head"))){if(!screen.contains(n))screen.insertBefore(n,screen.firstChild)}}}}).observe(body,{childList:true,subtree:true});
      setTimeout(function(){if(!screen.firstChild){var app=document.getElementById("app");if(app&&!screen.contains(app))screen.appendChild(app);}},1000);
    }();`;

  return `<script>${body}</script>`;
}
