const INSERT_WITH_VID = `
  INSERT INTO visits (
    ts, ip, vid, method, url, path, query, status, ua, referer, accept_language,
    cookie, content_type, body_len, body, country, colo, as_org, tls_version,
    bot_score, verified_bot, bot_guess, ray
  ) VALUES (
    ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10,
    ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18,
    ?19, ?20, ?21, ?22, ?23
  )
`;

const INSERT_WITHOUT_VID = `
  INSERT INTO visits (
    ts, ip, method, url, path, query, status, ua, referer, accept_language,
    cookie, content_type, body_len, body, country, colo, as_org, tls_version,
    bot_score, verified_bot, bot_guess, ray
  ) VALUES (
    ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10,
    ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18,
    ?19, ?20, ?21, ?22
  )
`;

/** @type {WeakMap<object, boolean>} */
const dbHasVidColumn = new WeakMap();

/** @param {unknown} err */
function isMissingVidColumn(err) {
  const parts = [err, err && typeof err === 'object' ? err.message : '', err?.cause, err?.cause?.message];
  const text = parts.map((part) => (part == null ? '' : String(part))).join('\n');
  return /no such column:\s*['"]?vid['"]?/i.test(text) || /no column named\s+['"]?vid['"]?/i.test(text);
}

function valuesWithVid(visit) {
  return [
    visit.ts,
    visit.ip,
    visit.vid ?? '',
    visit.method,
    visit.url,
    visit.path,
    visit.query,
    visit.status,
    visit.ua,
    visit.referer,
    visit.accept_language,
    visit.cookie,
    visit.content_type,
    visit.body_len,
    visit.body,
    visit.country,
    visit.colo,
    visit.as_org,
    visit.tls_version,
    visit.bot_score,
    visit.verified_bot,
    visit.bot_guess,
    visit.ray,
  ];
}

function valuesWithoutVid(visit) {
  return [
    visit.ts,
    visit.ip,
    visit.method,
    visit.url,
    visit.path,
    visit.query,
    visit.status,
    visit.ua,
    visit.referer,
    visit.accept_language,
    visit.cookie,
    visit.content_type,
    visit.body_len,
    visit.body,
    visit.country,
    visit.colo,
    visit.as_org,
    visit.tls_version,
    visit.bot_score,
    visit.verified_bot,
    visit.bot_guess,
    visit.ray,
  ];
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
  if (dbHasVidColumn.get(db) === false) {
    await insertRow(db, INSERT_WITHOUT_VID, valuesWithoutVid(visit));
    return;
  }

  try {
    await insertRow(db, INSERT_WITH_VID, valuesWithVid(visit));
    dbHasVidColumn.set(db, true);
  } catch (err) {
    if (!isMissingVidColumn(err)) throw err;
    dbHasVidColumn.set(db, false);
    await insertRow(db, INSERT_WITHOUT_VID, valuesWithoutVid(visit));
  }
}
