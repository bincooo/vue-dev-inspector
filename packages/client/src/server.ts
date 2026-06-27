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
  projectRoot: string,
  body: RouteBody,
  res: MiddlewareResponse,
) => void;

/** 仅暴露路由需要的事件订阅能力的最小请求类型。 */
type RouteRequest = Pick<IncomingMessage, "on" | "url" | "method">;

// ─── Helpers ────────────────────────────────────────────

function parseBody(req: RouteRequest): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (c: Buffer) => {
      body += c.toString();
    });
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
  const value = body[key];
  return typeof value === "string" ? value : fallback;
}

/** 从请求体中读取数字字段。 */
function readNumber(body: RouteBody, key: string, fallback = 0): number {
  const value = body[key];
  return typeof value === "number" ? value : fallback;
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

/** 解析文件路径并校验安全边界 */
function safePath(projectRoot: string, file: string): string | null {
  const fp = path.resolve(projectRoot, file);
  return fp.startsWith(projectRoot) ? fp : null;
}

// ─── Route handlers ────────────────────────────────────

function handleGetProps(
  projectRoot: string,
  body: RouteBody,
  res: MiddlewareResponse,
): void {
  const fp = safePath(projectRoot, readString(body, "file"));
  if (!fp) {
    json(res, 403, { error: "Forbidden" });
    return;
  }
  const source = fs.readFileSync(fp, "utf-8");
  const result = getElementProps(
    source,
    readString(body, "file"),
    readNumber(body, "line"),
    readNumber(body, "col"),
  );
  if (result) {
    json(res, 200, result);
  } else {
    json(res, 404, { error: "Element not found" });
  }
}

function handleUpdateProps(
  projectRoot: string,
  body: RouteBody,
  res: MiddlewareResponse,
): void {
  const fp = safePath(projectRoot, readString(body, "file"));
  if (!fp) {
    json(res, 403, { error: "Forbidden" });
    return;
  }
  const source = fs.readFileSync(fp, "utf-8");
  const props = readPropEntries(body.props);
  const result = editElementProps(
    source,
    readString(body, "file"),
    readNumber(body, "line"),
    readNumber(body, "col"),
    props,
  );
  fs.writeFileSync(fp, result, "utf-8");
  json(res, 200, { success: true });
}

function handleDeleteElement(
  projectRoot: string,
  body: RouteBody,
  res: MiddlewareResponse,
): void {
  const fp = safePath(projectRoot, readString(body, "file"));
  if (!fp) {
    json(res, 403, { error: "Forbidden" });
    return;
  }
  const source = fs.readFileSync(fp, "utf-8");
  const result = deleteElement(
    source,
    readString(body, "file"),
    readNumber(body, "line"),
    readNumber(body, "col"),
  );
  if (result === source) {
    json(res, 404, { error: "Element not found" });
    return;
  }
  fs.writeFileSync(fp, result, "utf-8");
  json(res, 200, { success: true });
}

/**
 * 用 shell 指令在编辑器中打开源码文件并定位到具体行。
 * 不同编辑器用不同的命令行打开方式：
 *   vscode:  code -g file:line
 *   webstorm: webstorm file:line
 *   Others fall back to the editor protocol URL via `open`/`xdg-open`/`start`.
 */
/**
 * 扫描 projectRoot 下所有 .vue 文件（排除 node_modules），返回相对路径列表。
 * 供组件面板渲染目录树。
 */
function handleListComponents(
  projectRoot: string,
  _body: RouteBody,
  res: MiddlewareResponse,
): void {
  const result: { path: string; name: string }[] = [];
  const EXCLUDE = /(node_modules|dist|\.vite)/;
  function walk(dir: string): void {
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
        walk(full);
      } else if (ent.isFile() && ent.name.endsWith(".vue")) {
        result.push({
          path: path.relative(projectRoot, full).replace(/\\/g, "/"),
          name: ent.name,
        });
      }
    }
  }
  walk(projectRoot);
  result.sort((a, b) => a.path.localeCompare(b.path));
  json(res, 200, { components: result });
}

/** 把组件插入到 (line,col) 指定的元素位置，direction 决定语义 */
function handleInsertComponent(
  projectRoot: string,
  body: RouteBody,
  res: MiddlewareResponse,
): void {
  const fp = safePath(projectRoot, readString(body, "file"));
  if (!fp) {
    json(res, 403, { error: "Forbidden" });
    return;
  }
  const source = fs.readFileSync(fp, "utf-8");
  const tag = readString(body, "componentTag") || readString(body, "tag");
  const rawDirection = readString(body, "direction");
  const direction: "before" | "after" | "inside" =
    rawDirection === "before" || rawDirection === "after"
      ? rawDirection
      : "inside";
  const result = insertComponent(
    source,
    readString(body, "file"),
    readNumber(body, "line"),
    readNumber(body, "col"),
    tag,
    direction,
  );
  if (result === null) {
    json(res, 404, { error: "Target element not found" });
    return;
  }
  fs.writeFileSync(fp, result, "utf-8");
  json(res, 200, { success: true });
}

