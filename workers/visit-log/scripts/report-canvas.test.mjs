import { describe, it, expect } from 'vitest';
import { renderCanvasSource } from './report-canvas.mjs';

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
  footnote2xx: { requests: 381, unique_ips: 207, human: 326, bot: 55 },
  byCountryAsOrg: [{ country: 'US', as_org: 'Comcast Cable', unique: 8, hits: 14 }],
  byDevice: [{ family: 'Mac', n: 7 }],
  byReferrer: [{ bucket: 'none', n: 9 }],
  byHourEt: [{ hour: 9, n: 4 }],
  repeats: { one: 8, twoToFour: 3, fivePlus: 1 },
  noise: { redirects: 12, faviconRobots: 3, probes: 80, cloud2xx: 5 },
  appendix: {
    redirects: [{ path: '/', status: 301, n: 12 }],
    faviconRobots: [{ path: '/favicon.svg', status: 404, n: 3 }],
    probes: [{ path: '/.env', n: 80 }],
    byStatus: [{ status: 404, n: 40 }],
    byColo: [{ colo: 'EWR', n: 10 }],
  },
};

describe('renderCanvasSource', () => {
  const source = renderCanvasSource({
    periodSlug: 'weekly',
    periodLabel: 'Weekly',
    runDate: '2026-09-16',
    hours: 168,
    data,
  });

  it('shows the same people audience tables as email', () => {
    expect(source).toMatch(/People this week/i);
    expect(source).toMatch(/returning/i);
    expect(source).toMatch(/Comcast Cable/);
    expect(source).toMatch(/byDevice|Device/);
    expect(source).toMatch(/Hour/);
    expect(source).toMatch(/Referrer|arrived/i);
    expect(source).toMatch(/2–4|2-4/);
  });

  it('keeps colo, status, and split probe tables underneath', () => {
    expect(source).toMatch(/EWR/);
    expect(source).toMatch(/404/);
    expect(source).toMatch(/favicon\.svg/);
    expect(source).toMatch(/\.env/);
    expect(source).toMatch(/301/);
  });

  it('does not embed raw IPs', () => {
    expect(source).not.toMatch(IPV4);
  });
});
