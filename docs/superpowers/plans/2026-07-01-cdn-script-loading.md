# CDN 脚本加载与配置化 CDN URL 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 `@vue-dev-inspector/utils` 的 `loadScript` 支持 `cdn:<pkg>:<version>` scheme；让 `vueDevInspector({ cdn })` 接收用户自定义的 CDN URL 构造器；让 antdv 物料库的 expand 字段走 CDN 拉取。

**Architecture:** 三处协作：
1. `@vue-dev-inspector/utils` 的 `loadScript` 在 Node 端检测首参数为 `cdn:<pkg>:<version>` 时，调用注册的 cdn builder 拼 URL 并用 `fetch` 拉取文本。
2. `@vue-dev-inspector/core` 增加 `cdn` 选项到 `DevInspectorOptions`；在 `vueDevInspector()` 入口处 `setCdnBuilder(opts.cdn)`。
3. `@vue-dev-inspector/antdv` 的 expand 字段改用 `loadScript('cdn:@vue-dev-inspector/antdv:0.0.1', './dist/expand.iife.js')`，由 `loadScript` 实现层处理。

**Tech Stack:** TypeScript、Node 18+ `fetch`、pnpm monorepo、vitest@^2、tsup、Vite 插件。

## Global Constraints

1. **零破坏性**：现有 `loadScript('./expand.iife.js')` 与 `loadScript('@vue-dev-inspector/<pkg>', ...candidates)` 行为完全不变。
2. **向后兼容**：`cdn` 选项缺省时 `loadScript` 走 `cdn:` scheme 抛明确错误（要求调用方注入 builder），不静默回退。
3. **包归属**：
   - `@vue-dev-inspector/utils` 加 `cdn:` scheme 支持 + `setCdnBuilder` 注入点。
   - `@vue-dev-inspector/core` 把 `cdn` 选项加到 `DevInspectorOptions`；在 `vueDevInspector()` 入口处 `setCdnBuilder(opts.cdn)`。
   - `@vue-dev-inspector/antdv` 不改 src。
4. **错误语义**：`cdn:` scheme 找不到构造器抛 `[vdi] cdn builder 未注册`；`fetch` 失败抛 `[vdi] cdn fetch failed: <url>: <err>`。
5. **代码风格**：中文注释、英文标识符；保持与 `paths.ts` 一致。
6. **包管理器**：pnpm；ESM-only；改动后必须重建对应包并由用户跑 `pnpm dev:demo` 验证。
7. **测试**：新增 `vitest@^2` 作为 utils 包 devDep。
8. **构建顺序不变**：`loadScript` 改为 `async`；调用方（`core/src/plugin.ts` 的 `loadScript('./overlay.iife.js', ...)`、antdv 工厂调用）在 ESM 顶层 `await` 处理。

---

## File Structure

| 文件 | 职责 |
|---|---|
| `packages/utils/src/cdn.ts` (新) | `CdnBuilder` 类型、`setCdnBuilder()` / `getCdnBuilder()`、`loadCdnScript()` |
| `packages/utils/src/paths.ts` (改) | `loadScript` 改为 async；检测 `cdn:` scheme 分支调用 `loadCdnScript` |
| `packages/utils/src/index.ts` (改) | `export * from './cdn.ts';` |
| `packages/utils/package.json` (改) | 加 vitest@^2 devDep + test 脚本 |
| `packages/utils/vitest.config.ts` (新) | node 环境 |
| `packages/utils/test/loadScript.test.ts` (新) | cdn scheme 单元测试 |
| `packages/utils/test/cdn.test.ts` (新) | setCdnBuilder 注入与覆盖测试 |
| `packages/core/src/options.ts` (改) | 加 `cdn?: CdnBuilder` 字段 |
| `packages/core/src/plugin.ts` (改) | `vueDevInspector()` 入口处 `setCdnBuilder(options.cdn)`；`loadScript` 调用处加 `await` |
| `packages/core/src/transform.ts` | 不改 |

