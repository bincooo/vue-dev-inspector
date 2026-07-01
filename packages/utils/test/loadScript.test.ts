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
    await expect(
      loadScript('./definitely-not-existing-xyz.js'),
    ).rejects.toThrow('[vdi] 未找到构建产物');
  });
});
