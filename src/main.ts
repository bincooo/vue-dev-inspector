import './index.css'
import { DemoApp } from './demo'
import { esc } from './helpers'
import {
  vitePluginCode, astTransformCode, clientScriptCode, sharedCode,
  compiledOutputCode, monorepoStructureCode, demoViteConfigCode,
  usageCode, installCode,
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
  structure: { code: monorepoStructureCode, title: 'Monorepo 项目结构 (pnpm workspace)', hint: '📁 <strong>Monorepo 结构：</strong>使用 pnpm-workspace.yaml 管理多包项目。<code class="bg-slate-200 px-1 rounded text-xs">packages/demo/</code> 是一个完整 Vue 3 项目，在 vite.config.ts 中接入了插件。', hintBg: 'bg-slate-50', hintBorder: 'border-slate-200', hintText: 'text-slate-700' },
  demo: { code: demoViteConfigCode, title: 'packages/demo/vite.config.ts — 插件接入', hint: '🎯 <strong>插件接入点：</strong>Demo 项目的 vite.config.ts 中引入 <code class="bg-rose-100 px-1 rounded text-xs">vite-plugin-vue-dev-inspector</code>，配置 attrName / editor / exclude 等选项，放在 <code class="bg-rose-100 px-1 rounded text-xs">vue()</code> 之前。运行 <code class="bg-rose-100 px-1 rounded text-xs">pnpm dev</code> 后按 Alt+Shift+I 即可审查。', hintBg: 'bg-rose-50', hintBorder: 'border-rose-100', hintText: 'text-rose-700' },
  plugin: { code: vitePluginCode, title: 'packages/vite-plugin-vue-dev-inspector/src/plugin.ts', hint: '💡 <strong>核心插件：</strong>在 Vite transform 钩子中基于 AST 注入 data-source-file 属性，引用 transform.ts 和 client.ts 子模块。', hintBg: 'bg-blue-50', hintBorder: 'border-blue-100', hintText: 'text-blue-700' },
  ast: { code: astTransformCode, title: 'packages/ast-walker/src/walker.ts', hint: '🌳 <strong>AST 遍历器：</strong>独立包，使用 baseParse() + 递归 walkNode() 遍历 ELEMENT/IF/FOR/ROOT 节点。', hintBg: 'bg-purple-50', hintBorder: 'border-purple-100', hintText: 'text-purple-700' },
  client: { code: clientScriptCode, title: 'packages/vite-plugin-vue-dev-inspector/src/client.ts', hint: '🖱️ <strong>客户端脚本：</strong>生成注入页面的审查脚本，parseAttr() 解析合并属性，支持可配置编辑器 Protocol。', hintBg: 'bg-teal-50', hintBorder: 'border-teal-100', hintText: 'text-teal-700' },
  shared: { code: sharedCode, title: 'packages/shared/src/index.ts', hint: '📦 <strong>共享工具包：</strong>导出 parseSourceAttr()、编辑器 Protocol 映射、内置标签列表等常量。', hintBg: 'bg-indigo-50', hintBorder: 'border-indigo-100', hintText: 'text-indigo-700' },
  output: { code: compiledOutputCode, title: '编译前后 DOM 对比', hint: '📄 <strong>编译对比：</strong>每个 DOM 元素带有 data-source-file="path:line:col" 属性，v-if 分支也被正确标记。', hintBg: 'bg-amber-50', hintBorder: 'border-amber-100', hintText: 'text-amber-700' },
}
const TAB_LABELS: [string, string][] = [
  ['structure', '📁 项目结构'], ['demo', '🎯 Demo 接入'], ['plugin', '🔌 Vite 插件'], ['ast', '🌳 AST 遍历'],
  ['client', '🖱️ 客户端脚本'], ['shared', '📦 共享工具'], ['output', '📄 编译输出'],
]

const FEATURES = [
  { icon: '🌳', title: 'AST 深度遍历', desc: '通过 @vue/compiler-core 递归遍历 Element/If/For 等所有节点类型', gradient: 'from-purple-500 to-purple-600' },
  { icon: '📍', title: 'node.loc 精确定位', desc: '直接从 AST 节点 loc 读取行列号，精确到字符级别', gradient: 'from-blue-500 to-blue-600' },
  { icon: '🔍', title: '智能节点过滤', desc: '通过 NodeTypes 精确判断节点类型，自动跳过 Vue 内置标签', gradient: 'from-emerald-500 to-emerald-600' },
  { icon: '🖱️', title: '交互式审查', desc: 'Alt+Shift+I 开启审查模式，鼠标悬停高亮并显示文件信息', gradient: 'from-amber-500 to-orange-500' },
  { icon: '🔗', title: '一键跳转编辑器', desc: '点击元素通过 vscode://file/ 协议跳转到源码位置', gradient: 'from-pink-500 to-rose-500' },
  { icon: '🛡️', title: '零生产影响', desc: '仅在 vite serve 时执行，生产构建 transform 直接跳过', gradient: 'from-cyan-500 to-teal-500' },
]

