import './index.css'
import { esc } from './helpers'
import {
  vitePluginCode, optionsCode, astTransformCode, overlayCode, serverCode, editorCode, sharedCode,
  compiledOutputCode, monorepoStructureCode, demoViteConfigCode,
  usageCode, installCode, workspaceCode,
} from './data/pluginCode'

/* ──────── Code block renderer ──────── */
function codeBlock(code: string, title?: string): string {
  const lines = code.split('\n')
  const numbered = lines.map((l, i) =>
    `<div class="flex"><span class="select-none text-slate-600 w-8 text-right mr-4 text-xs leading-relaxed flex-shrink-0">${i + 1}</span><span>${esc(l)}</span></div>`
  ).join('')
  return `<div class="rounded-xl overflow-hidden border border-slate-700/50 bg-[#1e1e2e] shadow-2xl">
    ${title ? `<div class="flex items-center gap-2 px-4 py-3 bg-[#181825] border-b border-slate-700/50"><div class="flex gap-1.5"><div class="w-3 h-3 rounded-full bg-red-500/80"></div><div class="w-3 h-3 rounded-full bg-yellow-500/80"></div><div class="w-3 h-3 rounded-full bg-green-500/80"></div></div><span class="text-xs text-slate-400 ml-2 font-mono">${esc(title)}</span></div>` : ''}
    <pre class="p-4 overflow-x-auto text-sm leading-relaxed text-slate-300 font-mono">${numbered}</pre>
  </div>`
}

