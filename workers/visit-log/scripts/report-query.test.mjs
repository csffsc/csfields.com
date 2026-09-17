import { describe, it, expect } from 'vitest';
import { PEOPLE_SQL } from './people-filter.mjs';
import { assembleReport, buildReportQueries, previousWindowClause } from './report-query.mjs';

const MAC_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15';
const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1';

const IPV4 = /\b\d{1,3}(?:\.\d{1,3}){3}\b/;

function assembledFixture() {
  return assembleReport({
    hours: 168,
    bounds: {
      start: '2026-09-09 16:00:00',
      end: '2026-09-16 16:00:00',
      prev_start: '2026-09-02 16:00:00',
    },
    peopleCandidates: [
      {
        ip: '203.0.113.1',
        as_org: 'Comcast Cable',
        country: 'US',
        referer: '',
        ua: MAC_UA,
        ts: '2026-09-16T16:00:00.000Z',
      },
      {
        ip: '203.0.113.1',
        as_org: 'Comcast Cable',
        country: 'US',
        referer: 'https://www.google.com/',
        ua: MAC_UA,
        ts: '2026-09-16T17:00:00.000Z',
      },
      {
        ip: '203.0.113.2',
        as_org: 'DigitalOcean, LLC',
        country: 'US',
        referer: '',
        ua: MAC_UA,
        ts: '2026-09-16T16:30:00.000Z',
      },
      {
        ip: '203.0.113.3',
        as_org: 'Verizon',
        country: 'GB',
        referer: 'https://news.ycombinator.com/',
        ua: IPHONE_UA,
        ts: '2026-09-16T18:00:00.000Z',
      },
    ],
    prevPeopleCandidates: [
      {
        ip: '198.51.100.9',
        as_org: 'Comcast Cable',
        country: 'US',
        referer: '',
        ua: MAC_UA,
        ts: '2026-09-08T16:00:00.000Z',
      },
    ],
    firstSeen: [
      { ip: '203.0.113.1', first_seen: '2026-08-01 00:00:00' },
      { ip: '203.0.113.2', first_seen: '2026-09-16T16:30:00.000Z' },
      { ip: '203.0.113.3', first_seen: '2026-09-16T18:00:00.000Z' },
    ],
    eventRows: [
      { query: 'n=view' },
      { query: 'n=view' },
      { query: 'n=linkedin' },
      { query: 'n=mailto' },
      { query: 'n=bio' },
      { query: 'n=dwell&ms=1200' },
      { query: 'n=dwell&ms=4000' },
      { query: 'n=dwell&ms=2500' },
    ],
    totals2xx: { requests: 381, unique_ips: 207, human: 326, bot: 55 },
    byColo: [{ colo: 'EWR', n: 10 }],
    byStatus: [{ status: 404, n: 40 }],
    redirects: [{ path: '/', status: 301, n: 12 }],
    faviconRobots: [{ path: '/favicon.svg', status: 404, n: 3 }],
    probes: [{ path: '/.env', n: 80 }],
    redirectTotal: 12,
    faviconRobotsTotal: 3,
    probeTotal: 80,
  });
}

