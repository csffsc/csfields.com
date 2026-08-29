import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

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
 */
export function fetchReportData(hours) {
  const w = windowClause(hours);
  const w2xx = `${w} AND status BETWEEN 200 AND 299`;

  const totals = d1Query(
    `SELECT COUNT(*) AS requests, COUNT(DISTINCT ip) AS unique_ips, COUNT(DISTINCT path) AS unique_paths,
            SUM(CASE WHEN bot_guess = 0 THEN 1 ELSE 0 END) AS human,
            SUM(CASE WHEN bot_guess = 1 THEN 1 ELSE 0 END) AS bot
     FROM visits WHERE ${w2xx}`
  )[0];

  const bounds = d1Query(
    `SELECT MIN(ts) AS earliest, MAX(ts) AS latest FROM visits WHERE ${w2xx}`
  )[0];

  const byCountry = d1Query(
    `SELECT country, COUNT(*) AS n FROM visits WHERE ${w2xx}
     GROUP BY country ORDER BY n DESC LIMIT 15`
  );

  const byColo = d1Query(
    `SELECT colo, COUNT(*) AS n FROM visits WHERE ${w2xx}
     GROUP BY colo ORDER BY n DESC LIMIT 10`
  );

  const byPath = d1Query(
    `SELECT path, COUNT(*) AS n FROM visits WHERE ${w2xx}
     GROUP BY path ORDER BY n DESC LIMIT 15`
  );

  const capture = d1Query(
    `SELECT SUM(CASE WHEN cookie IS NOT NULL AND cookie != '' THEN 1 ELSE 0 END) AS with_cookie,
            SUM(CASE WHEN body IS NOT NULL AND body != '' THEN 1 ELSE 0 END) AS with_body,
            SUM(CASE WHEN query IS NOT NULL AND query != '' THEN 1 ELSE 0 END) AS with_query,
            COUNT(*) AS total
     FROM visits WHERE ${w2xx}`
  )[0];

  const probeFilter = `${w} AND (
    status IS NULL OR status < 200 OR status >= 300
    OR bot_guess = 1 OR path LIKE '%.php%' OR path LIKE '/wp-%'
  )`;

  const probeTotals = d1Query(
    `SELECT COUNT(*) AS n FROM visits WHERE ${probeFilter}`
  )[0];

  const byStatus = d1Query(
    `SELECT status, COUNT(*) AS n FROM visits WHERE ${probeFilter}
     GROUP BY status ORDER BY n DESC LIMIT 15`
  );

  const probePaths = d1Query(
    `SELECT path, COUNT(*) AS n FROM visits WHERE ${probeFilter}
     GROUP BY path ORDER BY n DESC LIMIT 15`
  );

  return {
    hours,
    totals,
    bounds,
    byCountry,
    byColo,
    byPath,
    capture,
    appendix: {
      probeTotals,
      byStatus,
      probePaths,
    },
  };
}