/* ──────── Tab data ──────── */
interface TabInfo { code: string; title: string; hint: string; hintBg: string; hintBorder: string; hintText: string }
const TABS: Record<string, TabInfo> = {
  structure: { code: monorepoStructureCode, title: 'Monorepo 项目结构 (pnpm workspace)', hint: '📁 <strong>Monorepo 结构：</strong>pnpm-workspace.yaml 管理多包项目。新增 <code class="bg-slate-200 px-1 rounded text-xs">packages/overlay/</code> 浏览器审查 UI 子工程（编译为单文件 IIFE），<code class="bg-slate-200 px-1 rounded text-xs">packages/client/</code> 服务端 AST 操作，<code class="bg-slate-200 px-1 rounded text-xs">packages/demo/</code> 是接入插件的完整 Vue 3 项目。', hintBg: 'bg-slate-50', hintBorder: 'border-slate-200', hintText: 'text-slate-700' },
  demo: { code: demoViteConfigCode, title: 'packages/demo/vite.config.ts — 插件接入', hint: '🎯 <strong>插件接入点：</strong>Demo 引入 <code class="bg-rose-100 px-1 rounded text-xs">vite-plugin-vue-dev-inspector</code>，配置 attrName / editor / toggleBtn 等选项，放在 <code class="bg-rose-100 px-1 rounded text-xs">vue()</code> 之前。运行 <code class="bg-rose-100 px-1 rounded text-xs">pnpm dev:demo</code> 后按 Alt+Shift+I 或点⚙齿轮即可审查。', hintBg: 'bg-rose-50', hintBorder: 'border-rose-100', hintText: 'text-rose-700' },
  plugin: { code: vitePluginCode, title: 'packages/vite-plugin-vue-dev-inspector/src/plugin.ts', hint: '💡 <strong>核心插件：</strong>transformIndexHtml 读取 <code class="bg-blue-100 px-1 rounded text-xs">overlay/dist/overlay.iife.js</code> 单文件，注入 <code class="bg-blue-100 px-1 rounded text-xs">window.__DEV_INSPECTOR_CFG__</code> + overlay 脚本，避免字符串拼脚本。', hintBg: 'bg-blue-50', hintBorder: 'border-blue-100', hintText: 'text-blue-700' },
  options: { code: optionsCode, title: 'packages/vite-plugin-vue-dev-inspector/src/options.ts', hint: '⚙️ <strong>配置：</strong>DevInspectorOptions 含 <code class="bg-cyan-100 px-1 rounded text-xs">toggleBtn</code>（右下角齿轮按钮）、wrapComponents、shortcut、editor 等。', hintBg: 'bg-cyan-50', hintBorder: 'border-cyan-100', hintText: 'text-cyan-700' },
  overlay: { code: overlayCode, title: 'packages/overlay/src/ — 浏览器审查 UI', hint: '👁 <strong>overlay 子工程：</strong>独立 TS 模块（不再是字符串），Vite 编译为单文件 IIFE。<code class="bg-fuchsia-100 px-1 rounded text-xs">state.ts</code> 共享可变状态、<code class="bg-fuchsia-100 px-1 rounded text-xs">inspector.ts</code> overlay 状态机（含±同级插入按钮）、<code class="bg-fuchsia-100 px-1 rounded text-xs">events.ts</code> 绑定事件+齿轮按钮。', hintBg: 'bg-fuchsia-50', hintBorder: 'border-fuchsia-100', hintText: 'text-fuchsia-700' },
  server: { code: serverCode, title: 'packages/client/src/server.ts — dev 中间件', hint: '🖥️ <strong>服务端 API：</strong>Vite dev server 中间件，路由 <code class="bg-orange-100 px-1 rounded text-xs">/get-props</code> / <code class="bg-orange-100 px-1 rounded text-xs">/insert-component</code>（支持 before/after/inside）/ <code class="bg-orange-100 px-1 rounded text-xs">/delete-element</code> 等，AST 操作后写回文件触发 HMR。', hintBg: 'bg-orange-50', hintBorder: 'border-orange-100', hintText: 'text-orange-700' },
  editor: { code: editorCode, title: 'packages/client/src/editor.ts — AST 编辑', hint: '✏️ <strong>源码编辑：</strong>AST 定位 + MagicString 原子替换。<code class="bg-lime-100 px-1 rounded text-xs">deleteElement</code> 用 AST 精确删除（解决同行内嵌子元素误删问题）；<code class="bg-lime-100 px-1 rounded text-xs">insertComponent</code> 支持 inside/before/after 三种方向。', hintBg: 'bg-lime-50', hintBorder: 'border-lime-100', hintText: 'text-lime-700' },
  ast: { code: astTransformCode, title: 'packages/ast-walker/src/walker.ts', hint: '🌳 <strong>AST 遍历器：</strong>独立包，baseParse() + 递归 walkNode() 遍历 ELEMENT/IF/FOR/ROOT 节点。', hintBg: 'bg-purple-50', hintBorder: 'border-purple-100', hintText: 'text-purple-700' },
  shared: { code: sharedCode, title: 'packages/shared/src/index.ts', hint: '📦 <strong>共享工具包：</strong>parseSourceAttr()、编辑器 Protocol 映射、内置标签列表等常量。', hintBg: 'bg-indigo-50', hintBorder: 'border-indigo-100', hintText: 'text-indigo-700' },
  output: { code: compiledOutputCode, title: '编译前后 DOM 对比', hint: '📄 <strong>编译对比：</strong>每个 DOM 元素带 data-source-file="path:line:col" 属性，v-if 分支也被正确标记。', hintBg: 'bg-amber-50', hintBorder: 'border-amber-100', hintText: 'text-amber-700' },
  ws: { code: workspaceCode, title: 'pnpm-workspace.yaml + root package.json', hint: '🧩 <strong>workspace：</strong><code class="bg-emerald-100 px-1 rounded text-xs">dev:demo</code> 自动先构建 overlay 再启动 demo，保证 overlay iife 产物就绪。', hintBg: 'bg-emerald-50', hintBorder: 'border-emerald-100', hintText: 'text-emerald-700' },
}

const FEATURES = [
  { icon: '🌳', title: 'AST 深度遍历', desc: '通过 @vue/compiler-core 递归遍历 Element/If/For 等所有节点类型', gradient: 'from-purple-500 to-purple-600' },
  { icon: '📍', title: 'node.loc 精确定位', desc: '直接从 AST 节点 loc 读取行列号，精确到字符级别', gradient: 'from-blue-500 to-blue-600' },
  { icon: '🔍', title: '智能节点过滤', desc: '通过 NodeTypes 精确判断节点类型，自动跳过 Vue 内置标签', gradient: 'from-emerald-500 to-emerald-600' },
  { icon: '🖱️', title: '交互式审查', desc: '⚙ 齿轮按钮或 Alt+Shift+I 开启审查模式，悬停高亮并显示文件信息', gradient: 'from-amber-500 to-orange-500' },
  { icon: '✏️', title: '可视化编辑', desc: '右键编辑属性 / 组件面板插入 (同级上/下/内部) / 删除 / 复制，AST 回写 + HMR', gradient: 'from-lime-500 to-green-500' },
  { icon: '🛡️', title: '零生产影响', desc: '仅 vite serve 时执行，overlay 为独立子工程编译单文件 IIFE，生产构建无痕', gradient: 'from-cyan-500 to-teal-500' },
]