describe('buildReportQueries', () => {
  it('uses the shared people predicate and a previous-window clause', () => {
    const queries = buildReportQueries(168);
    expect(queries.peopleCandidates).toContain(PEOPLE_SQL);
    expect(queries.prevPeopleCandidates).toContain(PEOPLE_SQL);
    expect(queries.prevPeopleCandidates).toContain(previousWindowClause(168));
    expect(queries.firstSeen).toContain(PEOPLE_SQL);
    expect(queries.totals2xx).toContain('status BETWEEN 200 AND 299');
    expect(queries.eventRows).toMatch(/path = '\/e'/);
    expect(queries.peopleCandidates).not.toMatch(/path = '\/e'/);
  });

  it('can omit vid from people SQL before the D1 migration', () => {
    const queries = buildReportQueries(168, { includeVid: false });
    expect(queries.peopleCandidates).not.toMatch(/\bvid\b/);
    expect(queries.firstSeen).toMatch(/GROUP BY ip/);
    expect(queries.eventRows).toMatch(/path = '\/e'/);
  });

  it('does not query unused capture columns', () => {
    const sql = Object.values(buildReportQueries(168)).join('\n');
    expect(sql).not.toMatch(/with_cookie/);
    expect(sql).not.toMatch(/capture/i);
  });

  it('excludes /e beacons from 2XX footnote, colo rollup, and probe filters', () => {
    const queries = buildReportQueries(168);
    expect(queries.totals2xx).toMatch(/path != '\/e'/);
    expect(queries.byColo).toMatch(/path != '\/e'/);
    expect(queries.probes).toMatch(/path != '\/e'/);
    expect(queries.probeTotal).toMatch(/path != '\/e'/);
    expect(queries.eventRows).toMatch(/path = '\/e'/);
  });

  it('splits appendix into redirects, favicon/robots, and real probes', () => {
    const queries = buildReportQueries(168);
    expect(queries.redirects).toMatch(/status BETWEEN 300 AND 399/);
    expect(queries.faviconRobots).toMatch(/favicon/);
    expect(queries.probes).toMatch(/\.php/);
    expect(queries.probes).toMatch(/\/wp-/);
  });
});

