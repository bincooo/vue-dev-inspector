import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  setCdnBuilder,
  getCdnBuilder,
  buildCdnUrl,
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

describe('buildCdnUrl', () => {
  beforeEach(() => {
    setCdnBuilder(undefined);
  });
  afterEach(() => {
    setCdnBuilder(undefined);
  });

  it('throws when no builder is registered', () => {
    expect(() => buildCdnUrl('foo', '1.0.0', './dist/x.js'))
      .toThrow('[vdi] cdn builder 未注册');
  });

  it('joins URL = baseUrl + relPath (no leading ./)', () => {
    setCdnBuilder((pkg, ver) => `https://cdn.jsdelivr.net/npm/${pkg}@${ver}`);

    const out = buildCdnUrl('jquery', '3.7.0', './dist/jquery.min.js');
    expect(out).toBe('https://cdn.jsdelivr.net/npm/jquery@3.7.0/dist/jquery.min.js');
  });

  it('joins URL = baseUrl + relPath when relPath has no leading ./', () => {
    setCdnBuilder(() => 'https://cdn.example.com/lib');

    expect(buildCdnUrl('lib', '1.0.0', 'index.js'))
      .toBe('https://cdn.example.com/lib/index.js');
  });

  it('uses baseUrl directly when relPath is empty', () => {
    setCdnBuilder(() => 'https://cdn.example.com/full/path.js');

    expect(buildCdnUrl('lib', '1.0.0', ''))
      .toBe('https://cdn.example.com/full/path.js');
  });

  it('does not fetch and returns synchronously', () => {
    setCdnBuilder(() => 'https://cdn.example.com/lib');
    // 函数签名是同步的（不返回 Promise）；验证调用本身即得到结果。
    const out = buildCdnUrl('lib', '1.0.0', './x.js');
    expect(typeof out).toBe('string');
    expect(out).toBe('https://cdn.example.com/lib/x.js');
  });

  it('preserves builder-side URL contract (custom CDN)', () => {
    setCdnBuilder((pkg, ver) => `https://unpkg.com/${pkg}@${ver}`);

    expect(buildCdnUrl('@scope/lib', '2.0.0', './dist/lib.js'))
      .toBe('https://unpkg.com/@scope/lib@2.0.0/dist/lib.js');
  });

  it('throws when async builder returns a Promise (sync API contract)', () => {
    // 保留 async builder 类型的兼容能力，但本函数要求同步 URL；
    // 当 builder 实际返回 Promise 时显式抛错，避免 "[object Promise]" 拼串。
    setCdnBuilder(async (pkg, ver) => `https://cdn.example.com/${pkg}/${ver}`);

    expect(() => buildCdnUrl('lib', '1.0.0', './x.js'))
      .toThrow('[vdi] cdn builder 必须同步返回 string');
  });
});
