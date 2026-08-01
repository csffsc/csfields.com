const INSERT = `
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

/** @param {import('@cloudflare/workers-types').D1Database | undefined} db */
export async function persistVisit(env, visit) {
  // Workers Logs (7-day retention in dashboard / wrangler tail)
  console.log(JSON.stringify({ type: 'visit', ...visit }));

  if (!env || !env.DB) return;

  await env.DB.prepare(INSERT)
    .bind(
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
      visit.ray
    )
    .run();
}
