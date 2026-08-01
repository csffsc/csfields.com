const BOT_UA =
  /(bot|crawl|spider|slurp|facebookexternalhit|pingdom|preview|wget|curl|python-requests|go-http-client|scrapy|headless)/i;

const MAX_BODY_CHARS = 8192;

export function guessBot(ua) {
  if (!ua) return 1;
  return BOT_UA.test(ua) ? 1 : 0;
}

/**
 * @param {Request} request
 * @param {{ status: number|null, bodyText: string|null, bodyLen: number|null }} responseBits
 */
export async function extractVisit(request, responseBits) {
  const url = new URL(request.url);
  const ua = request.headers.get('User-Agent') || '';
  const cf = request.cf || {};
  const bm = cf.botManagement || {};

  let body = responseBits.bodyText;
  const bodyLen =
    responseBits.bodyLen == null ? null : Number(responseBits.bodyLen);
  if (body != null && body.length > MAX_BODY_CHARS) body = null;

  return {
    ts: new Date().toISOString(),
    ip: request.headers.get('CF-Connecting-IP') || '',
    method: request.method,
    url: url.href,
    path: url.pathname,
    query: url.search ? url.search.slice(1) : '',
    status: responseBits.status,
    ua,
    referer: request.headers.get('Referer') || '',
    accept_language: request.headers.get('Accept-Language') || '',
    cookie: request.headers.get('Cookie') || '',
    content_type: request.headers.get('Content-Type') || '',
    body_len: bodyLen,
    body,
    country: cf.country || '',
    colo: cf.colo || '',
    as_org: cf.asOrganization || '',
    tls_version: cf.tlsVersion || '',
    bot_score: typeof bm.score === 'number' ? bm.score : null,
    verified_bot: bm.verifiedBot ? 1 : 0,
    bot_guess: guessBot(ua),
    ray: request.headers.get('CF-Ray') || '',
  };
}