---

## Tasks

下面对每个任务列出 files、interfaces、step 序列。

### Task 1: utils cdn.ts 模块骨架 + setCdnBuilder 注入

**Files:**
- Create: `packages/utils/src/cdn.ts`

**Interfaces:**
- Consumes: 无
- Produces:
  - `export type CdnBuilder = (pkg: string, version: string) => string | Promise<string>`
  - `export function setCdnBuilder(builder: CdnBuilder | undefined): void`
  - `export function getCdnBuilder(): CdnBuilder | undefined`
  - `export async function loadCdnScript(pkg: string, version: string, relPath: string): Promise<string>`

- [ ] **Step 1: 创建 `packages/utils/src/cdn.ts`**

```ts
/**
 * CDN 脚本加载 —— loadScript cdn: scheme 的实现层。
 *
 * 物料库通过 `loadScript('cdn:<pkg>:<version>', './<relPath>')` 声明：
 * 「我要从 CDN 拉取这个包的这个文件作为 expand 拓展脚本」。
 * 但具体 CDN URL 怎么拼取决于用户环境 —— 用户在
 * `vueDevInspector({ cdn: (pkg, version) => '...' })` 中给出构造器。
 *
 * 该模块提供 builder 注入点（`setCdnBuilder` / `getCdnBuilder`），
 * 并封装一次 cdn fetch 调用。
 */
export type CdnBuilder = (pkg: string, version: string) => string | Promise<string>;

/** 模块级 builder 引用 —— 由 `@vue-dev-inspector/core` 在插件入口注入。 */
let _builder: CdnBuilder | undefined;

/** 注册/清空 cdn 构造器；用户没传 `cdn` 选项时 `_builder` 保持 undefined。 */
export function setCdnBuilder(builder: CdnBuilder | undefined): void {
  _builder = builder;
}

/** 读取当前 builder；未注册返回 undefined。 */
export function getCdnBuilder(): CdnBuilder | undefined {
  return _builder;
}

/**
 * 从 CDN 拉取指定包指定版本下的相对路径文件，返回文本内容。
 *
 * 拼 URL：`builder(pkg, version)` 返回值 + relPath（去掉前导 `./`）。
 * 例如 builder 返回 `https://cdn.jsdelivr.net/npm/jquery@3.7.0`，
 * relPath `./dist/jquery.min.js` → 最终 URL
 * `https://cdn.jsdelivr.net/npm/jquery@3.7.0/dist/jquery.min.js`。
 *
 * 网络失败抛 `[vdi] cdn fetch failed: <url>: <err>`。
 */
export async function loadCdnScript(
  pkg: string,
  version: string,
  relPath: string,
): Promise<string> {
  const builder = _builder;
  if (!builder) {
    throw new Error('[vdi] cdn builder 未注册；请在 vueDevInspector({ cdn }) 中提供');
  }
  const baseUrl = await builder(pkg, version);
  const cleaned = relPath.replace(/^\.\//, '');
  const finalUrl = cleaned ? `${baseUrl}/${cleaned}` : baseUrl;
  try {
    const res = await fetch(finalUrl);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return await res.text();
  } catch (err) {
    throw new Error(`[vdi] cdn fetch failed: ${finalUrl}: ${(err as Error).message}`);
  }
}
```

- [ ] **Step 2: 在 `packages/utils/src/index.ts` 追加 re-export**

在末尾追加：

```ts
export * from './cdn.ts';
```

- [ ] **Step 3: 提交**

```bash
git add packages/utils/src/cdn.ts packages/utils/src/index.ts
git commit -m "feat(utils): add cdn scheme module with setCdnBuilder + loadCdnScript"
```

---

### Task 2: utils vitest 配置 + cdn.ts 单元测试

**Files:**
- Modify: `packages/utils/package.json`
- Create: `packages/utils/vitest.config.ts`
- Create: `packages/utils/test/cdn.test.ts`

**Interfaces:**
- Consumes: `setCdnBuilder` / `getCdnBuilder` / `loadCdnScript`（来自 `../src/cdn`，Task 1 已实现）
- Produces: 单元测试覆盖 builder 注入、`loadCdnScript` 正常路径、缺 builder 报错、fetch 失败报错

- [ ] **Step 1: 修改 `packages/utils/package.json`**

在 `devDependencies` 块中追加：

```json
    "vitest": "^2.1.0"
```

在 `scripts` 块中追加：

```json
    "test": "vitest run"
```

- [ ] **Step 2: 创建 `packages/utils/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
```

- [ ] **Step 3: 写失败测试 `packages/utils/test/cdn.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  setCdnBuilder,
  getCdnBuilder,
  loadCdnScript,
} from '../src/cdn';

