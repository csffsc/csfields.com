const ALWAYS_COLUMNS = [
  'ts',
  'ip',
  'method',
  'url',
  'path',
  'query',
  'status',
  'ua',
  'referer',
  'accept_language',
  'cookie',
  'content_type',
  'body_len',
  'body',
  'country',
  'colo',
  'as_org',
  'tls_version',
  'bot_score',
  'verified_bot',
  'bot_guess',
  'ray',
];

const OPTIONAL_COLUMNS = ['vid', 'dnt', 'sec_gpc', 'accept'];

const OPTIONAL_DEFAULT = '';

/** @type {WeakMap<object, Set<string>>} */
const dbMissingOptional = new WeakMap();

/** @param {unknown} err */
function missingColumnName(err) {
  const parts = [err, err && typeof err === 'object' ? err.message : '', err?.cause, err?.cause?.message];
  const text = parts.map((part) => (part == null ? '' : String(part))).join('\n');
  const match =
    text.match(/no such column:\s*['"]?(\w+)/i) || text.match(/no column named\s+['"]?(\w+)/i);
  return match ? match[1] : '';
}

/** @param {string[]} columns */
function insertSql(columns) {
  const placeholders = columns.map((_, i) => `?${i + 1}`).join(', ');
  return `INSERT INTO visits (${columns.join(', ')}) VALUES (${placeholders})`;
}

function valueFor(visit, column) {
  const value = visit[column];
  if (value == null && OPTIONAL_COLUMNS.includes(column)) return OPTIONAL_DEFAULT;
  return value;
}

/** @param {Set<string>} missing */
function columnsFor(missing) {
  return [...ALWAYS_COLUMNS, ...OPTIONAL_COLUMNS.filter((column) => !missing.has(column))];
}

async function insertRow(db, sql, values) {
  await db.prepare(sql).bind(...values).run();
}

/** @param {import('@cloudflare/workers-types').D1Database | undefined} db */
export async function persistVisit(env, visit) {
  // Workers Logs (7-day retention in dashboard / wrangler tail)
  console.log(JSON.stringify({ type: 'visit', ...visit }));

  if (!env || !env.DB) return;

  const db = env.DB;
  const missing = dbMissingOptional.get(db) ?? new Set();

  for (;;) {
    const columns = columnsFor(missing);
    try {
      await insertRow(
        db,
        insertSql(columns),
        columns.map((column) => valueFor(visit, column))
      );
      dbMissingOptional.set(db, missing);
      return;
    } catch (err) {
      const name = missingColumnName(err);
      if (!OPTIONAL_COLUMNS.includes(name) || !columns.includes(name)) throw err;
      missing.add(name);
      dbMissingOptional.set(db, missing);
    }
  }
}