const FAQS = [
  { q: '为什么选择 AST 方案而不是正则？', a: 'AST 能精确识别每个 ElementNode 和嵌套结构（v-if/v-for），不会误匹配注释或字符串，位置信息由编译器保证精确。删除/插入等源码操作也走 AST，能正确处理同一行内嵌子元素的场景。' },
  { q: '会影响生产环境吗？', a: '不会。插件通过 configResolved 判断 isDev，仅在 vite serve 时注入属性和 overlay 脚本，生产构建完全无痕。overlay 是独立子工程编译出的单文件 IIFE。' },
  { q: 'overlay 为什么拆成独立子工程？', a: '原本审查脚本是写在 TS 字符串模板里（string-in-string），难维护、无类型支持。拆成 @vue-dev-inspector/overlay 子工程后，用真实 TS 模块编写、Vite 编译为单文件 IIFE，插件运行时 readFileSync 并注入，配置通过 window.__DEV_INSPECTOR_CFG__ 全局变量传递。' },
  { q: '齿轮按钮和同级插入 ± 按钮是什么？', a: '右下角⚙齿轮按钮：点击开启审查、开启后隐藏、关闭后显示，由 toggleBtn 配置控制。选中元素后选中框上/下边框中点出现 + 按钮，点击在同级上方/下方插入组件并打开组件面板。' },
  { q: '如何与 @vitejs/plugin-vue 协同？', a: '使用 enforce: "pre" 在 Vue 编译前处理，通过 MagicString 修改源码后交给 Vue 插件正常编译。' },
  { q: '为什么用 pnpm monorepo？', a: '将插件、overlay 审查 UI、服务端 client、AST 遍历器、共享工具分离为独立包，各包可独立版本发布、独立测试，依赖关系清晰。dev:demo 脚本会先构建 overlay 产物再启动 demo。' },
  { q: 'node.loc 精度如何？', a: '包含 line (1-based)、column (0-based)、offset (字符偏移)，由 Vue 编译器保证绝对精确。' },
]