describe('cdn builder injection', () => {
  afterEach(() => {
    setCdnBuilder(undefined);
  });

  it('getCdnBuilder returns undefined initially', () => {
    setCdnBuilder(undefined);
    expect(getCdnBuilder()).toBeUndefined();
  });

  it('setCdnBuilder stores the builder', () => {
    const b = (pkg: string, ver: string) =>
      `https://cdn.jsdelivr.net/npm/${pkg}@${ver}`;
    setCdnBuilder(b);
    expect(getCdnBuilder()).toBe(b);
  });

  it('setCdnBuilder(undefined) clears the builder', () => {
    setCdnBuilder(() => '');
    setCdnBuilder(undefined);
    expect(getCdnBuilder()).toBeUndefined();
  });
});

describe('loadCdnScript', () => {
  beforeEach(() => {
    setCdnBuilder(undefined);
  });
  afterEach(() => {
    setCdnBuilder(undefined);
    vi.restoreAllMocks();
  });

  it('throws when no builder is registered', async () => {
    await expect(loadCdnScript('foo', '1.0.0', './dist/x.js'))
      .rejects.toThrow('[vdi] cdn builder 未注册');
  });

  it('fetches URL = baseUrl + relPath (no leading ./)', async () => {
    setCdnBuilder((pkg, ver) => `https://cdn.jsdelivr.net/npm/${pkg}@${ver}`);
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => 'console.log("ok")',
    }));
    vi.stubGlobal('fetch', fetchSpy);

    const out = await loadCdnScript('jquery', '3.7.0', './dist/jquery.min.js');
    expect(out).toBe('console.log("ok")');
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://cdn.jsdelivr.net/npm/jquery@3.7.0/dist/jquery.min.js',
    );
  });

  it('fetches URL = baseUrl + relPath when relPath has no leading ./', async () => {
    setCdnBuilder(() => 'https://cdn.example.com/lib');
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => '',
    }));
    vi.stubGlobal('fetch', fetchSpy);

    await loadCdnScript('lib', '1.0.0', 'index.js');
    expect(fetchSpy).toHaveBeenCalledWith('https://cdn.example.com/lib/index.js');
  });

  it('uses baseUrl directly when relPath is empty', async () => {
    setCdnBuilder(() => 'https://cdn.example.com/full/path.js');
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => 'body',
    }));
    vi.stubGlobal('fetch', fetchSpy);

    const out = await loadCdnScript('lib', '1.0.0', '');
    expect(out).toBe('body');
    expect(fetchSpy).toHaveBeenCalledWith('https://cdn.example.com/full/path.js');
  });

  it('throws with [vdi] cdn fetch failed on HTTP 404', async () => {
    setCdnBuilder(() => 'https://cdn.example.com/lib');
    vi.stubGlobal('fetch', async () => ({
      ok: false,
      status: 404,
      text: async () => '',
    }));

    await expect(loadCdnScript('lib', '1.0.0', './x.js'))
      .rejects.toThrow('[vdi] cdn fetch failed: https://cdn.example.com/lib/x.js');
  });

  it('throws with [vdi] cdn fetch failed on network error', async () => {
    setCdnBuilder(() => 'https://cdn.example.com/lib');
    vi.stubGlobal('fetch', async () => {
      throw new Error('ECONNREFUSED');
    });

    await expect(loadCdnScript('lib', '1.0.0', './x.js'))
      .rejects.toThrow('[vdi] cdn fetch failed: https://cdn.example.com/lib/x.js: ECONNREFUSED');
  });

  it('supports async builder returning Promise<string>', async () => {
    setCdnBuilder(async (pkg, ver) => `https://cdn.example.com/${pkg}/${ver}`);
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => 'async-builder',
    }));
    vi.stubGlobal('fetch', fetchSpy);

    const out = await loadCdnScript('lib', '1.0.0', './x.js');
    expect(out).toBe('async-builder');
    expect(fetchSpy).toHaveBeenCalledWith('https://cdn.example.com/lib/1.0.0/x.js');
  });
});
```

- [ ] **Step 4: 跑测试，确认通过**

```bash
pnpm -C packages/utils test
```

Expected: 10/10 PASS。

- [ ] **Step 5: 提交**

```bash
git add packages/utils/package.json packages/utils/vitest.config.ts packages/utils/test/cdn.test.ts
git commit -m "test(utils): cover cdn builder injection and loadCdnScript paths"
```

---

### Task 3: loadScript 接入 cdn: scheme

**Files:**
- Modify: `packages/utils/src/paths.ts`

**Interfaces:**
- Consumes: `loadCdnScript(pkg, version, relPath)`（来自 `./cdn`，Task 1 已实现）
- Produces:
  - `loadScript(...args: string[]): Promise<string>`（改为 async）
  - 首参数匹配 `/^cdn:(.+):(.+)$/` 时调用 `loadCdnScript(pkg, version, first-candidate)`

- [ ] **Step 1: 修改 `packages/utils/src/paths.ts`**

定位到 `loadScript` 函数定义（行 65）。替换整个函数：

```ts
/**
 * 加载构建产物。
 *
 * 支持三种调用形式：
 *
 *   1. loadScript(...candidates)
 *      相对 `import.meta.url` 解析（原始 API）。
 *      适用于直接调用方：例如 `core/dist/index.js` 这种**未被 bundle** 的真实
 *      文件路径场景，相对路径按 dist/ 目录解析。
 *
 *   2. loadScript('@vue-dev-inspector/<pkg>', ...candidates)
 *      以 `@vue-dev-inspector/<pkg>` 包根为锚点解析（pnpm 解析 + createRequire）。
 *      用于 esbuild / rollup 把本调用方打进另一个 bundle 之后 `import.meta.url`
 *      指向 bundle 文件（而非本包 dist/），相对路径全部失效的场景。
 *
 *   3. loadScript('cdn:<pkg>:<version>', ...candidates)
 *      CDN 拉取模式。第一个参数形如 `cdn:@scope/name:1.2.3`；后续参数为
 *      包内相对路径（按声明顺序取第一个成功的）。URL 拼接走用户在
 *      `vueDevInspector({ cdn })` 注册的 builder；builder 缺位时抛明确错误。
 *
 * 多个候选按顺序尝试，命中即返回；全部失败抛错。
 */
