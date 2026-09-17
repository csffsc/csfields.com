const CLOUD_AS_ORG_NEEDLES = [
  'amazon',
  'aws',
  'google',
  'microsoft',
  'azure',
  'digitalocean',
  'tencent',
  'alibaba',
  'ovh',
  'hetzner',
  'linode',
  'akamai',
  'oracle',
  'vultr',
  'leaseweb',
  'fastly',
  'github',
  'hostinger',
  'm247',
  'datacamp',
  'choopa',
];

const SELF_HOSTS = new Set(['csfields.com', 'www.csfields.com']);

/** People row shared with SQL: status 200 on `/` and not bot_guess. Cloud AS orgs are dropped in JS. */
export const PEOPLE_SQL = `status = 200 AND path = '/' AND bot_guess = 0`;

/** @param {object | null | undefined} row */
function rowTimeMs(row) {
  return parseVisitTs(row?.ts)?.getTime() ?? parseVisitTs(row?.first_seen)?.getTime() ?? 0;
}

/**
 * Map IP → later vid seen on that IP so historical IP-only rows join cookied visits.
 * @param {object[] | null | undefined} rows
 * @returns {Map<string, string>}
 */
export function ipToVidFromRows(rows) {
  const map = new Map();
  const sorted = [...(rows ?? [])].sort((a, b) => rowTimeMs(a) - rowTimeMs(b));
  for (const row of sorted) {
    const vid = row?.vid == null ? '' : String(row.vid);
    const ip = row?.ip == null ? '' : String(row.ip);
    if (vid === '' || ip === '') continue;
    map.set(ip, vid);
  }
  return map;
}

/** @param {object} row @param {Map<string, string>} [ipToVid] */
export function visitorKey(row, ipToVid) {
  const vid = row?.vid == null ? '' : String(row.vid);
  if (vid !== '') return `vid:${vid}`;
  const ip = row?.ip == null ? '' : String(row.ip);
  if (ip === '') return '';
  const linked = ipToVid?.get(ip);
  if (linked) return `vid:${linked}`;
  return `ip:${ip}`;
}

/** @param {string | null | undefined} query */
export function parseEventQuery(query) {
  const params = new URLSearchParams(query || '');
  const name = params.get('n') || '';
  const msRaw = params.get('ms');
  if (msRaw == null || msRaw === '') return { name, ms: null };
  const ms = Number(msRaw);
  return { name, ms: Number.isFinite(ms) ? ms : null };
}

/** @param {number[]} values */
export function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2) return sorted[mid];
  return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/** First tag from Accept-Language, without q-weight. */
export function primaryLanguage(acceptLanguage) {
  if (acceptLanguage == null) return '';
  const first = String(acceptLanguage).split(',')[0].trim();
  if (!first) return '';
  return first.replace(/;.*$/, '').trim();
}

/** @param {string | null | undefined} asOrg */
export function isCloudAsOrg(asOrg) {
  if (asOrg == null || asOrg === '') return false;
  const haystack = String(asOrg).toLowerCase();
  return CLOUD_AS_ORG_NEEDLES.some((needle) => haystack.includes(needle));
}

/** @param {string | null | undefined} ua */
export function deviceFamily(ua) {
  if (!ua) return 'Unknown';
  if (/iPhone/i.test(ua)) return 'iPhone';
  if (/iPad/i.test(ua)) return 'iPad';
  if (/Android/i.test(ua)) return 'Android';
  if (/CrOS/i.test(ua)) return 'Chrome OS';
  if (/Macintosh|Mac OS X/i.test(ua)) return 'Mac';
  if (/Windows/i.test(ua)) return 'Windows';
  if (/Linux/i.test(ua)) return 'Linux';
  return 'Other';
}

/** @param {string | null | undefined} referer */
export function referrerBucket(referer) {
  if (referer == null || String(referer).trim() === '') return 'none';
  let host;
  try {
    host = new URL(referer).hostname.toLowerCase();
  } catch {
    return 'other';
  }
  if (SELF_HOSTS.has(host)) return 'self';
  if (host === 'google.com' || host.endsWith('.google.com')) return 'Google';
  return 'other';
}

/** @param {unknown} value */
export function escapeHtml(value) {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** @param {string | null | undefined} ts */
export function parseVisitTs(ts) {
  if (!ts) return null;
  const raw = String(ts);
  const date = raw.includes('T') ? new Date(raw) : new Date(`${raw.replace(' ', 'T')}Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

/** Hour 0–23 in America/New_York from an ISO or SQLite UTC timestamp. */
export function hourInEastern(ts) {
  const date = parseVisitTs(ts);
  if (!date) return null;
  const hourPart = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    hourCycle: 'h23',
  })
    .formatToParts(date)
    .find((part) => part.type === 'hour');
  if (!hourPart) return null;
  return Number(hourPart.value);
}
