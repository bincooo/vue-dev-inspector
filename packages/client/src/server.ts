import type { ViteDevServer } from "vite";
import type { IncomingMessage, ServerResponse } from "node:http";
import fs from "node:fs";
import path from "node:path";
import { exec } from "node:child_process";
import {
  getElementProps,
  editElementProps,
  insertComponent,
  duplicateElement,
  deleteElement,
  moveElement,
  type MoveDirection,
  type PropEntry,
} from "./editor";
import { API_PREFIX, EDITOR_PROTOCOLS } from "@vue-dev-inspector/shared";

// ─── Types ────────────────────────────────────────────────

/** HTTP 请求体解析后的形态（服务端内部使用的是 JSON 字符串）。 */
type RouteBody = Record<string, unknown>;

/** Vite 暴露的 Node HTTP 响应对象在中间件中需要的能力。 */
type MiddlewareResponse = Pick<
  ServerResponse,
  "setHeader" | "writeHead" | "end"
>;

/** 单个路由处理函数。 */
type RouteHandler = (
  projectRoots: string[],
  body: RouteBody,
  res: MiddlewareResponse,
) => void;

/** 仅暴露路由需要的事件订阅能力的最小请求类型。 */
type RouteRequest = Pick<IncomingMessage, "on" | "url" | "method">;

// ─── Helpers ────────────────────────────────────────────

function parseBody(req: RouteRequest): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (c: Buffer) => (body += c.toString()));
    req.on("end", () => {
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

/** 解析失败/拒绝统一 JSON 响应（含 CORS 头）。 */
function json(
  res: MiddlewareResponse,
  status: number,
  data: unknown,
): void {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.writeHead(status);
  res.end(JSON.stringify(data));
}

/** 从请求体中读取字符串字段。 */
function readString(body: RouteBody, key: string, fallback = ""): string {
  return typeof body[key] === "string" ? (body[key] as string) : fallback;
}

/** 从请求体中读取数字字段。 */
function readNumber(body: RouteBody, key: string, fallback = 0): number {
  return typeof body[key] === "number" ? (body[key] as number) : fallback;
}

/** 把请求体中的 props 字段规整成 PropEntry[]。字段缺失或非数组时返回空数组。 */
function readPropEntries(value: unknown): PropEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (entry): entry is PropEntry =>
        typeof entry === "object" &&
        entry !== null &&
        typeof (entry as PropEntry).key === "string" &&
        typeof (entry as PropEntry).value === "string",
    )
    .map((entry) => ({ key: entry.key, value: entry.value }));
}

/**
 * 单个文件路由的常见前置：解析 `rN:file:line:col` → 加载源码 → 失败统一 JSON 响应。
 *
 * - 任何不符合 `rN:file:line:col` 格式 → 400
 * - rootIndex 越界 → 400
 * - 文件越出对应根 → 403
 * - 成功返回 `{ file, source, absolutePath, rootIndex }`，file 已剥离 `rN:` 前缀
 */
function resolveSource(
  projectRoots: string[],
  body: RouteBody,
  res: MiddlewareResponse,
): { file: string; source: string; absolutePath: string; rootIndex: number } | null {
  const raw = readString(body, "file");
  const parsed = parseSource(raw);
  if (!parsed) {
    json(res, 400, {
      error: "Invalid source format; expected r<N>:<path>:<line>:<col>",
    });
    return null;
  }
  if (parsed.rootIndex < 0 || parsed.rootIndex >= projectRoots.length) {
    json(res, 400, { error: "Unknown root index" });
    return null;
  }
  const resolved = safePath(projectRoots, {
    rootIndex: parsed.rootIndex,
    file: parsed.file,
  });
  if (!resolved) {
    json(res, 403, { error: "Forbidden" });
    return null;
  }
  const source = fs.readFileSync(resolved.absolutePath, "utf-8");
  return {
    file: parsed.file,
    source,
    absolutePath: resolved.absolutePath,
    rootIndex: parsed.rootIndex,
  };
}