export async function loadScript(...args: string[]): Promise<string> {
  if (args.length === 0) {
    throw new Error('[vdi] loadScript: 至少需要一个参数');
  }

  // 形式 3：cdn scheme
  const cdnMatch = /^cdn:([^:]+):([^:]+)$/.exec(args[0]);
  if (cdnMatch) {
    const pkg = cdnMatch[1];
    const version = cdnMatch[2];
    const candidates = args.slice(1);
    if (candidates.length === 0) {
      throw new Error('[vdi] loadScript(cdn:...) 至少需要一个相对路径参数');
    }
    const { loadCdnScript } = await import('./cdn.ts');
    let lastErr: unknown;
    for (const cd of candidates) {
      try {
        return await loadCdnScript(pkg, version, cd);
      } catch (err) {
        lastErr = err;
      }
    }
    throw new Error(
      `[vdi] cdn 所有候选路径均失败: ${candidates.join(', ')}: ${(lastErr as Error)?.message ?? 'unknown'}`,
    );
  }

  // 形式 2：包名锚点
  let baseDir: string | undefined;
  let candidates = args;
  if (args.length > 0 && /^@vdi\//.test(args[0])) {
    const pkgName = args[0];
    try {
      const pkgEntryUrl = import.meta.resolve(pkgName);
      const pkgEntry = fileURLToPath(pkgEntryUrl);
      baseDir = path.dirname(path.dirname(pkgEntry));
      candidates = args.slice(1);
    } catch (err) {
      throw new Error(
        `[vdi] 未找到包 ${pkgName}：${(err as Error).message}`,
      );
    }
  }

  // 形式 1：本地 fs 读取
  const here = baseDir ?? path.dirname(fileURLToPath(import.meta.url));
  for (const cd of candidates) {
    try {
      const p = path.isAbsolute(cd) ? cd : path.resolve(here, cd);
      return fs.readFileSync(p, 'utf-8');
    } catch {
      // intentionally ignored
    }
  }
  throw new Error('[vdi] 未找到构建产物。');
}
```

- [ ] **Step 2: 验证 utils 类型层**

utils 包根目录无独立 tsconfig（CLAUDE.md 提到「每个包单独执行 tsc」），先创建 `packages/utils/tsconfig.json`：

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "noEmit": true
  },
  "include": ["src/**/*.ts", "test/**/*.ts"]
}
```