const FAQS = [
  { q: '为什么选择 AST 方案而不是正则？', a: 'AST 能精确识别每个 ElementNode 和嵌套结构（v-if/v-for），不会误匹配注释或字符串，位置信息由编译器保证精确。' },
  { q: '会影响生产环境吗？', a: '不会。插件通过 configResolved 判断 isDev，仅在 vite serve 时注入属性和脚本，生产构建完全无痕。' },
  { q: '如何与 @vitejs/plugin-vue 协同？', a: '使用 enforce: "pre" 在 Vue 编译前处理，通过 MagicString 修改源码后交给 Vue 插件正常编译。' },
  { q: '为什么用 pnpm monorepo？', a: '将插件、AST 遍历器、共享工具分离为独立包，各包可独立版本发布、独立测试，依赖关系清晰。' },
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
        <span class="font-bold text-lg text-slate-800">Vue Dev<span class="text-emerald-500">Inspector</span></span>
        <span class="hidden sm:inline-flex items-center px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[10px] font-bold rounded-full border border-emerald-100">AST + pnpm</span>
      </div>
      <div class="hidden md:flex items-center gap-8 text-sm text-slate-500">
        <a href="#features" class="hover:text-slate-800">特性</a><a href="#demo" class="hover:text-slate-800">演示</a><a href="#code" class="hover:text-slate-800">源码</a><a href="#guide" class="hover:text-slate-800">使用指南</a>
      </div>
      <a href="#guide" class="hidden md:flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white text-sm font-medium rounded-lg hover:bg-emerald-600 shadow-md shadow-emerald-200">快速开始 →</a>
    </div>
  </nav>

  <section class="relative pt-20 pb-24 overflow-hidden">
    <div class="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-to-br from-emerald-100/40 via-teal-50/30 to-transparent rounded-full blur-3xl -z-10"></div>
    <div class="max-w-4xl mx-auto px-6 text-center">
      <div class="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-50 text-emerald-600 text-xs font-medium rounded-full mb-6 border border-emerald-100">✨ 基于 AST · pnpm Monorepo · Vite Plugin</div>
      <h1 class="text-5xl md:text-6xl font-extrabold text-slate-900 leading-tight mb-6">基于 <span class="bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent">AST 遍历</span> 精确定位<br/>Vue 组件源码</h1>
      <p class="text-lg text-slate-500 max-w-2xl mx-auto mb-10 leading-relaxed">通过 <code class="bg-slate-100 px-1.5 py-0.5 rounded text-sm font-mono text-slate-700">@vue/compiler-sfc</code> 解析 AST，pnpm monorepo 多包管理，为每个 DOM 元素注入文件路径信息。</p>
      <div class="flex flex-wrap items-center justify-center gap-4 mb-12">
        <a href="#demo" class="flex items-center gap-2 px-6 py-3 bg-emerald-500 text-white font-medium rounded-xl hover:bg-emerald-600 shadow-lg shadow-emerald-200">🖱️ 查看交互演示</a>
        <a href="#code" class="flex items-center gap-2 px-6 py-3 bg-white text-slate-700 font-medium rounded-xl border border-slate-200 hover:shadow-md">📂 查看 Monorepo 源码</a>
      </div>
      <div class="inline-flex items-center gap-3 bg-slate-900 rounded-xl px-5 py-3 shadow-2xl"><span class="text-slate-400">$</span><code class="text-sm text-slate-300 font-mono">pnpm add -D <span class="text-emerald-400">vite-plugin-vue-dev-inspector</span></code></div>
    </div>
  </section>

  <section class="py-16 bg-slate-50/50">
    <div class="max-w-5xl mx-auto px-6">
      <div class="text-center mb-10"><h2 class="text-2xl font-bold text-slate-900 mb-2">AST 编译管线</h2></div>
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        ${['📄 parse() 解析 SFC|使用 @vue/compiler-sfc 将 .vue 文件解析为 descriptor|border-blue-200 bg-blue-50/50','🌳 baseParse() 生成 AST|将模板解析为 RootNode AST 树|border-purple-200 bg-purple-50/50','🔍 walkNode() 遍历注入|递归遍历 AST，通过 MagicString 注入属性|border-emerald-200 bg-emerald-50/50','🖱️ 客户端高亮审查|注入浏览器脚本，鼠标悬停高亮，点击跳转编辑器|border-amber-200 bg-amber-50/50'].map((s,i)=>{const[t,d,c]=s.split('|');return`<div class="relative p-5 rounded-xl border ${c} hover:shadow-md"><div class="absolute -top-3 left-4 bg-white px-2 py-0.5 rounded-full text-xs font-bold text-slate-400 border border-slate-200">Step ${i+1}</div><h3 class="font-semibold text-slate-800 text-sm mb-1.5 mt-1">${t}</h3><p class="text-xs text-slate-500 leading-relaxed">${d}</p>${i<3?'<span class="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 text-slate-300 z-10">→</span>':''}</div>`;}).join('')}
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
        <div class="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-600 text-xs font-medium rounded-full mb-4 border border-emerald-100">🖱️ 交互演示</div>
        <h2 class="text-3xl font-bold text-slate-900 mb-3">亲自体验审查模式</h2>
        <p class="text-slate-500 max-w-lg mx-auto">开启审查模式后，鼠标悬停查看文件信息，右键编辑属性、添加组件或删除</p>
      </div>
      <div id="demo-root"></div>
    </div>
  </section>

  <section id="code" class="py-20">
    <div class="max-w-4xl mx-auto px-6">
      <div class="text-center mb-12">
        <div class="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-600 text-xs font-medium rounded-full mb-4 border border-blue-100">📂 完整源码</div>
        <h2 class="text-3xl font-bold text-slate-900 mb-3">pnpm Monorepo 多包结构</h2>
        <p class="text-slate-500">核心插件 + AST 遍历器 + 共享工具 + 客户端脚本，各包独立管理</p>
      </div>
      <div class="flex flex-wrap items-center gap-2 mb-6 bg-slate-100 p-1 rounded-xl w-fit" id="code-tabs">
        ${TAB_LABELS.map(([k,lbl])=>`<button data-tab="${k}" class="px-4 py-2 text-sm font-medium rounded-lg transition-all ${activeTab===k?'bg-emerald-500 text-white shadow-md shadow-emerald-200':'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}">${lbl}</button>`).join('')}
      </div>
      <div id="code-content">${codeBlock(TABS[activeTab].code,TABS[activeTab].title)}</div>
      <div id="code-hint" class="mt-6 p-4 ${TABS[activeTab].hintBg} rounded-xl border ${TABS[activeTab].hintBorder}"><p class="text-sm ${TABS[activeTab].hintText} leading-relaxed">${TABS[activeTab].hint}</p></div>
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

  <section class="py-20"><div class="max-w-4xl mx-auto px-6"><div class="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-3xl p-10 md:p-14 text-center text-white relative overflow-hidden"><div class="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3"></div><div class="relative z-10"><h2 class="text-3xl md:text-4xl font-bold mb-4">AST 级别的精确审查</h2><p class="text-emerald-100 max-w-lg mx-auto mb-8 leading-relaxed">pnpm monorepo 多包管理，编译器 AST 精确遍历每个节点。</p><div class="flex flex-wrap items-center justify-center gap-4"><a href="#guide" class="px-6 py-3 bg-white text-emerald-600 font-semibold rounded-xl hover:bg-emerald-50 shadow-lg">⚡ 立即使用</a><a href="#code" class="px-6 py-3 bg-white/10 text-white font-medium rounded-xl border border-white/20 hover:bg-white/20">📂 查看源码</a></div></div></div></div></section>

  <footer class="py-10 border-t border-slate-100"><div class="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4"><div class="flex items-center gap-2"><div class="w-7 h-7 rounded-md bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-sm">👁</div><span class="text-sm font-semibold text-slate-700">Vue DevInspector</span><span class="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-100 font-bold">AST + pnpm</span></div><p class="text-xs text-slate-400">基于 @vue/compiler-sfc AST 遍历 · pnpm monorepo · 零生产影响</p><div class="flex items-center gap-4 text-xs text-slate-400"><span>MIT License</span><span>·</span><span>Vue 3</span><span>·</span><span>Vite 5+</span></div></div></footer>
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

    const demoRoot = document.getElementById('demo-root')
    if (demoRoot) new DemoApp(demoRoot)
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
