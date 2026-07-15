import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { setCdnBuilder } from "../src/cdn";
import { loadScript } from "../src/paths";

/**
 * loadScript 的 cdn scheme 测试。
 *
 * 当前契约：`loadScript('cdn:<pkg>:<ver>', ...candidates)` —— 第一个参数
 * 匹配 `cdn:<pkg>:<ver>` 后，**忽略**后续 candidates，直接返回
 * `builder(pkg, ver)` 的 URL 字符串。core 以 `<script src=url>` 注入，
 * 不发起任何网络请求。
 *
 * 这是 commit "refactor: cdn scheme returns URL string" 之后的简化行为；
 * 不再按 candidate 顺序拼 relPath。
 */
describe("loadScript cdn scheme", () => {
  beforeEach(() => {
    setCdnBuilder(undefined);
  });
  afterEach(() => {
    setCdnBuilder(undefined);
  });

  it("returns builder(pkg, ver) URL when first arg matches cdn:<pkg>:<ver>", () => {
    setCdnBuilder(() => "https://cdn.example.com/lib");

    const out = loadScript("cdn:@scope/lib:1.2.3", "./dist/x.js");
    expect(out).toBe("https://cdn.example.com/lib");
  });

  it("throws when cdn scheme but no builder registered", () => {
    expect(() => loadScript("cdn:@scope/lib:1.2.3", "./dist/x.js")).toThrow(
      "[vdi] cdn builder 未注册",
    );
  });

  it("returns builder URL regardless of candidate count (first-wins, candidates ignored)", () => {
    // cdn scheme 现在只拼 URL，不按 candidate 顺序尝试；多候选被忽略。
    setCdnBuilder(() => "https://cdn.example.com/lib");

    const out = loadScript("cdn:lib:1.0.0", "./a.js", "./b.js");
    expect(out).toBe("https://cdn.example.com/lib");
  });

  it("cdn scheme with no candidates still returns builder URL (no guard)", () => {
    // 当前实现没有 candidate-length 守卫；cdn scheme 命中即返回 builder URL。
    setCdnBuilder(() => "https://cdn.example.com/lib");
    expect(loadScript("cdn:lib:1.0.0")).toBe("https://cdn.example.com/lib");
  });

  it("preserves local fs path behavior (no cdn: prefix)", () => {
    expect(() => loadScript("./definitely-not-existing-xyz.js")).toThrow(
      "[vdi] 未找到构建产物",
    );
  });
});
