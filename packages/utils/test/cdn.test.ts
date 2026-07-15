import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { setCdnBuilder, getCdnBuilder, buildCdnUrl } from "../src/cdn";

/**
 * cdn builder 注入点测试。
 *
 * 当前契约（commit "refactor: cdn scheme returns URL string; core emits
 * script src=url (no fetch)" 之后）：
 *   - CdnBuilder 是**同步**签名 `(pkg, ver) => string`（不再允许 Promise）。
 *   - 未注册 setCdnBuilder 时，_builder 保留一个 jsdelivr 全链 URL 默认值，
 *     getCdnBuilder 返回该默认值（而非 undefined）—— 用户显式 setCdnBuilder(undefined)
 *     才会真正清空。
 *   - buildCdnUrl 直接返回 builder(pkg, ver)，**不拼 relPath**：CDN URL 形状
 *     完全由 builder 决定；core 以 `<script src=url>` 注入，不发起 IO。
 */
describe("cdn builder injection", () => {
  afterEach(() => {
    // 回到默认 builder，避免用例间相互污染
    setCdnBuilder(undefined);
  });

  it("setCdnBuilder(undefined) clears the builder (default removed)", () => {
    setCdnBuilder(undefined);
    expect(getCdnBuilder()).toBeUndefined();
  });

  it("setCdnBuilder stores the builder", () => {
    const b = (pkg: string, ver: string) =>
      `https://cdn.jsdelivr.net/npm/${pkg}@${ver}`;
    setCdnBuilder(b);
    expect(getCdnBuilder()).toBe(b);
  });

  it("setCdnBuilder(undefined) clears a previously-set builder", () => {
    setCdnBuilder(() => "x");
    setCdnBuilder(undefined);
    expect(getCdnBuilder()).toBeUndefined();
  });
});

describe("buildCdnUrl", () => {
  beforeEach(() => {
    setCdnBuilder(undefined);
  });
  afterEach(() => {
    setCdnBuilder(undefined);
  });

  it("throws when no builder registered", () => {
    setCdnBuilder(undefined);
    expect(() => buildCdnUrl("foo", "1.0.0")).toThrow(
      "[vdi] cdn builder 未注册",
    );
  });

  it("returns exactly builder(pkg, ver) — no relPath joining (current contract)", () => {
    // cdn scheme 现在不再接受 relPath：URL 形状由 builder 全权决定。
    setCdnBuilder((pkg, ver) => `https://cdn.jsdelivr.net/npm/${pkg}@${ver}/dist/expand.iife.js`);

    expect(buildCdnUrl("jquery", "3.7.0")).toBe(
      "https://cdn.jsdelivr.net/npm/jquery@3.7.0/dist/expand.iife.js",
    );
  });

  it("builder may return a bare base url (full responsibility on builder)", () => {
    setCdnBuilder(() => "https://cdn.example.com/lib/x.js");
    expect(buildCdnUrl("lib", "1.0.0")).toBe("https://cdn.example.com/lib/x.js");
  });

  it("returns a plain string synchronously", () => {
    setCdnBuilder(() => "https://cdn.example.com/lib");
    const out = buildCdnUrl("lib", "1.0.0");
    expect(typeof out).toBe("string");
    expect(out).toBe("https://cdn.example.com/lib");
  });

  it("custom CDN builder contract", () => {
    setCdnBuilder((pkg, ver) => `https://unpkg.com/${pkg}@${ver}/dist/x.js`);
    expect(buildCdnUrl("@scope/lib", "2.0.0")).toBe(
      "https://unpkg.com/@scope/lib@2.0.0/dist/x.js",
    );
  });
});
