const BOT_UA =
  /(bot|crawl|spider|slurp|facebookexternalhit|pingdom|preview|wget|curl|python-requests|go-http-client|scrapy|headless)/i;

const SCRIPT_EXT = /\.(php|asp|aspx|jsp|cgi)$/i;
const PROBE_PATH =
  /\/wp-|\/wordpress(?:\/|$)|\/xmlrpc\.php|\/\.env|\/\.git|\/\.aws|\/config\.json|\/\.well-known\/|\/vendor\/|\/phpmyadmin|\/administrator|\/shell|\/cgi-bin\//i;

const BENIGN_404 = new Set([
  '/favicon.ico',
  '/apple-touch-icon.png',
  '/apple-touch-icon-precomposed.png',
  '/robots.txt',
  '/sitemap.xml',
]);

const MAX_BODY_CHARS = 8192;

export function guessBot(ua) {
  if (!ua) return 1;
  return BOT_UA.test(ua) ? 1 : 0;
}

export function guessBotVisit(ua, path, status) {
  if (guessBot(ua)) return 1;
  if (SCRIPT_EXT.test(path) || PROBE_PATH.test(path)) return 1;
  if (status === 404 && !BENIGN_404.has(path)) return 1;
  return 0;
}

/**
 * @param {Request} request
 * @param {{ status: number|null, bodyText: string|null, bodyLen: number|null, ts?: string }} responseBits
 */
export async function extractVisit(request, responseBits) {
  const url = new URL(request.url);
  const ua = request.headers.get('User-Agent') || '';
  const cf = request.cf || {};
  const bm = cf.botManagement;

  let body = responseBits.bodyText;
  const bodyLen =
    responseBits.bodyLen == null ? null : Number(responseBits.bodyLen);
  if (body != null && body.length > MAX_BODY_CHARS) body = null;

  return {
    ts: responseBits.ts || new Date().toISOString(),
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
    // bot_score is always null on the free plan (Bot Management not enabled)
    bot_score: bm && typeof bm.score === 'number' ? bm.score : null,
    verified_bot:
      bm && typeof bm.verifiedBot === 'boolean' ? (bm.verifiedBot ? 1 : 0) : null,
    bot_guess: guessBotVisit(ua, url.pathname, responseBits.status),
    ray: request.headers.get('CF-Ray') || '',
  };
}
