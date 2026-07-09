/**
 * 组件 import 声明的纯解析与合并规划。
 *
 * 本模块只做「理解 import 语句 + 在 script 源码上规划编辑」，零第三方依赖
 * （不用 magic-string / @vue/compiler-sfc）：输入输出都是纯字符串与 offset。
 * SFC 读写与落盘由 editor.ts 的 `ensureImports` 编排，本模块只暴露 `planImports`。
 *
 * 手写扫描器（与 editor.ts 既有风格一致），跳过字符串 / 模板串 / 注释，
 * 识别静态 import（跳过 import() 与 import.meta），解析默认 / 命名空间 / 具名绑定。
 *
 * 合并策略（同模块）：
 *   - 具名导入缺失        -> 并入现有具名子句 `{ A, B }` 的 `}` 之前
 *   - 默认 / 命名空间缺失或无具名子句 -> 追加一条仅含缺失绑定的新语句
 *   - 模块未导入          -> 追加整条原始语句
 *   - 全部已存在          -> 跳过（幂等）
 */

/** 一条 import 语句解析后的绑定描述（与位置无关）。 */
export interface ImportBindings {
  /** 模块说明符，如 "antdv-next" / "vue" */
  module: string;
  /** 默认导入的本地名：`import X from 'm'` */
  defaultName?: string;
  /** 命名空间导入的本地名：`import * as X from 'm'` */
  namespaceName?: string;
  /** 具名导入：`{ A }` / `{ A as B }` */
  named: Array<{ imported: string; local: string }>;
}

/** 扫描 script 源码时定位到的一条 import（含源码区间）。 */
interface ScriptImport extends ImportBindings {
  /** `import` 关键字在 script content 中的起始 offset */
  start: number;
  /** 语句结束 offset（exclusive，含可选分号） */
  end: number;
  /** 具名子句 `}` 的 offset（用于在其前插入新具名）；无具名子句时 undefined */
  namedCloseBrace?: number;
}

/** 一条对 script 源码的原子编辑（offset 均相对 scriptContent）。 */
export interface ImportEdit {
  /** 插入点 offset */
  at: number;
  /** 可选：先移除 [removeStart, removeEnd) */
  remove?: [number, number];
  /** 插入文本 */
  insert: string;
}

// ─── 字符分类 ───────────────────────────────────────────────

const isIdentStart = (ch: string | undefined): boolean =>
  !!ch &&
  ((ch >= "a" && ch <= "z") ||
    (ch >= "A" && ch <= "Z") ||
    ch === "_" ||
    ch === "$");
const isIdentPart = (ch: string | undefined): boolean =>
  isIdentStart(ch) || (!!ch && ch >= "0" && ch <= "9");
const isWhitespace = (ch: string | undefined): boolean =>
  ch === " " || ch === "\t" || ch === "\n" || ch === "\r";

// ─── 跳过 trivia / 字符串 / 模板 ────────────────────────────

