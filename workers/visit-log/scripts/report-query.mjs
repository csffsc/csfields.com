import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PEOPLE_SQL,
  deviceFamily,
  hourInEastern,
  isCloudAsOrg,
  median,
  parseEventQuery,
  parseVisitTs,
  referrerBucket,
  visitorKey,
} from './people-filter.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const FAVICON_ROBOTS_PATHS = [
  '/favicon.ico',
  '/favicon.svg',
  '/apple-touch-icon.png',
  '/apple-touch-icon-precomposed.png',
  '/robots.txt',
  '/sitemap.xml',
];

const FAVICON_ROBOTS_SQL = FAVICON_ROBOTS_PATHS.map((p) => `'${p}'`).join(', ');

/** @param {string} sql */
export function d1Query(sql) {
  const result = spawnSync(
    'npx',
    ['wrangler', 'd1', 'execute', 'visit-log-db', '--remote', '--json', '--command', sql],
    { cwd: ROOT, encoding: 'utf8', env: process.env }
  );

  if (result.status !== 0) {
    const err = result.stderr || result.stdout || 'wrangler d1 execute failed';
    throw new Error(String(err).trim());
  }

  /** @type {Array<{ results?: unknown[], success?: boolean }>} */
  const parsed = JSON.parse(result.stdout);
  const block = parsed[0];
  if (!block?.success) {
    throw new Error(`D1 query failed: ${sql.slice(0, 120)}…`);
  }
  return block.results ?? [];
}

/**
 * @param {number} hours
 * @returns {string}
 */
export function windowClause(hours) {
  return `ts >= datetime('now', '-${hours} hours')`;
}

/**
 * @param {number} hours
 * @returns {string}
 */
export function previousWindowClause(hours) {
  return `ts >= datetime('now', '-${hours * 2} hours') AND ts < datetime('now', '-${hours} hours')`;
}

function probeWhere(windowSql) {
  return `${windowSql}
    AND path NOT IN (${FAVICON_ROBOTS_SQL})
    AND (status IS NULL OR status < 200 OR status >= 400 OR bot_guess = 1
         OR path LIKE '%.php%' OR path LIKE '/wp-%' OR path LIKE '%.env%')
    AND (status IS NULL OR status < 300 OR status >= 400)`;
}

/**
 * @param {number} hours
 * @param {{ includeVid?: boolean }} [opts]
 */
export function buildReportQueries(hours, opts = {}) {
  const includeVid = opts.includeVid !== false;
  const visitorCols = includeVid ? 'ip, vid' : 'ip';
  const w = windowClause(hours);
  const prev = previousWindowClause(hours);
  const peopleWindow = `${w} AND ${PEOPLE_SQL}`;
  const prevPeople = `${prev} AND ${PEOPLE_SQL}`;
  const firstSeen = includeVid
    ? `SELECT ip, vid, MIN(ts) AS first_seen
       FROM visits
       WHERE ${PEOPLE_SQL}
         AND (
           ip IN (SELECT DISTINCT ip FROM visits WHERE ${peopleWindow})
           OR (
             vid IS NOT NULL AND vid != ''
             AND vid IN (
               SELECT DISTINCT vid FROM visits
               WHERE ${peopleWindow} AND vid IS NOT NULL AND vid != ''
             )
           )
         )
       GROUP BY COALESCE(NULLIF(vid, ''), ip)`
    : `SELECT ip, MIN(ts) AS first_seen
       FROM visits
       WHERE ${PEOPLE_SQL}
         AND ip IN (SELECT DISTINCT ip FROM visits WHERE ${peopleWindow})
       GROUP BY ip`;

  return {
    bounds: `SELECT datetime('now', '-${hours} hours') AS start,
                    datetime('now') AS end,
                    datetime('now', '-${hours * 2} hours') AS prev_start`,
    peopleCandidates: `SELECT ${visitorCols}, as_org, country, referer, ua, ts
       FROM visits WHERE ${peopleWindow}`,
    prevPeopleCandidates: `SELECT ${visitorCols}, as_org, country, referer, ua, ts
       FROM visits WHERE ${prevPeople}`,
    firstSeen,
    eventRows: `SELECT query FROM visits WHERE ${w} AND path = '/e'`,
    totals2xx: `SELECT COUNT(*) AS requests, COUNT(DISTINCT ip) AS unique_ips,
            SUM(CASE WHEN bot_guess = 0 THEN 1 ELSE 0 END) AS human,
            SUM(CASE WHEN bot_guess = 1 THEN 1 ELSE 0 END) AS bot
     FROM visits WHERE ${w} AND status BETWEEN 200 AND 299`,
    byColo: `SELECT colo, COUNT(*) AS n FROM visits
     WHERE ${w} AND status BETWEEN 200 AND 299
     GROUP BY colo ORDER BY n DESC LIMIT 10`,
    byStatus: `SELECT status, COUNT(*) AS n FROM visits
     WHERE ${w} AND (status IS NULL OR status < 200 OR status >= 300 OR bot_guess = 1)
     GROUP BY status ORDER BY n DESC LIMIT 15`,
    redirects: `SELECT path, status, COUNT(*) AS n FROM visits
     WHERE ${w} AND status BETWEEN 300 AND 399
     GROUP BY path, status ORDER BY n DESC LIMIT 15`,
    redirectTotal: `SELECT COUNT(*) AS n FROM visits
     WHERE ${w} AND status BETWEEN 300 AND 399`,
    faviconRobots: `SELECT path, status, COUNT(*) AS n FROM visits
     WHERE ${w} AND path IN (${FAVICON_ROBOTS_SQL})
     GROUP BY path, status ORDER BY n DESC LIMIT 15`,
    faviconRobotsTotal: `SELECT COUNT(*) AS n FROM visits
     WHERE ${w} AND path IN (${FAVICON_ROBOTS_SQL})`,
    probes: `SELECT path, COUNT(*) AS n FROM visits
     WHERE ${probeWhere(w)}
     GROUP BY path ORDER BY n DESC LIMIT 15`,
    probeTotal: `SELECT COUNT(*) AS n FROM visits WHERE ${probeWhere(w)}`,
  };
}

