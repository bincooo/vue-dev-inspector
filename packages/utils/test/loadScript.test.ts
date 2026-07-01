import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setCdnBuilder } from '../src/cdn';
import { loadScript } from '../src/paths';

describe('loadScript cdn scheme', () => {
  beforeEach(() => {
    setCdnBuilder(undefined);
  });
  afterEach(() => {
    setCdnBuilder(undefined);
  });

  it('dispatches to buildCdnUrl when first arg matches cdn:<pkg>:<ver>', () => {
    setCdnBuilder(() => 'https://cdn.example.com/lib');

    // Sync, returns CDN URL string, no fetch.
    const out = loadScript(
      'cdn:@scope/lib:1.2.3',
      './dist/x.js',
    );
    expect(out).toBe('https://cdn.example.com/lib/dist/x.js');
  });

  it('throws when cdn scheme but no builder registered', () => {
    expect(() =>
      loadScript('cdn:@scope/lib:1.2.3', './dist/x.js'),
    ).toThrow('[vdi] cdn builder 未注册');
  });

  it('throws when cdn scheme has no candidate paths', () => {
    expect(() =>
      loadScript('cdn:@scope/lib:1.2.3'),
    ).toThrow('[vdi] loadScript(cdn:...) 至少需要一个相对路径参数');
  });

  it('returns first candidate URL (no IO so first wins)', () => {
    // cdn scheme now only builds URL, no network IO. Multiple candidates
    // degrade to "first wins" — this test records the current behavior.
    setCdnBuilder(() => 'https://cdn.example.com/lib');

    const out = loadScript(
      'cdn:lib:1.0.0',
      './a.js',
      './b.js',
    );
    expect(out).toBe('https://cdn.example.com/lib/a.js');
  });

  it('preserves local fs path behavior (no cdn: prefix)', () => {
    expect(() =>
      loadScript('./definitely-not-existing-xyz.js'),
    ).toThrow('[vdi] 未找到构建产物');
  });
});
