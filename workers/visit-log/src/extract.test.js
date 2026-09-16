import { describe, it, expect } from 'vitest';
import {
  extractVisit,
  guessBot,
  guessBotVisit,
  isBeaconPath,
  parseVidCookie,
  shouldSetVidCookie,
  vidSetCookie,
} from './extract.js';

const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';

function fakeRequest({
  url = 'https://csfields.com/path?x=1',
  method = 'GET',
  headers = {},
  cf = {},
} = {}) {
  return {
    url,
    method,
    headers: {
      get(name) {
        const key = Object.keys(headers).find(
          (k) => k.toLowerCase() === name.toLowerCase()
        );
        return key ? headers[key] : null;
      },
    },
    cf,
  };
}

describe('guessBot', () => {
  it('flags obvious bot UAs', () => {
    expect(guessBot('Mozilla/5.0 (compatible; Googlebot/2.1)')).toBe(1);
    expect(guessBot('curl/8.0')).toBe(1);
    expect(guessBot('python-requests/2.31')).toBe(1);
  });

  it('leaves normal browsers as 0', () => {
    expect(guessBot(BROWSER_UA)).toBe(0);
  });

  it('flags missing/empty UA as bot', () => {
    expect(guessBot('')).toBe(1);
    expect(guessBot(null)).toBe(1);
  });
});

describe('guessBotVisit', () => {
  it('flags spoofed browser UA on /wp-login.php', () => {
    expect(guessBotVisit(BROWSER_UA, '/wp-login.php', 404)).toBe(1);
  });

  it('flags .php path with browser UA', () => {
    expect(guessBotVisit(BROWSER_UA, '/waso.php', 200)).toBe(1);
  });

  it('flags 404 on random path with browser UA', () => {
    expect(guessBotVisit(BROWSER_UA, '/no-such-page', 404)).toBe(1);
  });

  it('does not flag favicon.ico 404 with browser UA', () => {
    expect(guessBotVisit(BROWSER_UA, '/favicon.ico', 404)).toBe(0);
  });

  it('does not flag favicon.svg 404 with browser UA', () => {
    expect(guessBotVisit(BROWSER_UA, '/favicon.svg', 404)).toBe(0);
  });

  it('does not flag /e 204 as a bot via the 404 heuristic', () => {
    expect(guessBotVisit(BROWSER_UA, '/e', 204)).toBe(0);
  });

  it('does not flag normal browser on / with 200', () => {
    expect(guessBotVisit(BROWSER_UA, '/', 200)).toBe(0);
  });
});