/** 从 i 起跳过空白与注释（含换行），返回下一个有效字符的 offset。 */
function skipTrivia(src: string, i: number): number {
  const n = src.length;
  while (i < n) {
    const ch = src[i];
    if (isWhitespace(ch)) {
      i++;
      continue;
    }
    if (ch === "/" && src[i + 1] === "/") {
      i += 2;
      while (i < n && src[i] !== "\n") i++;
      continue;
    }
    if (ch === "/" && src[i + 1] === "*") {
      i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    break;
  }
  return i;
}

/** 从 i 起跳过同行空格与制表符（不跨行），用于定位紧随的可选分号。 */
function skipInlineSpaces(src: string, i: number): number {
  const n = src.length;
  while (i < n && (src[i] === " " || src[i] === "\t")) i++;
  return i;
}

/** 从开引号 i 起跳过整段字符串字面量，返回闭引号之后的 offset。处理转义。 */
function skipString(src: string, i: number): number {
  const quote = src[i];
  const n = src.length;
  let j = i + 1;
  while (j < n) {
    const ch = src[j];
    if (ch === "\\") {
      j += 2;
      continue;
    }
    if (ch === quote) return j + 1;
    j++;
  }
  return j;
}

/** 从反引号 i 起跳过整段模板字面量，返回闭反引号之后的 offset。${...} 内部递归。 */
function skipTemplate(src: string, i: number): number {
  const n = src.length;
  let j = i + 1;
  while (j < n) {
    const ch = src[j];
    if (ch === "\\") {
      j += 2;
      continue;
    }
    if (ch === "`") return j + 1;
    if (ch === "$" && src[j + 1] === "{") {
      j = skipTemplateExpr(src, j + 2);
      continue;
    }
    j++;
  }
  return j;
}

/** 跳过 `${ ... }` 内部表达式，返回闭 `}` 之后的 offset（brace 深度匹配）。 */
function skipTemplateExpr(src: string, i: number): number {
  const n = src.length;
  let depth = 1;
  let j = i;
  while (j < n && depth > 0) {
    const ch = src[j];
    if (ch === "{") {
      depth++;
      j++;
      continue;
    }
    if (ch === "}") {
      depth--;
      j++;
      continue;
    }
    if (ch === '"' || ch === "'") {
      j = skipString(src, j);
      continue;
    }
    if (ch === "`") {
      j = skipTemplate(src, j);
      continue;
    }
    if (ch === "/" && src[j + 1] === "/") {
      j += 2;
      while (j < n && src[j] !== "\n") j++;
      continue;
    }
    if (ch === "/" && src[j + 1] === "*") {
      j += 2;
      while (j < n && !(src[j] === "*" && src[j + 1] === "/")) j++;
      j += 2;
      continue;
    }
    j++;
  }
  return j;
}

// ─── 读取 token ─────────────────────────────────────────────

/** 从 i 起读取一个标识符，返回 [名字, 之后 offset]。首字符非 ident 则返回 ["", i]。 */
function readIdent(src: string, i: number): [string, number] {
  const n = src.length;
  if (!isIdentStart(src[i])) return ["", i];
  let j = i;
  let out = "";
  while (j < n && isIdentPart(src[j])) {
    out += src[j];
    j++;
  }
  return [out, j];
}

/** 读取从 i 起的字符串字面量，返回 [内容, 闭引号之后 offset]。转义按字面取下一字符。 */
function readStringToken(src: string, i: number): [string, number] {
  const quote = src[i];
  const n = src.length;
  let j = i + 1;
  let out = "";
  while (j < n) {
    const ch = src[j];
    if (ch === "\\") {
      out += src[j + 1] ?? "";
      j += 2;
      continue;
    }
    if (ch === quote) return [out, j + 1];
    out += ch;
    j++;
  }
  return [out, j];
}

/** 若 i 起是 `as` 关键字（词边界），返回 [true, 跳过 as 之后 offset]；否则 [false, i]。 */
function consumeAs(src: string, i: number): [boolean, number] {
  if (src.startsWith("as", i) && !isIdentPart(src[i + 2])) return [true, i + 2];
  return [false, i];
}

// ─── 解析 import 子句 ───────────────────────────────────────

/**
 * 解析 import 子句（`import` 与 `from` 之间）的一个绑定项，写入 bindings。
 * 一个「项」是：命名空间 `* as ns` / 具名 `{ A, B as C }` / 默认 `X`。
 * onNamedClose 在遇到具名子句 `}` 时回调其 offset（供后续并入新具名）。
 * 返回该项之后的 offset。
 */
function parseOneBinding(
  src: string,
  i: number,
  bindings: ImportBindings,
  onNamedClose: (brace: number) => void,
): number {
  let p = skipTrivia(src, i);
  const ch = src[p];
  if (ch === "*") {
    // import * as Name
    p = skipTrivia(src, p + 1);
    const [gotAs, afterAs] = consumeAs(src, p);
    if (gotAs) p = skipTrivia(src, afterAs);
    const [name, after] = readIdent(src, p);
    bindings.namespaceName = name;
    return after;
  }
  if (ch === "{") {
    p++;
    for (;;) {
      p = skipTrivia(src, p);
      if (src[p] === "}") {
        onNamedClose(p);
        return p + 1;
      }
      const [imported, a1] = readIdent(src, p);
      let local = imported;
      let q = skipTrivia(src, a1);
      const [gotAs, afterAs] = consumeAs(src, q);
      if (gotAs) {
        q = skipTrivia(src, afterAs);
        const [alias, a2] = readIdent(src, q);
        local = alias;
        q = a2;
      }
      if (imported) bindings.named.push({ imported, local });
      p = skipTrivia(src, q);
      if (src[p] === ",") {
        p++;
        continue;
      }
      if (src[p] === "}") {
        onNamedClose(p);
        return p + 1;
      }
      return p; // 防御：未预期字符
    }
  }
  if (isIdentStart(ch)) {
    const [name, after] = readIdent(src, p);
    bindings.defaultName = name;
    return after;
  }
  return p;
}

/** 解析整段 import 子句（逗号分隔的多个绑定项），返回 `from` 之前的 offset。 */
function parseImportClause(
  src: string,
  i: number,
  bindings: ImportBindings,
  onNamedClose: (brace: number) => void,
): number {
  let p = parseOneBinding(src, i, bindings, onNamedClose);
  for (;;) {
    p = skipTrivia(src, p);
    if (src[p] !== ",") break;
    p++; // 跳过逗号
    p = parseOneBinding(src, p, bindings, onNamedClose);
  }
  return p;
}

/**
 * 从 `import` 关键字起解析一条静态 import 语句。
 * 返回 `{ imp, next }`；非静态 import（`import(` / `import.meta`）返回 null。
 * `import type { ... }` / `import type * as ns` 的 `type` 修饰符被吞掉按普通子句解析
 * （不单独追踪 type 语义；组件导入均为值导入，按名去重已足够）。
 */
function parseImportAt(
  src: string,
  start: number,
): { imp: ScriptImport; next: number } | null {
  let p = start + 6; // 跳过 "import"
  p = skipTrivia(src, p);
  // import(...) 动态导入 / import.meta -> 非静态
  if (src[p] === "(" || src[p] === ".") return null;
  // import type { ... } / import type * as ns
  if (src.startsWith("type", p) && !isIdentPart(src[p + 4])) {
    const afterType = skipTrivia(src, p + 4);
    if (src[afterType] === "{" || src[afterType] === "*") p = afterType;
  }

  const bindings: ImportBindings = { module: "", named: [] };
  let namedCloseBrace: number | undefined;

  if (src[p] === '"' || src[p] === "'") {
    // 副作用导入：import "mod"
    const [mod, after] = readStringToken(src, p);
    bindings.module = mod;
    p = after;
  } else {
    p = parseImportClause(src, p, bindings, (brace) => {
      namedCloseBrace = brace;
    });
    p = skipTrivia(src, p);
    if (!src.startsWith("from", p) || isIdentPart(src[p + 4])) return null;
    p += 4;
    p = skipTrivia(src, p);
    if (src[p] !== '"' && src[p] !== "'") return null;
    const [mod, after] = readStringToken(src, p);
    bindings.module = mod;
    p = after;
  }

  // 语句结束：仅消费同行紧随的可选分号（不跨行，避免吞下一语句的 ASI 分号）
  let end = p;
  const afterSpaces = skipInlineSpaces(src, p);
  if (src[afterSpaces] === ";") end = afterSpaces + 1;

  return {
    imp: { ...bindings, start, end, namedCloseBrace },
    next: end,
  };
}

// ─── 扫描 / 渲染 ────────────────────────────────────────────

/** 在 script 源码中扫描所有静态 import 语句（含源码区间）。 */
function scanScriptImports(src: string): ScriptImport[] {
  const out: ScriptImport[] = [];
  const n = src.length;
  let i = 0;
  while (i < n) {
    // 复用 skipTrivia 跳过空白与注释（避免与 parseImportAt 重复实现注释识别）
    const j = skipTrivia(src, i);
    if (j !== i) {
      i = j;
      continue;
    }
    const ch = src[i];
    if (ch === '"' || ch === "'") {
      i = skipString(src, i);
      continue;
    }
    if (ch === "`") {
      i = skipTemplate(src, i);
      continue;
    }
    if (
      ch === "i" &&
      src.startsWith("import", i) &&
      !isIdentPart(src[i + 6]) &&
      (i === 0 || (!isIdentPart(src[i - 1]) && src[i - 1] !== "."))
    ) {
      const r = parseImportAt(src, i);
      if (r) {
        out.push(r.imp);
        i = r.next;
        continue;
      }
    }
    i++;
  }
  return out;
}

/** 渲染单个具名绑定：`A` 或 `A as B`。 */
function renderBinding(b: { imported: string; local: string }): string {
  return b.imported === b.local ? b.imported : `${b.imported} as ${b.local}`;
}

/** 渲染一条 import 语句（仅含给定绑定）。无任何绑定时按副作用导入。 */
function renderImport(b: ImportBindings): string {
  const parts: string[] = [];
  if (b.defaultName) parts.push(b.defaultName);
  if (b.namespaceName) parts.push(`* as ${b.namespaceName}`);
  if (b.named.length) parts.push(`{ ${b.named.map(renderBinding).join(", ")} }`);
  if (parts.length === 0) return `import "${b.module}"`;
  return `import ${parts.join(", ")} from "${b.module}"`;
}

/** 规划「在 import 区追加一条语句」的编辑（offset 相对 scriptContent）。 */
function planAppend(
  content: string,
  lastEnd: number | null,
  stmt: string,
): ImportEdit {
  if (lastEnd !== null) {
    // 现有 import 之后另起一行
    return { at: lastEnd, insert: "\n" + stmt };
  }
  if (content.startsWith("\n")) {
    // 内容以换行开头：插在换行之后，让 import 独占 `<script ...>` 后的首行
    return { at: 1, insert: stmt + "\n" };
  }
  // 内容不以换行开头：前后补换行，避免与开标签或后续代码粘连
  return { at: 0, insert: "\n" + stmt + "\n" };
}

// ─── 公共接口 ───────────────────────────────────────────────

/** 解析一条 import 语句字符串（来自 ComponentItem.imports）。非法 / 非静态返回 null。 */
export function parseImportStatement(stmt: string): ImportBindings | null {
  const s = stmt.trimStart();
  if (!s.startsWith("import")) return null;
  const r = parseImportAt(s, 0);
  if (!r) return null;
  return {
    module: r.imp.module,
    defaultName: r.imp.defaultName,
    namespaceName: r.imp.namespaceName,
    named: r.imp.named,
  };
}

/** 把一组 import 语句规整为可写入的文本（去空白、丢弃无法解析的），用换行连接。 */
export function joinImportStatements(importStmts: string[]): string {
  return importStmts
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && parseImportStatement(s) !== null)
    .join("\n");
}

