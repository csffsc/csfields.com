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