describe('extractVisit', () => {
  it('captures ip, method, full url, path, query, headers, cf fields', async () => {
    const req = fakeRequest({
      url: 'https://csfields.com/hello?utm=1&token=abc',
      method: 'POST',
      headers: {
        'CF-Connecting-IP': '203.0.113.9',
        'User-Agent': 'curl/8.0',
        Referer: 'https://example.com/',
        'Accept-Language': 'en-US,en;q=0.9',
        Cookie: 'a=1; b=2',
        'Content-Type': 'application/json',
        'CF-Ray': 'abc123-EWR',
      },
      cf: {
        country: 'US',
        colo: 'EWR',
        asOrganization: 'Example ISP',
        tlsVersion: 'TLSv1.3',
        botManagement: { score: 3, verifiedBot: false },
      },
    });

    const visit = await extractVisit(req, {
      status: 404,
      bodyText: '{"probe":true}',
      bodyLen: 15,
    });

    expect(visit.ip).toBe('203.0.113.9');
    expect(visit.method).toBe('POST');
    expect(visit.url).toBe('https://csfields.com/hello?utm=1&token=abc');
    expect(visit.path).toBe('/hello');
    expect(visit.query).toBe('utm=1&token=abc');
    expect(visit.status).toBe(404);
    expect(visit.ua).toBe('curl/8.0');
    expect(visit.referer).toBe('https://example.com/');
    expect(visit.accept_language).toBe('en-US,en;q=0.9');
    expect(visit.cookie).toBe('');
    expect(visit.content_type).toBe('application/json');
    expect(visit.body).toBeNull();
    expect(visit.body_len).toBe(15);
    expect(visit.country).toBe('US');
    expect(visit.colo).toBe('EWR');
    expect(visit.as_org).toBe('Example ISP');
    expect(visit.tls_version).toBe('TLSv1.3');
    expect(visit.bot_score).toBe(3);
    expect(visit.verified_bot).toBe(0);
    expect(visit.bot_guess).toBe(1);
    expect(visit.ray).toBe('abc123-EWR');
    expect(visit.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('omits body text when bodyLen exceeds 8192', async () => {
    const req = fakeRequest({
      headers: { 'Content-Type': 'text/plain', 'CF-Connecting-IP': '1.1.1.1' },
    });
    const visit = await extractVisit(req, {
      status: 200,
      bodyText: 'x'.repeat(9000),
      bodyLen: 9000,
    });
    expect(visit.body).toBeNull();
    expect(visit.body_len).toBe(9000);
  });

  it('flags spoofed browser UA probing /wp-login.php as bot', async () => {
    const req = fakeRequest({
      url: 'https://csfields.com/wp-login.php',
      headers: { 'User-Agent': BROWSER_UA },
    });
    const visit = await extractVisit(req, { status: 404, bodyText: null, bodyLen: null });
    expect(visit.bot_guess).toBe(1);
  });

  it('sets verified_bot null when botManagement is absent', async () => {
    const req = fakeRequest({
      url: 'https://csfields.com/',
      headers: { 'User-Agent': BROWSER_UA },
      cf: { country: 'US' },
    });
    const visit = await extractVisit(req, { status: 200, bodyText: null, bodyLen: null });
    expect(visit.verified_bot).toBeNull();
    expect(visit.bot_score).toBeNull();
    expect(visit.bot_guess).toBe(0);
  });

  it('sets verified_bot 1 when Cloudflare reports verifiedBot true', async () => {
    const req = fakeRequest({
      url: 'https://csfields.com/',
      headers: { 'User-Agent': 'Googlebot/2.1' },
      cf: { botManagement: { score: 1, verifiedBot: true } },
    });
    const visit = await extractVisit(req, { status: 200, bodyText: null, bodyLen: null });
    expect(visit.verified_bot).toBe(1);
  });

  it('uses an explicitly supplied timestamp verbatim', async () => {
    const req = fakeRequest();
    const ts = '2024-06-15T12:34:56.789Z';
    const visit = await extractVisit(req, {
      status: 200,
      bodyText: null,
      bodyLen: null,
      ts,
    });
    expect(visit.ts).toBe(ts);
  });

  it('parses vid from the Cookie header', async () => {
    const req = fakeRequest({
      url: 'https://csfields.com/',
      headers: { Cookie: 'theme=night; vid=abc-123; other=1' },
    });
    const visit = await extractVisit(req, { status: 200, bodyText: null, bodyLen: null });
    expect(visit.vid).toBe('abc-123');
  });

  it('uses an explicit vid override when the request has no cookie yet', async () => {
    const req = fakeRequest({ url: 'https://csfields.com/' });
    const visit = await extractVisit(req, {
      status: 200,
      bodyText: null,
      bodyLen: null,
      vid: 'new-visitor',
    });
    expect(visit.vid).toBe('new-visitor');
  });

  it('does not keep inbound cookie or request body on the visit record', async () => {
    const req = fakeRequest({
      url: 'https://csfields.com/',
      headers: { Cookie: 'vid=abc; session=secret', 'Content-Type': 'application/json' },
    });
    const visit = await extractVisit(req, {
      status: 200,
      bodyText: '{"email":"nobody@example.com"}',
      bodyLen: 30,
    });
    expect(visit.cookie).toBe('');
    expect(visit.body).toBeNull();
    expect(visit.vid).toBe('abc');
  });

  it('falls back to a current ISO timestamp when none is supplied', async () => {
    const req = fakeRequest();
    const before = Date.now();
    const visit = await extractVisit(req, {
      status: 200,
      bodyText: null,
      bodyLen: null,
    });
    const after = Date.now();
    expect(visit.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    const parsed = Date.parse(visit.ts);
    expect(parsed).toBeGreaterThanOrEqual(before);
    expect(parsed).toBeLessThanOrEqual(after);
  });
});

describe('vid cookie helpers', () => {
  it('parses vid and ignores other cookies', () => {
    expect(parseVidCookie('vid=hello-world; Path=/')).toBe('hello-world');
    expect(parseVidCookie('a=1; vid=xyz')).toBe('xyz');
    expect(parseVidCookie('')).toBe('');
    expect(parseVidCookie(null)).toBe('');
  });

  it('sets vid only on a / 200 with no existing cookie', () => {
    expect(shouldSetVidCookie('/', 200, '')).toBe(true);
    expect(shouldSetVidCookie('/', 200, 'already')).toBe(false);
    expect(shouldSetVidCookie('/', 301, '')).toBe(false);
    expect(shouldSetVidCookie('/e', 204, '')).toBe(false);
  });

  it('emits a first-party Set-Cookie header', () => {
    expect(vidSetCookie('abc')).toBe(
      'vid=abc; Max-Age=31536000; Path=/; SameSite=Lax; Secure'
    );
  });

  it('treats /e as a beacon path that must not fetch origin', () => {
    expect(isBeaconPath('/e')).toBe(true);
    expect(isBeaconPath('/')).toBe(false);
    expect(isBeaconPath('/e/')).toBe(false);
  });
});