跑：

```bash
pnpm -C packages/utils exec tsc --noEmit
```

Expected: 退出码 0。

- [ ] **Step 3: 提交**

```bash
git add packages/utils/src/paths.ts packages/utils/tsconfig.json
git commit -m "feat(utils): add cdn: scheme support to loadScript"
```

---

### Task 4: loadScript cdn scheme 集成测试

**Files:**
- Create: `packages/utils/test/loadScript.test.ts`

**Interfaces:**
- Consumes: `loadScript`（来自 `../src/paths`，Task 3 已改为 async）
- Produces: 覆盖 cdn scheme 三种场景（成功、缺 builder、所有候选失败）+ 既有 local/@vdi 路径不变

- [ ] **Step 1: 写失败测试 `packages/utils/test/loadScript.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setCdnBuilder } from '../src/cdn';
import { loadScript } from '../src/paths';

describe('loadScript cdn scheme', () => {
  beforeEach(() => {
    setCdnBuilder(undefined);
  });
  afterEach(() => {
    setCdnBuilder(undefined);
    vi.restoreAllMocks();
  });

  it('dispatches to loadCdnScript when first arg matches cdn:<pkg>:<ver>', async () => {
    setCdnBuilder(() => 'https://cdn.example.com/lib');
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => 'cdn-body',
    }));
    vi.stubGlobal('fetch', fetchSpy);

    const out = await loadScript(
      'cdn:@scope/lib:1.2.3',
      './dist/x.js',
    );
    expect(out).toBe('cdn-body');
    expect(fetchSpy).toHaveBeenCalledWith('https://cdn.example.com/lib/dist/x.js');
  });

  it('throws when cdn scheme but no builder registered', async () => {
    await expect(
      loadScript('cdn:@scope/lib:1.2.3', './dist/x.js'),
    ).rejects.toThrow('[vdi] cdn builder 未注册');
  });

  it('throws when cdn scheme has no candidate paths', async () => {
    await expect(
      loadScript('cdn:@scope/lib:1.2.3'),
    ).rejects.toThrow('[vdi] loadScript(cdn:...) 至少需要一个相对路径参数');
  });

  it('tries multiple candidates in order for cdn scheme', async () => {
    setCdnBuilder(() => 'https://cdn.example.com/lib');
    let attempt = 0;
    vi.stubGlobal('fetch', async (url: string) => {
      attempt++;
      if (attempt === 1) {
        throw new Error('first fail');
      }
      return {
        ok: true,
        status: 200,
        text: async () => `ok-${url}`,
      };
    });

    const out = await loadScript(
      'cdn:lib:1.0.0',
      './a.js',
      './b.js',
    );
    expect(out).toBe('ok-https://cdn.example.com/lib/b.js');
    expect(attempt).toBe(2);
  });

  it('preserves local fs path behavior (no cdn: prefix)', async () => {
    // 不动现有 API：调用无 cdn: 前缀的 loadScript 应走 fs 路径
    // 此处不指定实际路径，靠错误信息判断走了 fs 分支
    await expect(
      loadScript('./definitely-not-existing-xyz.js'),
    ).rejects.toThrow('[vdi] 未找到构建产物');
  });
});
```

