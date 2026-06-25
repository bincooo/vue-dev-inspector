import { esc } from './helpers'
import { parseDemoProject } from './parseDemo'
import type { El } from './parseDemo'
export type { El }

/* ──────── Import demo Vue files as raw strings ──────── */
const RAW_FILES = import.meta.glob('/packages/demo/src/**/*.vue', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>

/* ──────── Parse real AST from demo project ──────── */
function buildTreeFromDemo(): El[] {
  const files = Object.entries(RAW_FILES).map(([path, source]) => ({
    // "/packages/demo/src/App.vue" → "src/App.vue"
    path: path.replace('/packages/demo/', ''),
    source,
  }))
  const tree = parseDemoProject(files)
  // Assign visual classes to make the demo look nice
  return tree
}

/* ──────── Catalog for "add component" panel ──────── */
interface CatItem {
  label: string; tag: string; file: string; icon: string;
  elementType: string; defaultProps?: Record<string, string>;
}
const CAT: CatItem[] = [
  { label:'Button',  tag:'button', file:'src/components/Button.vue',  icon:'🔘', elementType:'COMPONENT', defaultProps:{type:'primary',size:'medium'} },
  { label:'Input',   tag:'input',  file:'src/components/Input.vue',   icon:'📝', elementType:'COMPONENT', defaultProps:{placeholder:'请输入'} },
  { label:'Badge',   tag:'span',   file:'src/components/Badge.vue',   icon:'🏷️', elementType:'COMPONENT', defaultProps:{value:'99+'} },
  { label:'Card',    tag:'div',    file:'src/components/Card.vue',    icon:'📦', elementType:'COMPONENT', defaultProps:{shadow:'hover'} },
  { label:'Alert',   tag:'div',    file:'src/components/Alert.vue',   icon:'⚠️', elementType:'COMPONENT', defaultProps:{type:'warning'} },
  { label:'Tag',     tag:'span',   file:'src/components/Tag.vue',     icon:'🔖', elementType:'COMPONENT', defaultProps:{color:'blue'} },
  { label:'Link',    tag:'a',      file:'src/components/Link.vue',    icon:'🔗', elementType:'ELEMENT',   defaultProps:{href:'#'} },
];

/* ──────── Tree helpers ──────── */
let _uid = 100;
function clone(t: El[]): El[] { return t.map(n => ({...n,props:n.props?{...n.props}:undefined,children:n.children?clone(n.children):undefined})); }
function removeEl(t: El[], id: string): El[] { return t.filter(n=>n.id!==id).map(n=>({...n,children:n.children?removeEl(n.children,id):undefined})); }
function addChild(t: El[], pid: string, c: El): El[] { return t.map(n=>n.id===pid?{...n,children:[...(n.children||[]),c]}:{...n,children:n.children?addChild(n.children,pid,c):undefined}); }
function setProps(t: El[], id: string, p: Record<string,string>): El[] { return t.map(n=>n.id===id?{...n,props:p}:{...n,children:n.children?setProps(n.children,id,p):undefined}); }
function findEl(t: El[], id: string): El|null { for(const n of t){if(n.id===id)return n;if(n.children){const r=findEl(n.children,id);if(r)return r;}}return null; }

/* ──────── Visual class mapping ──────── */
const SM: Record<string,string> = {
  'demo-app':'min-h-[340px] flex flex-col bg-white rounded-lg shadow-sm overflow-hidden',
  'demo-header':'flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200',
  'demo-logo':'font-bold text-sm text-slate-800',
  'demo-nav':'text-xs text-slate-500 space-x-3',
  'demo-main':'flex-1 p-4 space-y-3',
  'demo-hero':'text-center py-6 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-lg text-sm font-semibold text-emerald-700',
  'demo-cards':'grid grid-cols-3 gap-3',
  'demo-card':'p-3 bg-slate-50 rounded-lg text-center text-xs text-slate-600 border border-slate-100',
  'demo-footer':'px-4 py-2.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-400 text-center',
};

function ce(tag: string, cls?: string): HTMLElement {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  return el;
}

/* ══════════════════════════════════════════
   DemoApp — now driven by real AST parsing
   ══════════════════════════════════════════ */
export class DemoApp {
  private root: HTMLElement;
  private tree: El[];
  private initTree: El[];
  private inspect = false;
  private hovId: string|null = null;
  private selId: string|null = null;

  private nodes = new Map<string, HTMLElement>();
  private tags = new Map<string, HTMLElement>();
  private barEl!: HTMLElement;
  private prevEl!: HTMLElement;
  private treeBox!: HTMLElement;
  private infoEl!: HTMLElement;
  private overlayBox!: HTMLElement;

  constructor(root: HTMLElement) {
    this.root = root;
    this.initTree = buildTreeFromDemo();
    this.tree = clone(this.initTree);
    this.mount();
    document.addEventListener('mousedown', (e) => {
      // Only close overlays on LEFT click outside
      if (e.button !== 0) return;
      if (this.overlayBox.children.length > 0 && !this.overlayBox.contains(e.target as Node)) {
        this.closeOverlays();
        this.renderUI();
      }
    }, true);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { this.closeOverlays(); this.renderUI(); return; }
      if (this.selId && this.inspect && (e.key==='Delete'||e.key==='Backspace')) {
        e.preventDefault();
        const el = findEl(this.tree, this.selId);
        if (el) { this.toast(`已删除 &lt;${esc(el.label)} /&gt;`, clone(this.tree)); this.tree = removeEl(this.tree, this.selId); this.selId=null; this.hovId=null; this.rebuildTree(); }
      }
    });
  }

  private mount() {
    this.root.innerHTML = '';
    this.barEl = ce('div','mb-4');
    this.prevEl = ce('div','relative rounded-xl border border-slate-200 bg-slate-100 p-4 overflow-visible');
    this.treeBox = ce('div');
    this.infoEl = ce('div');
    this.overlayBox = ce('div');
    this.overlayBox.id = '__demo-overlays__';
    const chrome = ce('div','flex items-center gap-2 mb-3');
    chrome.innerHTML = '<div class="flex gap-1.5"><div class="w-2.5 h-2.5 rounded-full bg-red-400"></div><div class="w-2.5 h-2.5 rounded-full bg-yellow-400"></div><div class="w-2.5 h-2.5 rounded-full bg-green-400"></div></div><div class="flex-1 bg-white rounded-md px-3 py-1 text-xs text-slate-400 font-mono">localhost:5173</div>';
    this.prevEl.append(chrome, this.treeBox);
    this.root.append(this.barEl, this.prevEl, this.infoEl);
    // Append overlay container to body to avoid stacking context issues
    document.body.append(this.overlayBox);

    // Show parsed info
    const badge = ce('div','mb-3 flex items-center gap-2 text-xs text-slate-400');
    badge.innerHTML = `<span class="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100 font-medium">AST Parsed</span> 从 <code class="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-slate-600">packages/demo/src/</code> 实时解析 ${Object.keys(RAW_FILES).length} 个 Vue SFC 文件`;
    this.barEl.before(badge);

    this.rebuildTree();
  }

  private rebuildTree() {
    this.treeBox.innerHTML = '';
    this.nodes.clear();
    this.tags.clear();
    if (this.tree.length === 0) {
      this.treeBox.innerHTML = '<div class="flex flex-col items-center justify-center py-20 text-slate-400"><p class="text-sm font-medium mb-3">所有元素已删除</p></div>';
      const btn = ce('button','px-4 py-2 rounded-lg text-sm bg-emerald-500 text-white hover:bg-emerald-600 shadow-md');
      btn.textContent = '↺ 重置'; btn.onclick = () => { this.tree=clone(this.initTree); this.rebuildTree(); };
      this.treeBox.firstElementChild!.append(btn);
    } else {
      this.tree.forEach(el => this.treeBox.append(this.mkNode(el)));
    }
    this.applyStyles();
    this.renderUI();
  }

  private mkNode(el: El): HTMLElement {
    const div = ce('div', `${SM[el.cls]||''} relative`);
    div.setAttribute('data-source-file', `${el.file}:${el.line}:${el.col}`);
    this.nodes.set(el.id, div);
    const tag = ce('span', 'hidden absolute -top-3.5 left-0 z-30 select-none pointer-events-none');
    tag.style.fontFamily = 'ui-monospace,SFMono-Regular,monospace';
    div.append(tag);
    this.tags.set(el.id, tag);

    div.addEventListener('mouseenter', (e) => { if (!this.inspect) return; e.stopPropagation(); this.hovId=el.id; this.applyStyles(); this.renderUI(); });
    div.addEventListener('mouseleave', (e) => { if (!this.inspect) return; e.stopPropagation(); if(this.hovId===el.id) this.hovId=null; this.applyStyles(); this.renderUI(); });
    div.addEventListener('click', (e) => {
      if (!this.inspect) return;
      e.stopPropagation();
      // Don't close overlays or toggle selection if an overlay is open
      // (user might have just closed a menu by clicking the tree area)
      if (this.overlayBox.children.length > 0) {
        this.closeOverlays();
        return;
      }
      this.selId = this.selId === el.id ? null : el.id;
      this.applyStyles();
      this.renderUI();
    });
    div.addEventListener('contextmenu', (e) => {
      if (!this.inspect) return;
      e.preventDefault();
      e.stopPropagation();
      this.selId = el.id;
      this.closeOverlays();
      this.applyStyles();
      this.renderUI();
      // Show menu LAST, after all other updates
      const live = findEl(this.tree, el.id) || el;
      this.showMenu(e.clientX, e.clientY, live);
    });

    if (el.text) { const sp = ce('span'); sp.textContent = el.text; div.append(sp); }
    el.children?.forEach(c => div.append(this.mkNode(c)));
    return div;
  }

  private applyStyles() {
    for (const [id, div] of this.nodes) {
      const isS = this.selId===id, isH = this.hovId===id;
      div.style.cursor = this.inspect ? 'crosshair' : '';
      div.style.outline = isS ? '1px solid #10b981' : isH ? '1px dashed #06b6d4' : '';
      div.style.outlineOffset = isS ? '1px' : '0';
      div.style.boxShadow = isS ? '0 0 0 4px rgba(16,185,129,0.15),inset 0 0 0 9999px rgba(16,185,129,0.04)' : isH ? 'inset 0 0 0 9999px rgba(6,182,212,0.06)' : '';
      div.style.zIndex = isS ? '20' : isH ? '10' : '';
      div.style.borderRadius = (isS||isH) ? '4px' : '';
      const tag = this.tags.get(id)!;
      const el = findEl(this.tree, id);
      if (!el) { tag.className = 'hidden'; continue; }
      if (isS) {
        tag.className = 'absolute -top-3.5 left-0 z-30 select-none pointer-events-none flex items-center gap-1 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white text-[10px] font-medium leading-none pl-1.5 pr-2 py-1 rounded-md shadow-lg shadow-emerald-500/30';
        tag.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-white/70"></span>&lt;${esc(el.label)} /&gt;<span class="text-emerald-200 ml-0.5 font-normal">${esc(el.file.split('/').pop()||'')}</span>`;
      } else { tag.className = 'hidden'; tag.innerHTML = ''; }
    }
  }

  private renderUI() {
    this.barEl.innerHTML = '';
    const bar = ce('div','flex flex-wrap items-center justify-between gap-3');
    const left = ce('div','flex items-center gap-2 flex-wrap');
    const ib = ce('button', `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${this.inspect?'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25':'bg-slate-100 text-slate-600 hover:bg-slate-200'}`);
    ib.textContent = this.inspect ? '🔍 审查模式已开启' : '🔍 开启审查模式';
    ib.onclick = () => { this.inspect=!this.inspect; if(!this.inspect){this.hovId=null;this.selId=null;} this.closeOverlays(); this.applyStyles(); this.renderUI(); };
    left.append(ib);
    if(this.selId){const cb=ce('button','flex items-center gap-1 px-3 py-2 rounded-lg text-sm bg-red-50 text-red-600 hover:bg-red-100');cb.textContent='✕ 取消选中';cb.onclick=()=>{this.selId=null;this.hovId=null;this.closeOverlays();this.applyStyles();this.renderUI();};left.append(cb);}
    if(JSON.stringify(this.tree)!==JSON.stringify(clone(this.initTree))){const rb=ce('button','flex items-center gap-1 px-3 py-2 rounded-lg text-sm bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-200');rb.textContent='↺ 重置';rb.onclick=()=>{_uid=100;this.tree=clone(this.initTree);this.selId=null;this.hovId=null;this.closeOverlays();this.rebuildTree();};left.append(rb);}
    bar.append(left);
    if(this.inspect){const h=ce('span','text-xs '+(this.selId?'text-emerald-600 font-medium':'text-slate-400'));h.textContent=this.selId?'已选中 — 右键编辑属性、添加组件或删除':'移动鼠标查看信息，左键选中，右键弹出菜单';bar.append(h);}
    this.barEl.append(bar);

    this.infoEl.innerHTML = '';
    const active = this.selId ? findEl(this.tree,this.selId) : (this.hovId ? findEl(this.tree,this.hovId) : null);
    if (active && this.inspect) {
      const sel = !!this.selId;
      const w = ce('div', `mt-4 rounded-xl overflow-hidden border ${sel?'border-emerald-400 bg-emerald-50/60 shadow-lg shadow-emerald-100':'border-slate-200 bg-white shadow-sm'}`);
      const hd = ce('div', `flex items-center justify-between px-4 py-2.5 text-xs font-medium ${sel?'bg-emerald-100 text-emerald-700':'bg-slate-50 text-slate-500'}`);
      hd.innerHTML = sel ? `✅ 已选中 <span class="font-mono text-emerald-500 ml-auto">${esc(active.file)}:${active.line}:${active.col}</span>` : '👆 悬停预览';
      w.append(hd);
      const bd = ce('div','p-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2');
      const r = (l:string,v:string,c='text-slate-700') => `<div class="flex items-center gap-2"><span class="text-xs text-slate-400 w-20 flex-shrink-0">${l}</span><code class="text-xs font-mono ${c} bg-slate-50 px-2 py-0.5 rounded">${esc(v)}</code></div>`;
      bd.innerHTML = r('组件:',`<${active.label} />`,'text-emerald-600 font-semibold') + r('标签:',`<${active.tag}>`,'text-blue-600') + r('文件:',active.file) + r('node.loc:',`L${active.line}:C${active.col}`) + r('NodeType:',active.nodeType,'text-purple-600') + r('ElementType:',active.elementType,'text-indigo-600');
      if(active.props&&Object.keys(active.props).length){let ph=`<div class="sm:col-span-2 mt-2 pt-3 border-t border-slate-200"><div class="flex items-center gap-2 mb-2"><span class="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Props</span><span class="text-[10px] bg-blue-50 text-blue-500 px-1.5 py-0.5 rounded-full font-medium">${Object.keys(active.props).length}</span></div><div class="flex flex-wrap gap-1.5">`;for(const [k,v] of Object.entries(active.props)) ph+=`<span class="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-50 border border-slate-100 rounded-md text-[11px] font-mono"><span class="text-blue-600 font-semibold">${esc(k)}</span><span class="text-slate-300">=</span><span class="text-amber-600">"${esc(v)}"</span></span>`;ph+='</div></div>';bd.innerHTML+=ph;}
      w.append(bd); this.infoEl.append(w);
    }
  }

  private showMenu(x: number, y: number, el: El) {
    this.overlayBox.innerHTML = '';
    const mx = Math.min(x,innerWidth-240), my = Math.min(y,innerHeight-260);
    const cm = ce('div','ctx-menu fixed z-[9999] min-w-[220px] py-1.5 bg-white rounded-xl border border-slate-200 shadow-xl animate-in');
    cm.style.left=mx+'px'; cm.style.top=my+'px';
    cm.innerHTML = `<div class="px-3 py-2 border-b border-slate-100"><p class="text-xs font-semibold text-slate-700">&lt;${esc(el.label)} /&gt;</p><p class="text-[10px] text-slate-400 font-mono mt-0.5">${esc(el.file)}:${el.line}:${el.col}</p></div>`;
    const acts = ce('div','py-1');
    const mb = (lbl:string,cb:()=>void,d=false)=>{const b=ce('button',`w-full flex items-center gap-2 px-3 py-2 text-xs text-left ${d?'text-red-600 hover:bg-red-50':'text-slate-600 hover:bg-slate-50 hover:text-slate-800'}`);b.textContent=lbl;b.onclick=cb;return b;};
    const pc=Object.keys(el.props||{}).length;
    acts.append(mb(`⚙️ 编辑属性${pc?` (${pc})`:''}`,()=>this.showPropsPanel(el)));
    acts.append(mb('➕ 添加子组件',()=>this.showAddPanel(el)));
    acts.append(mb('📋 复制路径',()=>{navigator.clipboard.writeText(`${el.file}:${el.line}:${el.col}`);this.toast('已复制到剪贴板');}));
    cm.append(acts);
    const dng = ce('div','border-t border-slate-100 py-1');
    dng.append(mb('🗑️ 删除元素',()=>{this.toast(`已删除 &lt;${esc(el.label)} /&gt;`,clone(this.tree));this.tree=removeEl(this.tree,el.id);this.selId=null;this.hovId=null;this.closeOverlays();this.rebuildTree();},true));
    cm.append(dng); this.overlayBox.append(cm);
  }

  private toastTimer=0;
  private toast(html:string,prev?:El[]){
    clearTimeout(this.toastTimer);
    this.prevEl.querySelectorAll('.demo-toast').forEach(e=>e.remove());
    const t=ce('div','demo-toast absolute bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2.5 bg-slate-800 text-white rounded-xl shadow-2xl text-xs animate-in whitespace-nowrap');
    const sp=ce('span');sp.innerHTML=html;t.append(sp);
    if(prev){const ub=ce('button','px-2 py-0.5 bg-white/10 hover:bg-white/20 rounded-md font-medium');ub.textContent='撤销';ub.onclick=()=>{this.tree=prev;this.closeOverlays();this.rebuildTree();};t.append(ub);}
    this.prevEl.append(t);
    this.toastTimer=window.setTimeout(()=>t.remove(),4000);
  }

  private closeOverlays(){this.overlayBox.innerHTML='';}

  private showPropsPanel(el:El){
    this.overlayBox.innerHTML='';
    const entries=Object.entries(el.props||{}).map(([k,v])=>[k,v] as [string,string]);
    const bd=ce('div','fixed inset-0 z-[9998] bg-black/20 backdrop-blur-sm');bd.onclick=()=>this.closeOverlays();
    const panel=ce('div','fixed right-0 top-0 bottom-0 z-[9999] w-full max-w-md bg-white shadow-2xl flex flex-col animate-slide-in');
    const hdr=ce('div','flex items-center justify-between px-5 py-4 border-b border-slate-100');
    hdr.innerHTML=`<div><h3 class="text-sm font-semibold text-slate-800">⚙️ 编辑属性</h3><p class="text-[11px] text-slate-400"><code class="bg-slate-100 px-1 rounded text-blue-600 font-mono">&lt;${esc(el.label)} /&gt;</code> · ${entries.length} 个属性</p></div>`;
    const xb=ce('button','p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 text-lg');xb.textContent='✕';xb.onclick=()=>this.closeOverlays();hdr.append(xb);panel.append(hdr);
    const list=ce('div','flex-1 overflow-y-auto px-5 py-4 space-y-2');
    const renderList=()=>{list.innerHTML='';entries.forEach(([k,v],i)=>{const row=ce('div','flex items-center gap-2 group');const ki=document.createElement('input');ki.className='flex-1 min-w-0 px-2.5 py-1.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400 text-blue-700 font-semibold';ki.value=k;const vi=document.createElement('input');vi.className='flex-[1.5] min-w-0 px-2.5 py-1.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400 text-slate-700';vi.value=v;ki.oninput=()=>{entries[i][0]=ki.value;};vi.oninput=()=>{entries[i][1]=vi.value;};const rm=ce('button','p-1 rounded-md text-slate-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 flex-shrink-0');rm.textContent='−';rm.onclick=()=>{entries.splice(i,1);renderList();};const eq=ce('span','text-slate-300 text-xs');eq.textContent='=';row.append(ki,eq,vi,rm);list.append(row);});const addS=ce('div','pt-3 mt-3 border-t border-dashed border-slate-200');addS.innerHTML='<p class="text-[10px] text-slate-400 font-medium mb-2">添加新属性</p>';const ar=ce('div','flex items-center gap-2');const nk=document.createElement('input');nk.className='flex-1 min-w-0 px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-400';nk.placeholder='属性名';const nv=document.createElement('input');nv.className='flex-[1.5] min-w-0 px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-400';nv.placeholder='值';const doAdd=()=>{if(!nk.value.trim())return;entries.push([nk.value.trim(),nv.value]);renderList();};nk.onkeydown=(e)=>{if(e.key==='Enter')doAdd();};nv.onkeydown=(e)=>{if(e.key==='Enter')doAdd();};const ab=ce('button','p-1.5 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 text-sm');ab.textContent='＋';ab.onclick=doAdd;const eq2=ce('span','text-slate-300 text-xs');eq2.textContent='=';ar.append(nk,eq2,nv,ab);addS.append(ar);list.append(addS);};
    renderList(); panel.append(list);
    const foot=ce('div','flex-shrink-0 border-t border-slate-100 px-5 py-3 flex items-center justify-between');foot.innerHTML='<p class="text-[10px] text-slate-400">修改后点击保存</p>';
    const sv=ce('button','px-4 py-2 rounded-lg text-xs font-medium bg-blue-500 text-white hover:bg-blue-600 shadow-md');sv.textContent='💾 保存属性';
    sv.onclick=()=>{const p:Record<string,string>={};entries.forEach(([kk,vv])=>{if(kk.trim())p[kk.trim()]=vv;});this.tree=setProps(this.tree,el.id,p);this.toast('属性已保存');this.closeOverlays();this.applyStyles();this.renderUI();};
    foot.append(sv);panel.append(foot);this.overlayBox.append(bd,panel);
  }

  private showAddPanel(parent:El){
    this.overlayBox.innerHTML='';
    const bd=ce('div','fixed inset-0 z-[9998] bg-black/20 backdrop-blur-sm');bd.onclick=()=>this.closeOverlays();
    const panel=ce('div','fixed right-0 top-0 bottom-0 z-[9999] w-full max-w-md bg-white shadow-2xl flex flex-col animate-slide-in');
    const hdr=ce('div','flex items-center justify-between px-5 py-4 border-b border-slate-100');
    hdr.innerHTML=`<div><h3 class="text-sm font-semibold text-slate-800">➕ 添加组件</h3><p class="text-[11px] text-slate-400">添加到 <code class="bg-slate-100 px-1 rounded text-emerald-600 font-mono">&lt;${esc(parent.label)} /&gt;</code></p></div>`;
    const xb=ce('button','p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 text-lg');xb.textContent='✕';xb.onclick=()=>this.closeOverlays();hdr.append(xb);panel.append(hdr);
    const list=ce('div','flex-1 overflow-y-auto px-5 py-3 space-y-2');
    CAT.forEach(item=>{const btn=ce('button','w-full flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/50 transition-all text-left group');btn.innerHTML=`<div class="w-10 h-10 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-lg flex-shrink-0 group-hover:bg-emerald-50">${item.icon}</div><div class="flex-1 min-w-0"><div class="flex items-center gap-2"><span class="text-xs font-semibold text-slate-700 group-hover:text-emerald-700">&lt;${esc(item.label)} /&gt;</span><span class="text-[10px] px-1.5 py-0.5 rounded-full font-medium ${item.elementType==='COMPONENT'?'bg-violet-50 text-violet-500':'bg-blue-50 text-blue-500'}">${item.elementType}</span></div><p class="text-[11px] text-slate-400 font-mono mt-0.5 truncate">${esc(item.file)}</p></div><div class="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 group-hover:border-emerald-300 group-hover:text-emerald-500 text-sm">+</div>`;
    btn.onclick=()=>{const cc=parent.children?.length??0;const node:El={id:`d${_uid++}`,tag:item.tag,file:item.file,line:parent.line+cc+1,col:parent.col+2,label:item.label,cls:'demo-card',nodeType:'ELEMENT (1)',elementType:item.elementType,text:`${item.icon} ${item.label}`,props:item.defaultProps?{...item.defaultProps}:{}};this.toast(`已添加 &lt;${esc(item.label)} /&gt;`,clone(this.tree));this.tree=addChild(this.tree,parent.id,node);this.closeOverlays();this.rebuildTree();};list.append(btn);});
    panel.append(list);this.overlayBox.append(bd,panel);
  }
}
