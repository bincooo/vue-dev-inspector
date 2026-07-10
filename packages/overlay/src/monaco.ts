/**
 * Monaco 编辑器的 CDN 运行时加载器。
 *
 * 为什么不打包进 IIFE：overlay 产物是 vite-plugin-singlefile 的单文件 IIFE，
 * 会被 core 注入到任意 dev 页面；Monaco 全量包 ~5MB 且用 `new Worker(new URL)`
 * 起 web worker，与单文件 IIFE 不兼容。改为运行时从 jsDelivr CDN 加载，体积
 * 与 worker URL 问题一并绕开，与本仓原有 highlight.js CDN loader 模式一致。
 *
 * 加载链路（幂等，缓存到 monacoPromise）：
 *   1. injectOnce 注入 AMD `loader.js` -> 注册 window.require / window.define。
 *   2. 一次性 require.config({ paths: { vs: VS_BASE } })。
 *   3. 在 require main 之前设 window.MonacoEnvironment.getWorkerUrl：返回同源
 *      blob URL，blob 内容 `importScripts('<VS_BASE>/base/worker/workerMain.js')`。
 *      `new Worker(blobUrl)` 是同源不抛 SecurityError；importScripts 可跨域
 *      拉 CDN 的 workerMain.js（jsDelivr 带 CORS 头）。不加这一步，Monaco 语言
 *      服务会尝试 `new Worker(crossOriginUrl)` 抛 SecurityError。
 *   4. require(['vs/editor/editor.main'], cb) 等核心模块就绪。
 *   5. 取 window.monaco，setTheme('vs')，返回。
 *
 * 类型：仅声明我们用到的 Monaco API 子集（结构化接口），不引入 5MB 的
 * monaco-editor devDep，避免误打包进 IIFE。
 */
import { injectOnce } from "./cdn";

/** Monaco 版本（jsDelivr 已验证可达；如需升级改这一处即可）。 */
const MONACO_VERSION = "0.52.2";
/** AMD loader 入口。 */
const LOADER_URL = `https://cdn.jsdelivr.net/npm/monaco-editor@${MONACO_VERSION}/min/vs/loader.js`;
/** AMD 模块基址（require.config 的 vs 路径 + worker importScripts 共用）。 */
const VS_BASE = `https://cdn.jsdelivr.net/npm/monaco-editor@${MONACO_VERSION}/min/vs`;

/** AMD require 的最小类型（loader.js 注册到 window.require）。 */
interface AmdRequire {
  config(opts: { paths: Record<string, string> }): void;
  (deps: string[], cb: () => void): void;
}

/** Monaco 编辑器实例（仅声明用到的子集）。 */
export interface MonacoEditor {
  getValue(): string;
  setValue(value: string): void;
  dispose(): void;
  layout(): void;
}

/** Monaco 文本模型（仅声明用到的子集）。 */
export interface MonacoModel {
  dispose(): void;
  /** 设置模型级选项；tabSize 在 Monaco 中属模型选项而非编辑器选项。 */
  updateOptions(opts: { tabSize: number }): void;
}

/** monaco.editor.create 的构造选项（仅声明用到的子集）。 */
export interface MonacoEditorOptions {
  model: MonacoModel;
  automaticLayout: boolean;
  theme: string;
  fontSize: number;
  minimap: { enabled: boolean };
  scrollBeyondLastLine: boolean;
  fontFamily: string;
}

/** Monaco 命名空间（仅声明用到的子集）。 */
export interface MonacoAPI {
  editor: {
    create(container: HTMLElement, options: MonacoEditorOptions): MonacoEditor;
    createModel(value: string, language: string): MonacoModel;
    setTheme(theme: string): void;
  };
}

/** editor.main 加载超时兜底（AMD cb 在网络失败时不会 reject）。 */
const LOAD_TIMEOUT_MS = 30000;

/** 缓存的 monaco 加载 Promise；失败后清空以支持下次重试。 */
let monacoPromise: Promise<MonacoAPI> | null = null;
/** require.config 只配一次。 */
let configured = false;
/** 同源 worker blob URL（缓存避免反复 createObjectURL）。 */
let workerBlobUrl: string | null = null;

/** 取（必要时创建）同源 worker blob URL，绕开跨域 Worker。 */
function getWorkerUrl(): string {
  if (!workerBlobUrl) {
    const blob = new Blob(
      [`importScripts('${VS_BASE}/base/worker/workerMain.js');`],
      { type: "application/javascript" },
    );
    workerBlobUrl = URL.createObjectURL(blob);
  }
  return workerBlobUrl;
}

/** 实际加载逻辑（见文件头注释的 5 步链路）。 */
async function doLoadMonaco(): Promise<MonacoAPI> {
  // 1. 注入 AMD loader.js -> window.require / window.define 就绪
  await injectOnce("script", { src: LOADER_URL });
  const amdRequire = (window as unknown as { require: AmdRequire }).require;

  // 2. 一次性配置 vs 路径
  if (!configured) {
    amdRequire.config({ paths: { vs: VS_BASE } });
    configured = true;
  }

  // 3. 跨域 worker 兜底（必须在 require main 之前）
  (window as unknown as {
    MonacoEnvironment?: { getWorkerUrl: () => string };
  }).MonacoEnvironment = { getWorkerUrl };

  // 4. 加载 editor.main（AMD cb 仅成功触发；网络失败由超时兜底 reject）
  await new Promise<void>((resolve, reject) => {
    let done = false;
    try {
      amdRequire(["vs/editor/editor.main"], () => {
        done = true;
        resolve();
      });
    } catch (e) {
      reject(e);
      return;
    }
    setTimeout(() => {
      if (!done) reject(new Error("Monaco editor.main 加载超时（检查网络）"));
    }, LOAD_TIMEOUT_MS);
  });

  // 5. 取 monaco 全局并设浅色主题
  const monaco = (window as unknown as { monaco?: MonacoAPI }).monaco;
  if (!monaco) throw new Error("Monaco 加载失败：window.monaco 缺失");
  monaco.editor.setTheme("vs");
  return monaco;
}

/**
 * 幂等加载 Monaco。重复调用复用同一 Promise；失败后清空缓存以支持重试。
 */
export function loadMonaco(): Promise<MonacoAPI> {
  if (monacoPromise) return monacoPromise;
  const p = doLoadMonaco();
  monacoPromise = p;
  // 失败后清空缓存，下次打开抽屉可重试（网络恢复场景）
  p.catch(() => {
    if (monacoPromise === p) monacoPromise = null;
  });
  return p;
}

/**
 * 把块的 kind 映射到 Monaco 语言 id。
 * script -> typescript（SFC <script setup lang="ts"> 默认；TS 高亮兼容 JS）
 * style  -> css
 * childtext（子节点源码，HTML/Vue 模板片段）-> html
 */
export function monacoLanguageFor(
  kind: "script" | "style" | "childtext",
): string {
  if (kind === "script") return "typescript";
  if (kind === "style") return "css";
  return "html";
}