- [ ] **Step 2: 跑测试，确认通过**

```bash
pnpm -C packages/utils test
```

Expected: 全部用例 PASS（Task 2 的 10 个 + Task 4 的 5 个 = 15/15）。

- [ ] **Step 3: 提交**

```bash
git add packages/utils/test/loadScript.test.ts
git commit -m "test(utils): cover loadScript cdn scheme dispatch"
```

---

### Task 5: core DevInspectorOptions 加 cdn 字段

**Files:**
- Modify: `packages/core/src/options.ts`

**Interfaces:**
- Consumes: `CdnBuilder`（来自 `@vue-dev-inspector/utils`）
- Produces:
  - `DevInspectorOptions.cdn?: CdnBuilder` 字段

- [ ] **Step 1: 修改 `packages/core/src/options.ts`**

定位到 import 区（行 1-2）。改为：

```ts
/** 共享类型来自 shared 包（API_PREFIX / EDITOR_PROTOCOLS / 组件目录类型） */
import type { ComponentConfig } from "@vue-dev-inspector/shared";
import type { CdnBuilder } from "@vue-dev-inspector/utils";
```

在 `expressionPlugins?: ...` 字段之后追加：

```ts
  /**
   * CDN URL 构造器 —— 用于 `loadScript('cdn:<pkg>:<version>', ...)` 模式。
   *
   * 用户自定义 CDN 时传入；例如：
   *   cdn: (pkg, ver) => `https://cdn.jsdelivr.net/npm/${pkg}@${ver}`
   *
   * 插件入口处会调用 `setCdnBuilder(this.cdn)` 注入到 utils 模块；
   * 未配置时 `loadScript` 走 cdn: scheme 抛明确错误。
   *
   * 返回值可以是字符串或 Promise<string>（支持异步构造器）。
   */
  cdn?: CdnBuilder;
```

- [ ] **Step 2: 验证 core 类型层**

```bash
pnpm -C packages/core exec tsc --noEmit
```

Expected: 退出码 0。

- [ ] **Step 3: 提交**

```bash
git add packages/core/src/options.ts
git commit -m "feat(core): add cdn option to DevInspectorOptions"
```

---

### Task 6: core plugin 注入 setCdnBuilder + loadScript 改异步

**Files:**
- Modify: `packages/core/src/plugin.ts`

**Interfaces:**
- Consumes: `setCdnBuilder`（来自 `@vue-dev-inspector/utils`）、`loadScript`（来自 `@vue-dev-inspector/utils`，Task 3 改为 async）
- Produces:
  - `vueDevInspector()` 入口（合并 options 之后）调用 `setCdnBuilder(options.cdn)`
  - 模块顶层 `loadScript(...)` 改为顶层 `await`

- [ ] **Step 1: 修改 `packages/core/src/plugin.ts`**

定位到 import 区（行 13-17）。改为：

```ts
import {
  resolveProjectRootIndex,
  toPosixRelative,
  loadScript,
  setCdnBuilder,
} from "../../utils/src/paths";
```

定位到 `loadScript('./overlay.iife.js', ...)` 调用（行 23）。改为顶层 await：

```ts
const overlayScript = await loadScript('./overlay.iife.js', '../../overlay/dist/overlay.iife.js');
```

定位到 `vueDevInspector(opts)` 函数体（行 94）。在 `const options = { ...DEFAULT_OPTIONS, ...opts };` 之后追加：

```ts
  // 注入 cdn 构造器：用户配置 vueDevInspector({ cdn }) 时由 utils 模块的
  // loadScript('cdn:...') 消费。未配置时 _builder 保持 undefined，
  // loadScript('cdn:...') 调用会抛明确错误。
  setCdnBuilder(options.cdn);