describe('assembleReport', () => {
  it('headlines unique people IPs after dropping cloud AS orgs', () => {
    const data = assembledFixture();
    expect(data.people.unique).toBe(2);
    expect(data.people.hits).toBe(3);
    expect(data.people.cloudDroppedUnique).toBe(1);
    expect(data.people.prevUnique).toBe(1);
    expect(data.people.delta).toBe(1);
  });

  it('counts returning IPs first seen before the window', () => {
    const data = assembledFixture();
    expect(data.people.returning).toBe(1);
    expect(data.people.newCount).toBe(1);
    expect(data.people.returningPct).toBe(50);
  });

  it('buckets repeat hits on people rows only (not 301+200 pairs)', () => {
    const data = assembledFixture();
    expect(data.repeats).toEqual({ one: 1, twoToFour: 1, fivePlus: 0 });
  });

  it('rolls up country × AS org, device, referrer, and Eastern hour', () => {
    const data = assembledFixture();
    expect(data.byCountryAsOrg).toEqual([
      { country: 'US', as_org: 'Comcast Cable', unique: 1, hits: 2 },
      { country: 'GB', as_org: 'Verizon', unique: 1, hits: 1 },
    ]);
    expect(data.byDevice).toEqual([
      { family: 'Mac', n: 1 },
      { family: 'iPhone', n: 1 },
    ]);
    expect(data.byReferrer).toEqual([
      { bucket: 'none', n: 1 },
      { bucket: 'other', n: 1 },
    ]);
    const byHour = Object.fromEntries(data.byHourEt.map((r) => [r.hour, r.n]));
    expect(byHour[12]).toBe(1);
    expect(byHour[13]).toBe(1);
    expect(byHour[14]).toBe(1);
  });

  it('keeps raw 2XX as a footnote and does not expose unique_paths or IPs', () => {
    const data = assembledFixture();
    expect(data.footnote2xx.requests).toBe(381);
    expect(data.footnote2xx.unique_ips).toBe(207);
    expect(data).not.toHaveProperty('totals.unique_paths');
    expect(JSON.stringify(data)).not.toMatch(IPV4);
  });

  it('collapses noise into redirect / favicon / probe buckets', () => {
    const data = assembledFixture();
    expect(data.noise).toEqual({
      redirects: 12,
      faviconRobots: 3,
      probes: 80,
      cloud2xx: 1,
    });
    expect(data.appendix.redirects[0].path).toBe('/');
    expect(data.appendix.faviconRobots[0].path).toBe('/favicon.svg');
    expect(data.appendix.probes[0].path).toBe('/.env');
    expect(data.appendix.byColo[0].colo).toBe('EWR');
  });

  it('counts /e beacons without using them as the people headline', () => {
    const data = assembledFixture();
    expect(data.people.unique).toBe(2);
    expect(data.events).toEqual({
      view: 2,
      linkedin: 1,
      mailto: 1,
      bio: 1,
      dwell: 3,
      dwellMedianMs: 2500,
    });
  });

  it('treats the same vid as one person even when IPs differ', () => {
    const data = assembleReport({
      hours: 168,
      bounds: { start: '2026-09-09 16:00:00', end: '2026-09-16 16:00:00' },
      peopleCandidates: [
        {
          ip: '203.0.113.10',
          vid: 'same-person',
          as_org: 'Comcast Cable',
          country: 'US',
          referer: '',
          ua: MAC_UA,
          ts: '2026-09-16T16:00:00.000Z',
        },
        {
          ip: '198.51.100.10',
          vid: 'same-person',
          as_org: 'Comcast Cable',
          country: 'US',
          referer: '',
          ua: MAC_UA,
          ts: '2026-09-16T17:00:00.000Z',
        },
      ],
      firstSeen: [
        { ip: '203.0.113.10', vid: 'same-person', first_seen: '2026-09-16T16:00:00.000Z' },
      ],
      totals2xx: { requests: 2, unique_ips: 2, human: 2, bot: 0 },
    });
    expect(data.people.unique).toBe(1);
    expect(data.repeats).toEqual({ one: 0, twoToFour: 1, fivePlus: 0 });
    expect(JSON.stringify(data)).not.toMatch(IPV4);
  });

  it('joins historical IP-only people rows to a later vid from the same IP', () => {
    const data = assembleReport({
      hours: 168,
      bounds: { start: '2026-09-09 16:00:00', end: '2026-09-16 16:00:00' },
      peopleCandidates: [
        {
          ip: '203.0.113.40',
          vid: '',
          as_org: 'Comcast Cable',
          country: 'US',
          referer: '',
          ua: MAC_UA,
          ts: '2026-09-10T16:00:00.000Z',
        },
        {
          ip: '203.0.113.40',
          vid: 'cookie-1',
          as_org: 'Comcast Cable',
          country: 'US',
          referer: '',
          ua: MAC_UA,
          ts: '2026-09-16T16:00:00.000Z',
        },
      ],
      firstSeen: [
        { ip: '203.0.113.40', vid: '', first_seen: '2026-08-01 00:00:00' },
        { ip: '203.0.113.40', vid: 'cookie-1', first_seen: '2026-09-16T16:00:00.000Z' },
      ],
      totals2xx: { requests: 2, unique_ips: 1, human: 2, bot: 0 },
    });
    expect(data.people.unique).toBe(1);
    expect(data.people.hits).toBe(2);
    expect(data.people.returning).toBe(1);
    expect(data.people.newCount).toBe(0);
    expect(data.repeats).toEqual({ one: 0, twoToFour: 1, fivePlus: 0 });
    expect(JSON.stringify(data)).not.toMatch(IPV4);
  });

  it('does not alias an IP-only visitor from an unaggregated firstSeen ip on someone else\'s vid', () => {
    const data = assembleReport({
      hours: 168,
      bounds: { start: '2026-09-09 16:00:00', end: '2026-09-16 16:00:00' },
      peopleCandidates: [
        {
          ip: '203.0.113.40',
          vid: '',
          as_org: 'Comcast Cable',
          country: 'US',
          referer: '',
          ua: MAC_UA,
          ts: '2026-09-16T16:00:00.000Z',
        },
        {
          ip: '198.51.100.10',
          vid: 'cookie-1',
          as_org: 'Verizon',
          country: 'US',
          referer: '',
          ua: MAC_UA,
          ts: '2026-09-16T17:00:00.000Z',
        },
      ],
      firstSeen: [
        {
          ip: '203.0.113.40',
          vid: 'cookie-1',
          first_seen: '2026-08-01 00:00:00',
        },
      ],
      totals2xx: { requests: 2, unique_ips: 2, human: 2, bot: 0 },
    });
    expect(data.people.unique).toBe(2);
    expect(data.people.returning).toBe(1);
    expect(data.people.newCount).toBe(1);
    expect(JSON.stringify(data)).not.toMatch(IPV4);
  });
});
