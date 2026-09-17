import { describe, it, expect } from 'vitest';
import { buildHtml } from './report-email.mjs';

const IPV4 = /\b\d{1,3}(?:\.\d{1,3}){3}\b/;

const data = {
  hours: 168,
  bounds: {
    start: '2026-09-09 16:00:00',
    end: '2026-09-16 16:00:00',
    earliest: '2026-09-16T16:00:00.000Z',
    latest: '2026-09-16T18:00:00.000Z',
  },
  people: {
    unique: 12,
    hits: 20,
    prevUnique: 10,
    delta: 2,
    returning: 4,
    newCount: 8,
    returningPct: 33,
    cloudDroppedUnique: 5,
  },
  capture: {
    rows: 20,
    withCookie: 15,
    withVid: 12,
    withView: 8,
    getOnly: 12,
    cookiePct: 75,
    vidPct: 60,
    viewPct: 40,
    getOnlyPct: 60,
  },
  byLanguage: [
    { language: 'en-US', n: 14 },
    { language: 'de-DE', n: 4 },
  ],
  footnote2xx: { requests: 381, unique_ips: 207, human: 326, bot: 55 },
  byCountryAsOrg: [
    { country: 'US', as_org: 'Comcast Cable', unique: 8, hits: 14 },
    { country: 'DE', as_org: 'Deutsche Telekom', unique: 2, hits: 3 },
  ],
  byDevice: [
    { family: 'Mac', n: 7 },
    { family: 'iPhone', n: 5 },
  ],
  byReferrer: [
    { bucket: 'none', n: 9 },
    { bucket: 'Google', n: 2 },
    { bucket: 'other', n: 1 },
  ],
  byHourEt: [
    { hour: 9, n: 4 },
    { hour: 14, n: 6 },
  ],
  repeats: { one: 8, twoToFour: 3, fivePlus: 1 },
  events: { view: 40, linkedin: 12, mailto: 3, bio: 9, dwell: 30, dwellMedianMs: 18000 },
  noise: { redirects: 12, faviconRobots: 3, probes: 80, cloud2xx: 5 },
  appendix: {
    redirects: [{ path: '/', status: 301, n: 12 }],
    faviconRobots: [{ path: '/favicon.svg', status: 404, n: 3 }],
    probes: [{ path: '/wp-login.php"><script>alert(1)</script>', n: 80 }],
    byStatus: [{ status: 404, n: 40 }],
    byColo: [{ colo: 'EWR', n: 10 }],
  },
};

describe('buildHtml', () => {
  const html = buildHtml({
    periodLabel: 'Weekly',
    runDate: '2026-09-16',
    data,
    canvasName: 'visit-log-weekly-2026-09-16.canvas.tsx',
  });

  it('leads with people, returning share, and previous-window delta', () => {
    expect(html).toMatch(/People this week/i);
    expect(html).toMatch(/>12</);
    expect(html).toMatch(/Returning/);
    expect(html).toMatch(/33%/);
    expect(html).toMatch(/vs last window/i);
    expect(html).toMatch(/\+2/);
  });

  it('includes audience tables and collapsed noise, not unique paths', () => {
    expect(html).toMatch(/Comcast Cable/);
    expect(html).toMatch(/iPhone/);
    expect(html).toMatch(/ET/);
    expect(html).toMatch(/Google/);
    expect(html).toMatch(/www\/http redirects/i);
    expect(html).toMatch(/favicon\/robots/i);
    expect(html).toMatch(/2XX footnote|raw 2XX|2XX requests/i);
    expect(html).not.toMatch(/Unique paths/i);
    expect(html).toMatch(/LinkedIn/);
    expect(html).toMatch(/>12</);
    expect(html).toMatch(/mailto/i);
    expect(html).toMatch(/dwell/i);
    expect(html).toMatch(/18000|18s|18,000/);
    expect(html).toMatch(/Inbound cookie/i);
    expect(html).toMatch(/75%/);
    expect(html).toMatch(/GET-only/i);
    expect(html).toMatch(/JS-on/i);
    expect(html).toMatch(/en-US/);
    expect(html).toMatch(/Accept-Language|language/i);
    expect(html).not.toMatch(/uniqueness|bits of identifying|canvas hash|webgl/i);
  });

  it('HTML-escapes paths and never interpolates raw IPs', () => {
    expect(html).toContain('/wp-login.php&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toMatch(IPV4);
  });
});
