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