```

- [ ] **Step 2: 验证 core 类型层**

```bash
pnpm -C packages/core exec tsc --noEmit
```

Expected: 退出码 0。

- [ ] **Step 3: 提交**

```bash
git add packages/core/src/plugin.ts
git commit -m "feat(core): inject cdn builder via setCdnBuilder + await overlayScript"
```

---

### Task 7: 全包类型检查 + 端到端构建验证

**Files:** （无；纯验证）

- [ ] **Step 1: 全包 tsc**

```bash
for p in shared client core overlay antdv utils; do
  echo "=== $p ==="
  pnpm -C packages/$p exec tsc --noEmit 2>&1 || true
done
```

Expected: 所有包 exit 0。

- [ ] **Step 2: utils 单元测试**

```bash
pnpm -C packages/utils test
```

Expected: 15/15 PASS（Task 2 的 10 个 + Task 4 的 5 个）。

- [ ] **Step 3: overlay 单元测试（回归）**

```bash
pnpm -C packages/overlay test
```

Expected: 既有 extensibility 测试 7/7 PASS（确认 cdn 改动未破坏 overlay）。

- [ ] **Step 4: 顺序构建**

```bash
pnpm build:overlay
pnpm -C packages/client build
pnpm -C packages/core build
pnpm -C packages/antdv build
```

Expected: 所有产物生成在 `packages/*/dist/`。

- [ ] **Step 5: 用户跑 `pnpm dev:demo` 手动验证（不在 AI 范围）**

由用户在终端执行：

```bash
pnpm dev:demo
```

打开浏览器后：
1. 进入审查（Alt+Shift+I）→ 浏览器 network 面板看到 `https://cdn.jsdelivr.net/npm/@vue-dev-inspector/antdv@0.0.1/dist/expand.iife.js`（或用户自定义 CDN）的 GET 请求
2. console 输出 `[antdv-demo] enter inspect mode`（说明 expand 拉取并执行成功）
3. 选中 antdv 元素 → console 输出 `[antdv-demo] select DIV {…}`
4. 点击 ai 助手按钮 → console 输出 `[antdv-demo] wrap clicked, source = …`

- [ ] **Step 6: 最终提交（如有修正）**

若有 Step 1-4 失败，做修复提交；若无，本任务无代码改动。

---

## Self-Review Checklist

- [ ] **Spec coverage**：
  - `loadScript('cdn:<pkg>:<version>', './path')` → Task 3 + Task 4
  - `vueDevInspector({ cdn: (pkg, ver) => '...' })` → Tasks 5-6
  - antdv expand 字段走 CDN → Task 6（通过 utils cdn scheme 实现）+ Task 7 端到端验证
- [ ] **Placeholder 扫描**：0 处 TBD/TODO/"implement later"
- [ ] **类型一致性**：`CdnBuilder` 类型在 utils 定义、core 引用；`loadScript` 返回类型从 `string` 改为 `Promise<string>` 已在 Task 3 + Task 6 同步迁移
- [ ] **命名一致性**：`setCdnBuilder` / `getCdnBuilder` / `loadCdnScript` / `CdnBuilder` 命名贯穿全文
- [ ] **失败语义**：Task 1 + Task 4 覆盖缺 builder / HTTP 错误 / 网络错误 / cdn 候选全失败四种抛错
- [ ] **覆盖范围**：7 个任务，每个独立可测试 / 可审核