/** @param {string | null | undefined} ts */
function tsMillis(ts) {
  const date = parseVisitTs(ts);
  return date ? date.getTime() : null;
}

function uniqueKeys(rows) {
  const set = new Set();
  for (const row of rows) {
    const key = visitorKey(row);
    if (key) set.add(key);
  }
  return set;
}

function countMapToList(map, keyName) {
  return [...map.entries()]
    .map(([key, n]) => ({ [keyName]: key, n }))
    .sort((a, b) => b.n - a.n);
}

function countEvents(eventRows) {
  const counts = { view: 0, linkedin: 0, mailto: 0, bio: 0, dwell: 0 };
  const dwellMs = [];
  for (const row of eventRows ?? []) {
    const parsed = parseEventQuery(row.query);
    if (parsed.name in counts) counts[parsed.name] += 1;
    if (parsed.name === 'dwell' && parsed.ms != null) dwellMs.push(parsed.ms);
  }
  return { ...counts, dwellMedianMs: median(dwellMs) };
}

/**
 * @param {{
 *   hours: number,
 *   bounds: { start?: string, end?: string, prev_start?: string },
 *   peopleCandidates?: object[],
 *   prevPeopleCandidates?: object[],
 *   firstSeen?: { ip: string, first_seen: string }[],
 *   totals2xx?: object,
 *   byColo?: object[],
 *   byStatus?: object[],
 *   redirects?: object[],
 *   faviconRobots?: object[],
 *   probes?: object[],
 *   redirectTotal?: number,
 *   faviconRobotsTotal?: number,
 *   probeTotal?: number,
 * }} input
 */
