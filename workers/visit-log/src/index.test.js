import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import worker from './index.js';

const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';

describe('visit-log fetch', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('handles /e as 204 and never fetches origin', async () => {
    const originFetch = vi.fn();
    vi.stubGlobal('fetch', originFetch);

    const run = vi.fn().mockResolvedValue({});
    const bind = vi.fn().mockReturnValue({ run });
    const prepare = vi.fn().mockReturnValue({ bind });
    const waitUntil = vi.fn((p) => p);

    const request = new Request('https://csfields.com/e?n=linkedin', {
      headers: { 'User-Agent': BROWSER_UA, Cookie: 'vid=abc' },
    });

    const response = await worker.fetch(request, { DB: { prepare } }, { waitUntil });

    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
    expect(originFetch).not.toHaveBeenCalled();
    expect(waitUntil).toHaveBeenCalled();
    await waitUntil.mock.calls[0][0];
    expect(prepare).toHaveBeenCalled();
    const columns = String(prepare.mock.calls[0][0])
      .match(/INSERT INTO visits\s*\(([^)]+)\)/i)[1]
      .split(',')
      .map((part) => part.trim());
    const bound = bind.mock.calls[0];
    expect(bound[columns.indexOf('vid')]).toBe('abc');
    expect(bound[columns.indexOf('path')]).toBe('/e');
    expect(bound[columns.indexOf('query')]).toBe('n=linkedin');
    expect(bound[columns.indexOf('status')]).toBe(204);
    expect(bound[columns.indexOf('cookie')]).toBe('vid=abc');
    expect(bound[columns.indexOf('ip')]).toBe('');
  });

  it('sets a vid cookie on / 200 when the request has none', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('<html>ok</html>', { status: 200 }))
    );
    const waitUntil = vi.fn((p) => p);
    const request = new Request('https://csfields.com/', {
      headers: { 'User-Agent': BROWSER_UA },
    });
    const response = await worker.fetch(request, {}, { waitUntil });
    expect(response.status).toBe(200);
    const setCookie = response.headers.get('Set-Cookie');
    expect(setCookie).toMatch(/^vid=[0-9a-f-]{36}; Max-Age=31536000; Path=\/; SameSite=Lax; Secure$/i);
  });
});
