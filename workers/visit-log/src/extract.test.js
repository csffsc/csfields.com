import { describe, it, expect } from 'vitest';
import { extractVisit, guessBot } from './extract.js';

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
    expect(
      guessBot(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
      )
    ).toBe(0);
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
    expect(visit.cookie).toBe('a=1; b=2');
    expect(visit.content_type).toBe('application/json');
    expect(visit.body).toBe('{"probe":true}');
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
});