export function assembleReport(input) {
  const people = (input.peopleCandidates ?? []).filter((row) => !isCloudAsOrg(row.as_org));
  const cloud = (input.peopleCandidates ?? []).filter((row) => isCloudAsOrg(row.as_org));
  const prevPeople = (input.prevPeopleCandidates ?? []).filter(
    (row) => !isCloudAsOrg(row.as_org)
  );

  const windowStartMs = tsMillis(input.bounds?.start);
  const firstSeenMap = new Map();
  for (const row of input.firstSeen ?? []) {
    const key = visitorKey(row);
    if (key) firstSeenMap.set(key, row.first_seen);
  }

  const sortedPeople = [...people].sort((a, b) => (tsMillis(a.ts) ?? 0) - (tsMillis(b.ts) ?? 0));
  const firstByVisitor = new Map();
  const hitsByVisitor = new Map();
  const countryAs = new Map();
  const countryAsVisitors = new Set();
  for (const row of sortedPeople) {
    const key = visitorKey(row) || `row:${firstByVisitor.size}`;
    hitsByVisitor.set(key, (hitsByVisitor.get(key) || 0) + 1);
    if (!firstByVisitor.has(key)) firstByVisitor.set(key, row);

    const asKey = `${row.country ?? ''}\0${row.as_org ?? ''}`;
    let rec = countryAs.get(asKey);
    if (!rec) {
      rec = { country: row.country || '', as_org: row.as_org || '', unique: 0, hits: 0 };
      countryAs.set(asKey, rec);
    }
    rec.hits += 1;
    const visitorAsKey = `${asKey}\0${key}`;
    if (!countryAsVisitors.has(visitorAsKey)) {
      countryAsVisitors.add(visitorAsKey);
      rec.unique += 1;
    }
  }

  let returning = 0;
  let newCount = 0;
  for (const key of firstByVisitor.keys()) {
    const firstMs = tsMillis(firstSeenMap.get(key));
    if (firstMs != null && windowStartMs != null && firstMs < windowStartMs) returning += 1;
    else newCount += 1;
  }

  const unique = firstByVisitor.size;
  const prevUnique = uniqueKeys(prevPeople).size;
  const returningPct = unique ? Math.round((returning / unique) * 100) : 0;

  let one = 0;
  let twoToFour = 0;
  let fivePlus = 0;
  for (const n of hitsByVisitor.values()) {
    if (n === 1) one += 1;
    else if (n <= 4) twoToFour += 1;
    else fivePlus += 1;
  }

  const byCountryAsOrg = [...countryAs.values()].sort((a, b) => b.unique - a.unique || b.hits - a.hits);

  const deviceCounts = new Map();
  const referrerCounts = new Map();
  for (const row of firstByVisitor.values()) {
    const family = deviceFamily(row.ua);
    deviceCounts.set(family, (deviceCounts.get(family) || 0) + 1);
    const bucket = referrerBucket(row.referer);
    referrerCounts.set(bucket, (referrerCounts.get(bucket) || 0) + 1);
  }

  const hourCounts = new Map();
  let earliestMs = null;
  let latestMs = null;
  let earliestTs = null;
  let latestTs = null;
  for (const row of people) {
    const hour = hourInEastern(row.ts);
    if (hour != null) hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
    const ms = tsMillis(row.ts);
    if (ms == null) continue;
    if (earliestMs == null || ms < earliestMs) {
      earliestMs = ms;
      earliestTs = row.ts;
    }
    if (latestMs == null || ms > latestMs) {
      latestMs = ms;
      latestTs = row.ts;
    }
  }

  return {
    hours: input.hours,
    bounds: {
      start: input.bounds?.start,
      end: input.bounds?.end,
      earliest: earliestTs,
      latest: latestTs,
    },
    people: {
      unique,
      hits: people.length,
      prevUnique,
      delta: unique - prevUnique,
      returning,
      newCount,
      returningPct,
      cloudDroppedUnique: uniqueKeys(cloud).size,
    },
    footnote2xx: {
      requests: Number(input.totals2xx?.requests ?? 0),
      unique_ips: Number(input.totals2xx?.unique_ips ?? 0),
      human: Number(input.totals2xx?.human ?? 0),
      bot: Number(input.totals2xx?.bot ?? 0),
    },
    byCountryAsOrg,
    byDevice: countMapToList(deviceCounts, 'family'),
    byReferrer: countMapToList(referrerCounts, 'bucket'),
    byHourEt: countMapToList(hourCounts, 'hour'),
    repeats: { one, twoToFour, fivePlus },
    noise: {
      redirects: Number(input.redirectTotal ?? 0),
      faviconRobots: Number(input.faviconRobotsTotal ?? 0),
      probes: Number(input.probeTotal ?? 0),
      cloud2xx: uniqueKeys(cloud).size,
    },
    events: countEvents(input.eventRows),
    appendix: {
      redirects: input.redirects ?? [],
      faviconRobots: input.faviconRobots ?? [],
      probes: input.probes ?? [],
      byStatus: input.byStatus ?? [],
      byColo: input.byColo ?? [],
    },
  };
}

export function tableHasVid(queryFn = d1Query) {
  const cols = queryFn('PRAGMA table_info(visits)');
  return cols.some((col) => col.name === 'vid');
}

/**
 * @param {number} hours
 * @param {(sql: string) => unknown[]} [queryFn]
 */
export function fetchReportData(hours, queryFn = d1Query) {
  const q = buildReportQueries(hours, { includeVid: tableHasVid(queryFn) });
  const bounds = queryFn(q.bounds)[0] ?? {};
  return assembleReport({
    hours,
    bounds,
    peopleCandidates: queryFn(q.peopleCandidates),
    prevPeopleCandidates: queryFn(q.prevPeopleCandidates),
    firstSeen: queryFn(q.firstSeen),
    eventRows: queryFn(q.eventRows),
    totals2xx: queryFn(q.totals2xx)[0] ?? {},
    byColo: queryFn(q.byColo),
    byStatus: queryFn(q.byStatus),
    redirects: queryFn(q.redirects),
    faviconRobots: queryFn(q.faviconRobots),
    probes: queryFn(q.probes),
    redirectTotal: Number(queryFn(q.redirectTotal)[0]?.n ?? 0),
    faviconRobotsTotal: Number(queryFn(q.faviconRobotsTotal)[0]?.n ?? 0),
    probeTotal: Number(queryFn(q.probeTotal)[0]?.n ?? 0),
  });
}