/** 「限制到该枚举」的窄化 helper；落空回退到 default。 */
function enforceEnum<T extends string>(
  value: string,
  allowed: readonly T[],
  fallback: T,
): T {
  return (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

const INSERT_DIRECTIONS = ["inside", "before", "after"] as const;
const MOVE_DIRECTIONS = INSERT_DIRECTIONS;

// ─── Editor 路由 ────────────────────────────────────────

function handleGetProps(
  projectRoots: string[],
  body: RouteBody,
  res: MiddlewareResponse,
): void {
  const ctx = resolveSource(projectRoots, body, res);
  if (!ctx) return;
  const result = getElementProps(
    ctx.source,
    ctx.file,
    readNumber(body, "line"),
    readNumber(body, "col"),
  );
  json(res, result ? 200 : 404, result ?? { error: "Element not found" });
}

function handleUpdateProps(
  projectRoots: string[],
  body: RouteBody,
  res: MiddlewareResponse,
): void {
  const ctx = resolveSource(projectRoots, body, res);
  if (!ctx) return;
  const result = editElementProps(
    ctx.source,
    ctx.file,
    readNumber(body, "line"),
    readNumber(body, "col"),
    readPropEntries(body.props),
  );
  fs.writeFileSync(ctx.absolutePath, result, "utf-8");
  json(res, 200, { success: true });
}

function handleDeleteElement(
  projectRoots: string[],
  body: RouteBody,
  res: MiddlewareResponse,
): void {
  const ctx = resolveSource(projectRoots, body, res);
  if (!ctx) return;
  const result = deleteElement(
    ctx.source,
    ctx.file,
    readNumber(body, "line"),
    readNumber(body, "col"),
  );
  if (result === ctx.source) {
    json(res, 404, { error: "Element not found" });
    return;
  }
  fs.writeFileSync(ctx.absolutePath, result, "utf-8");
  json(res, 200, { success: true });
}

function handleDuplicateElement(
  projectRoots: string[],
  body: RouteBody,
  res: MiddlewareResponse,
): void {
  const ctx = resolveSource(projectRoots, body, res);
  if (!ctx) return;
  const result = duplicateElement(
    ctx.source,
    ctx.file,
    readNumber(body, "line"),
    readNumber(body, "col"),
  );
  if (result === null) {
    json(res, 404, { error: "Element not found" });
    return;
  }
  fs.writeFileSync(ctx.absolutePath, result, "utf-8");
  json(res, 200, { success: true });
}

function handleInsertComponent(
  projectRoots: string[],
  body: RouteBody,
  res: MiddlewareResponse,
): void {
  const ctx = resolveSource(projectRoots, body, res);
  if (!ctx) return;
  const tag = readString(body, "componentTag") || readString(body, "tag");
  const direction = enforceEnum(
    readString(body, "direction"),
    INSERT_DIRECTIONS,
    "inside",
  );
  const result = insertComponent(
    ctx.source,
    ctx.file,
    readNumber(body, "line"),
    readNumber(body, "col"),
    tag,
    direction,
  );
  if (result === null) {
    json(res, 404, { error: "Target element not found" });
    return;
  }
  fs.writeFileSync(ctx.absolutePath, result, "utf-8");
  json(res, 200, { success: true });
}

/** 移动（line,col）元素到（target.line,target.col）。v1 限定同文件，跨文件返回 400。 */
function handleMoveElement(
  projectRoots: string[],
  body: RouteBody,
  res: MiddlewareResponse,
): void {
  const target = body.target as
    | { file: string; line: number; col: number }
    | undefined;
  if (!target) return json(res, 400, { error: "Missing target" });

  const ctx = resolveSource(projectRoots, body, res);
  if (!ctx) return;

  /* target.file 客户端发来的是完整 `rN:<path>:<line>:<col>` 串（formatPosition），
   * 与 ctx.file（parseSource 已剥成纯路径段）字符串比较会一直 false，
   * 所以必须先 parseSource 再比对 file / rootIndex 段。 */
  const targetRef = parseSource(
    readString(target as unknown as RouteBody, "file"),
  );
  if (!targetRef) {
    json(res, 400, {
      error: "Invalid target source format; expected r<N>:<path>:<line>:<col>",
    });
    return;
  }
  if (targetRef.rootIndex !== ctx.rootIndex || targetRef.file !== ctx.file) {
    json(res, 400, { error: "Cross-file move not supported in v1" });
    return;
  }

  const direction = enforceEnum(
    readString(body, "direction"),
    MOVE_DIRECTIONS,
    "inside",
  ) as MoveDirection;

  const result = moveElement(
    ctx.source,
    ctx.file,
    readNumber(body, "line"),
    readNumber(body, "col"),
    targetRef.line,
    targetRef.col,
    direction,
  );
  if (result === null) {
    json(res, 400, {
      error:
        "Move rejected (source/target not found, or target is descendant of source)",
    });
    return;
  }
  fs.writeFileSync(ctx.absolutePath, result, "utf-8");
  json(res, 200, { success: true });
}

/** 扫描所有 projectRoot 下 .vue 文件（排除 node_modules|dist|.vite），去重后排序合并。 */
function handleListComponents(
  projectRoots: string[],
  _body: RouteBody,
  res: MiddlewareResponse,
): void {
  const seen = new Set<string>();
  const components: { path: string; name: string }[] = [];
  const EXCLUDE = /(node_modules|dist|\.vite)/;

  function walk(rootIndex: number, root: string, dir: string): void {
    let ents: fs.Dirent[];
    try {
      ents = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of ents) {
      if (EXCLUDE.test(ent.name)) continue;
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        walk(rootIndex, root, full);
      } else if (ent.isFile() && ent.name.endsWith(".vue")) {
        const rel = path
          .relative(root, full)
          .split(path.sep)
          .join("/");
        const key = `r${rootIndex}:${rel}`;
        if (seen.has(key)) continue;
        seen.add(key);
        components.push({ path: rel, name: ent.name });
      }
    }
  }
  for (let i = 0; i < projectRoots.length; i++) walk(i, projectRoots[i], projectRoots[i]);
  components.sort((a, b) => a.path.localeCompare(b.path));
  json(res, 200, { components });
}

// ─── Editor Open ─────────────────────────────────────────

/** 在 EDITOR_CLI 里走 shell 命令；不在则回退到 URL protocol。 */
const EDITOR_CLI: Record<
  string,
  (fp: string, line: number, col: number) => string
> = {
  vscode: (fp, line, col) => `code -g "${fp}:${line}:${col}"`,
  webstorm: (fp, line) => `webstorm "${fp}:${line}"`,
  idea: (fp, line) => `webstorm "${fp}:${line}"`,
  atom: (fp, line, col) => `atom "${fp}:${line}:${col}"`,
  sublime: (fp, line, col) => `subl "${fp}:${line}:${col}"`,
};

/** 用操作系统的 open/start/xdg-open 调起编辑器 URL protocol。 */
function protocolCmd(
  editor: string,
  fp: string,
  line: number,
  col: number,
): string {
  const proto = EDITOR_PROTOCOLS[editor] ?? EDITOR_PROTOCOLS.vscode;
  const url = `${proto}${fp}:${line}:${col}`;
  if (process.platform === "win32") return `start "" "${url}"`;
  if (process.platform === "darwin") return `open "${url}"`;
  return `xdg-open "${url}"`;
}

function handleOpenInEditor(
  projectRoots: string[],
  body: RouteBody,
  res: MiddlewareResponse,
): void {
  const ctx = resolveSource(projectRoots, body, res);
  if (!ctx) return;
  const line = readNumber(body, "line", 1) || 1;
  const col = readNumber(body, "col", 1) || 1;
  const editor = readString(body, "editor", "vscode");
  const cmd =
    EDITOR_CLI[editor]?.(ctx.absolutePath, line, col) ??
    protocolCmd(editor, ctx.absolutePath, line, col);

  exec(cmd, (err) => {
    if (err) json(res, 500, { error: err.message });
    else json(res, 200, { success: true });
  });
}

// ─── Server middleware ───────────────────────────────────

/** 路由表 */
const ROUTES: Record<string, Record<string, RouteHandler>> = {
  "/get-props": { POST: handleGetProps },
  "/update-props": { POST: handleUpdateProps },
  "/delete-element": { POST: handleDeleteElement },
  "/open-in-editor": { POST: handleOpenInEditor },
  "/list-components": { POST: handleListComponents },
  "/insert-component": { POST: handleInsertComponent },
  "/duplicate-element": { POST: handleDuplicateElement },
  "/move-element": { POST: handleMoveElement },
};

/**
 * 创建 DevInspector 服务端中间件
 * 统一处理所有 /__dev-inspector-api__/* 请求。
 *
 * `projectRoots` 为多根目录列表（monorepo 下跨子工程编辑的支持）；
 * 至少包含一个根路径。单根场景下使用 `[config.root]` 传入即可。
 */
export function createDevServer(
  server: ViteDevServer,
  projectRoots: string[],
): void {
  if (projectRoots.length === 0) {
    // 防御：空数组会让所有请求都返回 403；显式抛错避免静默失败
    throw new Error(
      "[vdi] createDevServer received empty projectRoots.",
    );
  }
  server.middlewares.use(async (req, res, next) => {
    const url = req.url || "";
    if (!url.startsWith(API_PREFIX + "/")) return next();

    // CORS preflight
    if (req.method === "OPTIONS") {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      res.writeHead(204);
      res.end();
      return;
    }

    const pathname = url.split("?")[0].replace(API_PREFIX, "");
    const handler = ROUTES[pathname]?.[req.method || ""];
    if (!handler) return next();

    try {
      const body = await parseBody(req);
      handler(projectRoots, body as RouteBody, res);
    } catch (err: unknown) {
      json(res, 500, {
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  });
}

/**
 * 解析 `rN:<relativePath>:<line>:<col>` 格式的 source 字符串。
 *
 * - N 为非负整数（0-based，对应 projectRoots 序号）。
 * - 任何不匹配（含旧无前缀格式、缺段、行/列非整数）一律返回 null。
 * - 拒绝绝对路径（file 不能以 `/` 或盘符开头，避免客户端越权写入）。
 */
const SOURCE_RE = /^r(\d+):([^:]+):(\d+):(\d+)$/;
export interface SourceRef {
  rootIndex: number;
  file: string;
  line: number;
  col: number;
}

export function parseSource(value: string): SourceRef | null {
  if (!value) return null;
  const m = SOURCE_RE.exec(value);
  if (!m) return null;
  const rootIndex = Number(m[1]);
  const file = m[2];
  const line = Number(m[3]);
  const col = Number(m[4]);
  if (path.isAbsolute(file)) return null;
  return { rootIndex, file, line, col };
}

/**
 * 解析客户端发来的 source 引用并校验安全边界 —— 多根精确版本。
 *
 * - 直接定位 `projectRoots[ctx.rootIndex]`，拒绝越界。
 * - 拒绝空 `file` 与绝对路径（防止客户端逃逸到注册根之外）。
 * - 校验 `path.resolve(root, file)` 落在对应根范围内。
 */
export function safePath(
  projectRoots: string[],
  ctx: { rootIndex: number; file: string },
): { root: string; absolutePath: string } | null {
  if (!ctx.file) return null;
  if (path.isAbsolute(ctx.file)) return null;
  const root = projectRoots[ctx.rootIndex];
  if (!root) return null;
  const candidate = path.resolve(root, ctx.file);
  const sep = root.endsWith(path.sep) ? "" : path.sep;
  if (candidate === root || candidate.startsWith(root + sep)) {
    return { root, absolutePath: candidate };
  }
  return null;
}