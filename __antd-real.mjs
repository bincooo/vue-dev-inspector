import { Window } from 'happy-dom'
const win = new Window()
const doc = win.document
for (const k of ['Element','HTMLElement','SVGElement','Text','Comment','Node','DocumentFragment','customElements','getComputedStyle','MutationObserver','ResizeObserver','IntersectionObserver']) {
  try { if (globalThis[k] === undefined) globalThis[k] = win[k] } catch {}
}
globalThis.window = win
globalThis.document = doc
Object.defineProperty(globalThis, 'navigator', { value: win.navigator, configurable: true })

const Vue = await import('vue')
const Antd = await import('/tmp/antd-bundle.mjs')

const { createApp, h, withDirectives } = Vue
const vDevInspector = {
  mounted: (el, b) => { const n = el.nodeType === 1 ? el : el.nextElementSibling; if (n) n.setAttribute('data-source-file', b.value) },
  updated: (el, b) => { const n = el.nodeType === 1 ? el : el.nextElementSibling; if (n) n.setAttribute('data-source-file', b.value) },
}

let fail = 0
const check = (n, c) => { console.log((c ? 'PASS: ' : 'FAIL: ') + n); if (!c) fail++ }

const mount = doc.createElement('div'); doc.body.appendChild(mount)
const app = createApp({
  setup() {
    return () => h('div', [
      withDirectives(h(Antd.DatePicker), [[vDevInspector, 'AntdTest.vue:36:7']]),
      withDirectives(h(Antd.Select, { options: [{ value: 'a', label: 'A' }] }), [[vDevInspector, 'AntdTest.vue:30:7']]),
    ])
  },
})
app.use(Antd)
app.mount(mount)

await new Promise(r => setTimeout(r, 60))

const dpRoot = mount.querySelector('.ant-picker')
check('DatePicker root .ant-picker 带 data-source-file', dpRoot && dpRoot.getAttribute('data-source-file') === 'AntdTest.vue:36:7')

const selRoot = mount.querySelector('.ant-select')
check('Select root .ant-select 带 data-source-file', selRoot && selRoot.getAttribute('data-source-file') === 'AntdTest.vue:30:7')

console.log('--- mounted HTML (first 2000 chars) ---')
console.log(mount.innerHTML.slice(0, 2000))
process.exit(fail ? 1 : 0)