function handleDuplicateElement(
  projectRoot: string,
  body: RouteBody,
  res: MiddlewareResponse,
): void {
  const fp = safePath(projectRoot, readString(body, "file"));
  if (!fp) {
    json(res, 403, { error: "Forbidden" });
    return;
  }
  const source = fs.readFileSync(fp, "utf-8");
  const result = duplicateElement(
    source,
    readString(body, "file"),
    readNumber(body, "line"),
    readNumber(body, "col"),
  );
  if (result === null) {
    json(res, 404, { error: "Element not found" });
    return;
  }
  fs.writeFileSync(fp, result, "utf-8");
  json(res, 200, { success: true });
}

/**
 * 把 (source.line, source.col) 元素移动到 (target.line, target.col) 处。
 * direction 决定插入语义（before/inside/after）。
 * v1 限定同文件，跨文件返回 400。
 */
function handleMoveElement(
  projectRoot: string,
  body: RouteBody,
  res: MiddlewareResponse,
): void {
  const sourceFile = readString(body, "file");
  const target = body.target as
    | { file: string; line: number; col: number }
    | undefined;
  if (!target) {
    json(res, 400, { error: "Missing target" });
    return;
  }
  if (target.file !== sourceFile) {
    json(res, 400, { error: "Cross-file move not supported in v1" });
    return;
  }
  const fp = safePath(projectRoot, sourceFile);
  if (!fp) {
    json(res, 403, { error: "Forbidden" });
    return;
  }
  const rawDirection = readString(body, "direction");
  const direction: MoveDirection =
    rawDirection === "before" ||
    rawDirection === "inside" ||
    rawDirection === "after"
      ? rawDirection
      : "inside";
  const sourceLine = readNumber(body, "line");
  const sourceCol = readNumber(body, "col");
  const sourceCode = fs.readFileSync(fp, "utf-8");
  const result = moveElement(
    sourceCode,
    sourceFile,
    sourceLine,
    sourceCol,
    target.line,
    target.col,
    direction,
  );
  if (result === null) {
    json(res, 400, {
      error:
        "Move rejected (source/target not found, or target is descendant of source)",
    });
    return;
  }
  fs.writeFileSync(fp, result, "utf-8");
  json(res, 200, { success: true });
}

function handleOpenInEditor(
  projectRoot: string,
  body: RouteBody,
  res: MiddlewareResponse,
): void {
  const fp = safePath(projectRoot, readString(body, "file"));
  if (!fp) {
    json(res, 403, { error: "Forbidden" });
    return;
  }
  const line = readNumber(body, "line", 1) || 1;
  const col = readNumber(body, "col", 1) || 1;
  const editor = readString(body, "editor", "vscode");
  const lineArg = `${line}:${col}`;

  let cmd: string;
  switch (editor) {
    case "vscode":
      cmd = `code -g "${fp}:${lineArg}"`;
      break;
    case "webstorm":
    case "idea":
      cmd = `webstorm "${fp}:${line}"`;
      break;
    case "atom":
      cmd = `atom "${fp}:${line}:${col}"`;
      break;
    case "sublime":
      cmd = `subl "${fp}:${line}:${col}"`;
      break;
    default: {
      // 回退：用编辑器 URL protocol 走系统默认 handler
      const proto = EDITOR_PROTOCOLS[editor] ?? EDITOR_PROTOCOLS.vscode;
      const url = `${proto}${fp}:${line}:${col}`;
      cmd =
        process.platform === "win32"
          ? `start "" "${url}"`
          : process.platform === "darwin"
            ? `open "${url}"`
            : `xdg-open "${url}"`;
    }
  }

  exec(cmd, (err) => {
    if (err) {
      json(res, 500, { error: err.message });
      return;
    }
    json(res, 200, { success: true });
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
 * 统一处理所有 /__dev-inspector-api__/* 请求
 */
export function createDevServer(
  server: ViteDevServer,
  projectRoot: string,
): void {
  server.middlewares.use(async (req, res, next) => {
    const url = req.url || "";
    if (!url.startsWith(API_PREFIX + "/")) return next();

    const pathname = url.split("?")[0].replace(API_PREFIX, "");
    const route = ROUTES[pathname];
    const handler = route?.[req.method || ""];

    // CORS preflight
    if (req.method === "OPTIONS") {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      res.writeHead(204);
      res.end();
      return;
    }

    if (!handler) return next();

    try {
      const body = await parseBody(req);
      handler(projectRoot, body as RouteBody, res);
    } catch (err: unknown) {
      json(res, 500, {
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  });
}