/* ══════════════════════════════════════════ */
function init() {
  const root = document.getElementById('root')!
  let activeTab = 'structure'
  let expandedFaq: number | null = null

  function renderPage() {
    root.innerHTML = `
<div class="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50">
  <nav class="sticky top-0 z-50 backdrop-blur-xl bg-white/80 border-b border-slate-100">
    <div class="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-200 text-white text-lg">👁</div>
        <span class="font-bold text-lg text-slate-800">Vue Dev <span class="text-emerald-500">Inspector</span></span>
        <span class="hidden sm:inline-flex items-center px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[10px] font-bold rounded-full border border-emerald-100">AST + pnpm</span>
      </div>
      <div class="hidden md:flex items-center gap-8 text-sm text-slate-500">
        <a href="#features" class="hover:text-slate-800">特性</a><a href="#guide" class="hover:text-slate-800">使用指南</a>
      </div>
      <a href="#guide" class="hidden md:flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white text-sm font-medium rounded-lg hover:bg-emerald-600 shadow-md shadow-emerald-200">快速开始 →</a>
    </div>
  </nav>

  <section class="relative pt-20 pb-24 overflow-hidden">
    <div class="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-to-br from-emerald-100/40 via-teal-50/30 to-transparent rounded-full blur-3xl -z-10"></div>
    <div class="max-w-4xl mx-auto px-6 text-center">
      <div class="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-50 text-emerald-600 text-xs font-medium rounded-full mb-6 border border-emerald-100">✨ 基于 AST · pnpm Monorepo · Vite Plugin</div>
      <h1 class="text-5xl md:text-6xl font-extrabold text-slate-900 leading-tight mb-6">基于 <span class="bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent">AST 遍历</span> 精确定位<br/>Vue 组件源码</h1>
      <p class="text-lg text-slate-500 max-w-2xl mx-auto mb-10 leading-relaxed">通过 <code class="bg-slate-100 px-1.5 py-0.5 rounded text-sm font-mono text-slate-700">@vue/compiler-sfc</code> 解析 AST，<code class="bg-slate-100 px-1.5 py-0.5 rounded text-sm font-mono text-slate-700">overlay</code> 子工程独立编译审查 UI，pnpm monorepo 多包架构，可视化编辑属性 / 插入 / 删除。</p>
      <div class="flex flex-wrap items-center justify-center gap-4 mb-12">
        <a href="#guide" class="flex items-center gap-2 px-6 py-3 bg-emerald-500 text-white font-medium rounded-xl hover:bg-emerald-600 shadow-lg shadow-emerald-200">⚡ 快速开始</a>
        <a href="#code" class="flex items-center gap-2 px-6 py-3 bg-white text-slate-700 font-medium rounded-xl border border-slate-200 hover:shadow-md">📂 查看 Monorepo 源码</a>
      </div>
      <div class="inline-flex items-center gap-3 bg-slate-900 rounded-xl px-5 py-3 shadow-2xl"><span class="text-slate-400">$</span><code class="text-sm text-slate-300 font-mono">pnpm add -D <span class="text-emerald-400">vite-plugin-vue-dev-inspector</span></code></div>
    </div>
  </section>

  <section class="py-16 bg-slate-50/50">
    <div class="max-w-5xl mx-auto px-6">
      <div class="text-center mb-10"><h2 class="text-2xl font-bold text-slate-900 mb-2">AST 编译管线</h2></div>
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        ${['📄 parse() 解析 SFC|使用 @vue/compiler-sfc 将 .vue 文件解析为 descriptor|border-blue-200 bg-blue-50/50','🌳 baseParse() 生成 AST|将模板解析为 RootNode AST 树|border-purple-200 bg-purple-50/50','🔍 walkNode() 遍历注入|递归遍历 AST，通过 MagicString 注入属性|border-emerald-200 bg-emerald-50/50','👁 overlay 审查 UI|独立子工程编译单文件 IIFE，悬停高亮 / 可视编辑 / HMR|border-amber-200 bg-amber-50/50'].map((s,i)=>{const[t,d,c]=s.split('|');return`<div class="relative p-5 rounded-xl border ${c} hover:shadow-md"><div class="absolute -top-3 left-4 bg-white px-2 py-0.5 rounded-full text-xs font-bold text-slate-400 border border-slate-200">Step ${i+1}</div><h3 class="font-semibold text-slate-800 text-sm mb-1.5 mt-1">${t}</h3><p class="text-xs text-slate-500 leading-relaxed">${d}</p>${i<3?'<span class="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 text-slate-300 z-10">→</span>':''}</div>`;}).join('')}
      </div>
    </div>
  </section>

  <section id="features" class="py-20">
    <div class="max-w-6xl mx-auto px-6">
      <div class="text-center mb-14"><h2 class="text-3xl font-bold text-slate-900 mb-3">核心特性</h2><p class="text-slate-500">基于 AST 的编译时分析，pnpm monorepo 多包架构</p></div>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        ${FEATURES.map(f=>`<div class="p-6 rounded-2xl bg-white border border-slate-100 hover:border-slate-200 hover:shadow-lg transition-all"><div class="w-12 h-12 rounded-xl flex items-center justify-center mb-4 bg-gradient-to-br ${f.gradient} shadow-lg text-2xl">${f.icon}</div><h3 class="text-lg font-semibold text-slate-800 mb-2">${f.title}</h3><p class="text-sm text-slate-500 leading-relaxed">${f.desc}</p></div>`).join('')}
      </div>
    </div>
  </section>

  <section id="demo" class="py-20 bg-gradient-to-b from-slate-50 to-white">
    <div class="max-w-4xl mx-auto px-6">
      <div class="text-center mb-12">
        <div class="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-600 text-xs font-medium rounded-full mb-4 border border-emerald-100">👁 审查模式说明</div>
        <h2 class="text-3xl font-bold text-slate-900 mb-3">交互能力一览</h2>
        <p class="text-slate-500 max-w-lg mx-auto">开启审查模式后，鼠标悬停可查看文件信息，右键可编辑属性、插入组件或删除元素</p>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        ${[
          '⚙ 齿轮按钮|右下角固定圆形按钮，点击开启审查；审查开启后隐藏，按 Esc 或快捷键关闭后恢复显示；可在插件配置中关闭 (toggleBtn:false)',
          '🖱️ 悬停高亮|鼠标悬停元素时显示虚线高亮框与组件标签名（优先取 data-inspector-tag），离开自动收起',
          '🎯 选中状态|单击元素选中，蓝色实线选中框；选中框右下角出现 ⧉ 复制 / × 删除两个操作按钮',
          '➕ 同级插入|选中元素后选中框上 / 下边框中点出现 + 按钮，点击在同级上方 / 下方插入组件并打开组件面板',
          '🧩 组件面板|右侧滑入抽屉，搜索 + 分组列表，点击组件插入到选中元素内部 / 同级上 / 同级下方',
          '⚙️ 编辑属性|右键菜单 → 编辑属性：弹窗拉取 /get-props，可视化增删改属性后基于 AST 回写 /update-props，触发 Vite HMR',
          '🗑️ 删除元素|× 按钮或右键菜单 → 删除：基于 AST 精确定位元素源码区间删除，正确处理同行内嵌子元素',
          '⧉ 复制元素|⧉ 按钮：基于 AST 复制完整源码区间并在同级紧随其后插入副本，保留原行缩进',
          '📦 在编辑器中打开|右键 → 在编辑器中打开：调用 /open-in-editor，按 vscode / webstorm 等协议定位行号',
        ].map(s=>{const[t,d]=s.split('|');return`<div class="p-5 rounded-xl bg-white border border-slate-100 hover:border-slate-200 hover:shadow-md transition-all"><h3 class="font-semibold text-slate-800 text-sm mb-2">${t}</h3><p class="text-xs text-slate-500 leading-relaxed">${d}</p></div>`;}).join('')}
      </div>
      <div class="mt-8 p-5 bg-amber-50 rounded-xl border border-amber-100">
        <p class="text-sm text-amber-700 leading-relaxed">💡 <strong>触发方式：</strong>审查模式可通过右下角⚙齿轮按钮或快捷键 <kbd class="px-2 py-1 bg-white rounded border border-amber-200 text-xs font-mono">Alt+Shift+I</kbd> 开关；快速插入只读末尾「内联 + 按钮 / 齿轮 / 抽屉」交互入口。</p>
      </div>
    </div>
  </section>

  <section id="guide" class="py-20 bg-gradient-to-b from-white to-slate-50">
    <div class="max-w-4xl mx-auto px-6">
      <div class="text-center mb-14"><div class="inline-flex items-center gap-2 px-3 py-1 bg-teal-50 text-teal-600 text-xs font-medium rounded-full mb-4 border border-teal-100">⚡ 快速开始</div><h2 class="text-3xl font-bold text-slate-900 mb-3">三步接入</h2></div>
      <div class="max-w-2xl mx-auto space-y-8">
        <div><div class="flex items-center gap-3 mb-3"><div class="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-sm shadow-lg shadow-emerald-200">1</div><h4 class="font-semibold text-slate-800">安装依赖</h4></div>${codeBlock(installCode,'Terminal')}</div>
        <div><div class="flex items-center gap-3 mb-3"><div class="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-sm shadow-lg shadow-emerald-200">2</div><h4 class="font-semibold text-slate-800">配置 Vite 插件</h4></div>${codeBlock(usageCode,'vite.config.ts')}</div>
        <div><div class="flex items-center gap-3 mb-3"><div class="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-sm shadow-lg shadow-emerald-200">3</div><h4 class="font-semibold text-slate-800">启动开发服务器</h4></div>
          <div class="flex flex-wrap gap-2 mt-3"><kbd class="px-2.5 py-1.5 bg-white rounded-lg border border-slate-200 text-xs text-slate-600 font-mono shadow-sm">Alt</kbd><span class="text-slate-400 self-center">+</span><kbd class="px-2.5 py-1.5 bg-white rounded-lg border border-slate-200 text-xs text-slate-600 font-mono shadow-sm">Shift</kbd><span class="text-slate-400 self-center">+</span><kbd class="px-2.5 py-1.5 bg-white rounded-lg border border-slate-200 text-xs text-slate-600 font-mono shadow-sm">I</kbd><span class="text-sm text-slate-400 self-center ml-2">开启/关闭审查模式</span></div>
        </div>
      </div>
    </div>
  </section>

  <section id="faq" class="py-20 bg-gradient-to-b from-slate-50 to-white">
    <div class="max-w-3xl mx-auto px-6">
      <div class="text-center mb-12"><h2 class="text-3xl font-bold text-slate-900 mb-3">常见问题</h2></div>
      <div class="space-y-3" id="faq-list">
        ${FAQS.map((f,i)=>`<div class="bg-white rounded-xl border border-slate-100 overflow-hidden hover:border-slate-200 transition-colors"><button data-faq="${i}" class="w-full flex items-center justify-between p-5 text-left"><span class="text-sm font-medium text-slate-700 pr-4">${esc(f.q)}</span><span class="text-slate-400 flex-shrink-0">${expandedFaq===i?'▾':'▸'}</span></button>${expandedFaq===i?`<div class="px-5 pb-5 -mt-1"><p class="text-sm text-slate-500 leading-relaxed">${esc(f.a)}</p></div>`:''}</div>`).join('')}
      </div>
    </div>
  </section>

  <section class="py-20"><div class="max-w-4xl mx-auto px-6"><div class="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-3xl p-10 md:p-14 text-center text-white relative overflow-hidden"><div class="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3"></div><div class="relative z-10"><h2 class="text-3xl md:text-4xl font-bold mb-4">AST 级别的精确审查</h2><p class="text-emerald-100 max-w-lg mx-auto mb-8 leading-relaxed">pnpm monorepo 多包管理，编译器 AST 精确遍历每个节点。</p></div></div></div></section>

  <footer class="py-10 border-t border-slate-100"><div class="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4"><div class="flex items-center gap-2"><div class="w-7 h-7 rounded-md bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-sm">👁</div><span class="text-sm font-semibold text-slate-700">Vue Dev Inspector</span><span class="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-100 font-bold">AST + pnpm</span></div><p class="text-xs text-slate-400">基于 @vue/compiler-sfc AST 遍历 · pnpm monorepo · 零生产影响</p><div class="flex items-center gap-4 text-xs text-slate-400"><span>MIT License</span><span>·</span><span>Vue 3</span><span>·</span><span>Vite 5+</span></div></div></footer>
</div>`

    document.getElementById('code-tabs')?.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('button[data-tab]') as HTMLElement | null
      if (!btn) return
      activeTab = btn.dataset.tab!
      updateTabs()
    })

    document.getElementById('faq-list')?.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('button[data-faq]') as HTMLElement | null
      if (!btn) return
      const idx = parseInt(btn.dataset.faq!, 10)
      expandedFaq = expandedFaq === idx ? null : idx
      updateFaq()
    })
  }

  function updateTabs() {
    const tab = TABS[activeTab]
    document.querySelectorAll('#code-tabs button').forEach(btn => {
      const key = (btn as HTMLElement).dataset.tab
      btn.className = `px-4 py-2 text-sm font-medium rounded-lg transition-all ${key === activeTab ? 'bg-emerald-500 text-white shadow-md shadow-emerald-200' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`
    })
    const cc = document.getElementById('code-content')
    if (cc) cc.innerHTML = codeBlock(tab.code, tab.title)
    const ch = document.getElementById('code-hint')
    if (ch) { ch.className = `mt-6 p-4 ${tab.hintBg} rounded-xl border ${tab.hintBorder}`; ch.innerHTML = `<p class="text-sm ${tab.hintText} leading-relaxed">${tab.hint}</p>`; }
  }

  function updateFaq() {
    const fl = document.getElementById('faq-list')
    if (fl) {
      fl.innerHTML = FAQS.map((f, i) => `<div class="bg-white rounded-xl border border-slate-100 overflow-hidden hover:border-slate-200 transition-colors"><button data-faq="${i}" class="w-full flex items-center justify-between p-5 text-left"><span class="text-sm font-medium text-slate-700 pr-4">${esc(f.q)}</span><span class="text-slate-400 flex-shrink-0">${expandedFaq === i ? '▾' : '▸'}</span></button>${expandedFaq === i ? `<div class="px-5 pb-5 -mt-1"><p class="text-sm text-slate-500 leading-relaxed">${esc(f.a)}</p></div>` : ''}</div>`).join('')
    }
  }

  renderPage()
}

init()