/**
 * 规划把 `importStmts` 合并进 `scriptContent` 的编辑列表（纯函数，不读写文件）。
 *
 * 返回的 `ImportEdit.at` / `ImportEdit.remove` 均为相对 scriptContent 的 offset，
 * 由调用方（editor.ts `ensureImports`）翻译成 SFC 全文 offset 后用 MagicString 应用。
 * 无需改动时返回空数组。
 */
export function planImports(
  scriptContent: string,
  importStmts: string[],
): ImportEdit[] {
  if (!importStmts || importStmts.length === 0) return [];
  const desired = importStmts
    .map((stmt) => ({ stmt, parsed: parseImportStatement(stmt) }))
    .filter((d): d is { stmt: string; parsed: ImportBindings } => !!d.parsed);
  if (!desired.length) return [];

  const existing = scanScriptImports(scriptContent);
  // 本轮追加的 import（不含位置），仅用于后续 desired 去重
  const appended: ImportBindings[] = [];
  // 最后一个原始 import 的结束 offset，作为新语句的统一插入点（多次追加按调用序堆叠）
  const lastEnd = existing.length ? existing[existing.length - 1].end : null;
  const edits: ImportEdit[] = [];

  for (const { stmt, parsed } of desired) {
    const matches = [...existing, ...appended].filter(
      (e) => e.module === parsed.module,
    );
    const alreadyNamed = new Set(
      matches.flatMap((e) => e.named.map((nb) => nb.imported)),
    );
    const missingNamed = parsed.named.filter(
      (nb) => !alreadyNamed.has(nb.imported),
    );
    const missingDefault =
      parsed.defaultName && !matches.some((e) => e.defaultName === parsed.defaultName)
        ? parsed.defaultName
        : undefined;
    const missingNamespace =
      parsed.namespaceName &&
      !matches.some((e) => e.namespaceName === parsed.namespaceName)
        ? parsed.namespaceName
        : undefined;

    // 全部已存在 -> 跳过（幂等）
    if (!missingNamed.length && !missingDefault && !missingNamespace) continue;

    // 模块未导入 -> 追加整条原始语句（保留用户书写的引号 / 别名 / type 等）
    if (matches.length === 0) {
      edits.push(planAppend(scriptContent, lastEnd, stmt.trim()));
      appended.push({
        module: parsed.module,
        defaultName: parsed.defaultName,
        namespaceName: parsed.namespaceName,
        named: [...parsed.named],
      });
      continue;
    }

    // 模块已导入：仅缺具名 且 现有存在非空具名子句 -> 并入 `}` 之前
    const withClause = existing.find(
      (e) =>
        e.module === parsed.module &&
        e.namedCloseBrace !== undefined &&
        e.named.length > 0,
    );
    if (
      missingNamed.length &&
      !missingDefault &&
      !missingNamespace &&
      withClause
    ) {
      const close = withClause.namedCloseBrace as number;
      // 吞掉 `}` 前的尾随空白（含换行），再插入 `, New `，得到 `{ A, New }` 的整洁排版
      let wsStart = close;
      while (wsStart > 0 && isWhitespace(scriptContent[wsStart - 1])) wsStart--;
      edits.push({
        at: close,
        remove: wsStart < close ? [wsStart, close] : undefined,
        insert: ", " + missingNamed.map(renderBinding).join(", ") + " ",
      });
      withClause.named.push(...missingNamed);
      continue;
    }

    // 其它情况 -> 追加一条仅含缺失绑定的新语句
    const partial = renderImport({
      module: parsed.module,
      defaultName: missingDefault,
      namespaceName: missingNamespace,
      named: missingNamed,
    });
    edits.push(planAppend(scriptContent, lastEnd, partial));
    appended.push({
      module: parsed.module,
      defaultName: missingDefault,
      namespaceName: missingNamespace,
      named: missingNamed,
    });
  }

  return edits;
}
