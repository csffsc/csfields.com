# Visit Log Worker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put a Cloudflare Worker in front of `csfields.com` that captures every request’s metadata, writes it to Workers Logs and a D1 SQLite database, then pass-through-fetches the existing GitHub Pages origin unchanged.

**Architecture:** A route-attached Worker (`csfields.com/*`, `www.csfields.com/*`) runs on every proxied request. It builds a full visit record (IP, method, full URL+query, headers including cookies, optional small body, `request.cf` geo/bot fields, response status), `console.log`s structured JSON for Workers Logs, inserts a row into D1 via `ctx.waitUntil`, then `return fetch(request)` to the current origin. Logging failures never break the site.

**Tech Stack:** Cloudflare Workers, Wrangler, D1 (SQLite), Workers Logs / observability, plain JS (no bundler), Vitest for pure helper unit tests.

**Capture policy (locked):**
- Log **all** methods, paths, bots, query strings, cookies, referers, accept-language.
- Bodies: store when textual and ≤ 8 KiB; otherwise store `content-type` + byte length only.
- Tag bots (`bot_guess`) — do **not** drop them.
- Free-plan aware: ~1.5k req/day ≪ 100k Worker req/day and ≪ 100k D1 rows written/day.

**Privacy note:** IP + cookies + full URLs are personal/sensitive data. No on-site privacy blurb in v1 (per owner). Retention prune remains optional; no public admin UI.

---

## File structure

```
workers/visit-log/
  package.json
  wrangler.toml
  schema.sql
  src/index.js          # fetch handler + pass-through
  src/extract.js        # pure: request → visit record
  src/persist.js        # console.log + D1 insert
  src/extract.test.js   # vitest
  README.md             # query / deploy / retention commands
plans_visitlog.md       # this plan
```

Site `index.html` and Pages deploy stay as-is (no privacy blurb).

---

### Task 1: Scaffold the Worker project

**Files:**
- Create: `workers/visit-log/package.json`
- Create: `workers/visit-log/wrangler.toml`
- Create: `workers/visit-log/schema.sql`
- Create: `workers/visit-log/src/extract.js` (stub)
- Create: `workers/visit-log/src/persist.js` (stub)
- Create: `workers/visit-log/src/index.js` (stub)
- Create: `workers/visit-log/src/extract.test.js` (stub)

- [ ] **Step 1: Create package.json**

```json
{
  "name": "visit-log",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "deploy": "wrangler deploy",
    "tail": "wrangler tail",
    "db:local": "wrangler d1 execute visit-log-db --local --file=./schema.sql",
    "db:remote": "wrangler d1 execute visit-log-db --remote --file=./schema.sql"
  },
  "devDependencies": {
    "vitest": "^3.2.4",
    "wrangler": "^4.28.0"
  }
}
```

- [ ] **Step 2: Create wrangler.toml**

Replace `YOUR_ACCOUNT_ID` / zone name only if deploy requires it; `zone_name` is enough for routes when logged into the right account.

```toml
name = "visit-log"
main = "src/index.js"
compatibility_date = "2026-08-01"
workers_dev = false

[observability]
enabled = true
head_sampling_rate = 1

[[d1_databases]]
binding = "DB"
database_name = "visit-log-db"
database_id = "REPLACE_AFTER_CREATE"
preview_database_id = "REPLACE_AFTER_CREATE"

[[routes]]
pattern = "csfields.com/*"
zone_name = "csfields.com"

[[routes]]
pattern = "www.csfields.com/*"
zone_name = "csfields.com"
```

- [ ] **Step 3: Create schema.sql**

```sql
CREATE TABLE IF NOT EXISTS visits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL,
  ip TEXT,
  method TEXT NOT NULL,
  url TEXT NOT NULL,
  path TEXT NOT NULL,
  query TEXT,
  status INTEGER,
  ua TEXT,
  referer TEXT,
  accept_language TEXT,
  cookie TEXT,
  content_type TEXT,
  body_len INTEGER,
  body TEXT,
  country TEXT,
  colo TEXT,
  as_org TEXT,
  tls_version TEXT,
  bot_score INTEGER,
  verified_bot INTEGER,
  bot_guess INTEGER NOT NULL DEFAULT 0,
  ray TEXT
);

CREATE INDEX IF NOT EXISTS idx_visits_ts ON visits(ts);
CREATE INDEX IF NOT EXISTS idx_visits_ip ON visits(ip);
CREATE INDEX IF NOT EXISTS idx_visits_bot_guess ON visits(bot_guess);
```

- [ ] **Step 4: Create stub modules**

`src/extract.js`:
```js
export function extractVisit() {
  throw new Error('not implemented');
}
```

`src/persist.js`:
```js
export async function persistVisit() {
  throw new Error('not implemented');
}
```

`src/index.js`:
```js
export default {
  async fetch(request) {
    return fetch(request);
  },
};
```

`src/extract.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { extractVisit } from './extract.js';

describe('extractVisit', () => {
  it('is defined', () => {
    expect(typeof extractVisit).toBe('function');
  });
});
```

- [ ] **Step 5: Install deps and confirm test harness**

Run from `workers/visit-log`:
```bash
npm install
npm test
```
Expected: PASS (stub test).

- [ ] **Step 6: Commit**

```bash
git add workers/visit-log
git commit -m "$(cat <<'EOF'
Scaffold visit-log Worker with D1 schema and test harness.

EOF
)"
```

---

### Task 2: Implement `extractVisit` (TDD)

**Files:**
- Modify: `workers/visit-log/src/extract.js`
- Modify: `workers/visit-log/src/extract.test.js`

- [ ] **Step 1: Write failing tests for full capture**

Replace `src/extract.test.js` with:

```js
import { describe, it, expect } from 'vitest';
import { extractVisit, guessBot } from './extract.js';

function fakeRequest({
  url = 'https://csfields.com/path?x=1',
  method = 'GET',
  headers = {},
  cf = {},
} = {}) {
  return {
    url,
    method,
    headers: {
      get(name) {
        const key = Object.keys(headers).find(
          (k) => k.toLowerCase() === name.toLowerCase()
        );
        return key ? headers[key] : null;
      },
    },
    cf,
  };
}

describe('guessBot', () => {
  it('flags obvious bot UAs', () => {
    expect(guessBot('Mozilla/5.0 (compatible; Googlebot/2.1)')).toBe(1);
    expect(guessBot('curl/8.0')).toBe(1);
    expect(guessBot('python-requests/2.31')).toBe(1);
  });

  it('leaves normal browsers as 0', () => {
    expect(
      guessBot(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
      )
    ).toBe(0);
  });
});

describe('extractVisit', () => {
  it('captures ip, method, full url, path, query, headers, cf fields', async () => {
    const req = fakeRequest({
      url: 'https://csfields.com/hello?utm=1&token=abc',
      method: 'POST',
      headers: {
        'CF-Connecting-IP': '203.0.113.9',
        'User-Agent': 'curl/8.0',
        Referer: 'https://example.com/',
        'Accept-Language': 'en-US,en;q=0.9',
        Cookie: 'a=1; b=2',
        'Content-Type': 'application/json',
        'CF-Ray': 'abc123-EWR',
      },
      cf: {
        country: 'US',
        colo: 'EWR',
        asOrganization: 'Example ISP',
        tlsVersion: 'TLSv1.3',
        botManagement: { score: 3, verifiedBot: false },
      },
    });

    const visit = await extractVisit(req, {
      status: 404,
      bodyText: '{"probe":true}',
      bodyLen: 15,
    });

    expect(visit.ip).toBe('203.0.113.9');
    expect(visit.method).toBe('POST');
    expect(visit.url).toBe('https://csfields.com/hello?utm=1&token=abc');
    expect(visit.path).toBe('/hello');
    expect(visit.query).toBe('utm=1&token=abc');
    expect(visit.status).toBe(404);
    expect(visit.ua).toBe('curl/8.0');
    expect(visit.referer).toBe('https://example.com/');
    expect(visit.accept_language).toBe('en-US,en;q=0.9');
    expect(visit.cookie).toBe('a=1; b=2');
    expect(visit.content_type).toBe('application/json');
    expect(visit.body).toBe('{"probe":true}');
    expect(visit.body_len).toBe(15);
    expect(visit.country).toBe('US');
    expect(visit.colo).toBe('EWR');
    expect(visit.as_org).toBe('Example ISP');
    expect(visit.tls_version).toBe('TLSv1.3');
    expect(visit.bot_score).toBe(3);
    expect(visit.verified_bot).toBe(0);
    expect(visit.bot_guess).toBe(1);
    expect(visit.ray).toBe('abc123-EWR');
    expect(visit.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('omits body text when bodyLen exceeds 8192', async () => {
    const req = fakeRequest({
      headers: { 'Content-Type': 'text/plain', 'CF-Connecting-IP': '1.1.1.1' },
    });
    const visit = await extractVisit(req, {
      status: 200,
      bodyText: 'x'.repeat(9000),
      bodyLen: 9000,
    });
    expect(visit.body).toBeNull();
    expect(visit.body_len).toBe(9000);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd workers/visit-log && npm test
```
Expected: FAIL (`guessBot` / `extractVisit` not implemented or wrong).

- [ ] **Step 3: Implement extract.js**

```js
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
```

Note: request bodies are read in `index.js` before pass-through (Task 4). `extractVisit` only shapes the record; tests pass pre-read body bits.

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd workers/visit-log && npm test
```
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add workers/visit-log/src/extract.js workers/visit-log/src/extract.test.js
git commit -m "$(cat <<'EOF'
Add visit extract helpers with full-capture fields and bot tag.

EOF
)"
```

---

### Task 3: Implement persist (Logs + D1)

**Files:**
- Modify: `workers/visit-log/src/persist.js`
- Create: `workers/visit-log/src/persist.test.js` (optional light mock test)

- [ ] **Step 1: Implement persist.js**

```js
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
```

- [ ] **Step 2: Commit**

```bash
git add workers/visit-log/src/persist.js
git commit -m "$(cat <<'EOF'
Persist visits to Workers Logs and D1.

EOF
)"
```

---

### Task 4: Wire the fetch handler (pass-through + full capture)

**Files:**
- Modify: `workers/visit-log/src/index.js`

- [ ] **Step 1: Implement index.js**

```js
import { extractVisit } from './extract.js';
import { persistVisit } from './persist.js';

const MAX_BODY_BYTES = 8192;
const TEXTUAL = /^(text\/|application\/(json|xml|x-www-form-urlencoded|javascript))/i;

async function readRequestBody(request) {
  const method = request.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD') {
    return { bodyText: null, bodyLen: 0, requestForOrigin: request };
  }

  const contentType = request.headers.get('Content-Type') || '';
  const buffer = await request.arrayBuffer();
  const bodyLen = buffer.byteLength;

  // Rebuild request so origin still receives the body
  const requestForOrigin = new Request(request, { body: buffer });

  let bodyText = null;
  if (bodyLen > 0 && bodyLen <= MAX_BODY_BYTES && TEXTUAL.test(contentType)) {
    bodyText = new TextDecoder().decode(buffer);
  }

  return { bodyText, bodyLen, requestForOrigin };
}

export default {
  async fetch(request, env, ctx) {
    let status = null;
    let bodyText = null;
    let bodyLen = null;
    let response;

    try {
      const read = await readRequestBody(request);
      bodyText = read.bodyText;
      bodyLen = read.bodyLen;
      response = await fetch(read.requestForOrigin);
      status = response.status;
    } catch (err) {
      console.log(
        JSON.stringify({
          type: 'visit_error',
          stage: 'origin_fetch',
          message: String(err && err.message ? err.message : err),
        })
      );
      response = new Response('Bad gateway', { status: 502 });
      status = 502;
    }

    const visitPromise = (async () => {
      try {
        const visit = await extractVisit(request, { status, bodyText, bodyLen });
        await persistVisit(env, visit);
      } catch (err) {
        console.log(
          JSON.stringify({
            type: 'visit_error',
            stage: 'persist',
            message: String(err && err.message ? err.message : err),
          })
        );
      }
    })();

    ctx.waitUntil(visitPromise);
    return response;
  },
};
```

Critical behaviors:
- Body is buffered once and replayed to origin (required after reading).
- Persist runs in `waitUntil` so logging latency does not block HTML.
- Persist errors are swallowed; site still serves.

- [ ] **Step 2: Commit**

```bash
git add workers/visit-log/src/index.js
git commit -m "$(cat <<'EOF'
Wire visit-log Worker: capture all requests, pass through origin.

EOF
)"
```

---

### Task 5: Create D1 database and deploy

**Files:**
- Modify: `workers/visit-log/wrangler.toml` (fill `database_id`)
- Create: `workers/visit-log/README.md`

Requires Cloudflare login (`wrangler login`) on the account that owns `csfields.com`.

- [ ] **Step 1: Create D1 database**

```bash
cd workers/visit-log
npx wrangler d1 create visit-log-db
```

Expected: prints a `database_id` UUID. Paste into both `database_id` and `preview_database_id` in `wrangler.toml`.

- [ ] **Step 2: Apply schema remotely**

```bash
npm run db:remote
```
Expected: success applying `CREATE TABLE` / indexes.

- [ ] **Step 3: Deploy Worker + routes**

```bash
npm run deploy
```
Expected: deploy OK; routes for `csfields.com/*` and `www.csfields.com/*` attached.

**Rollback if site breaks:** Cloudflare Dashboard → Workers → `visit-log` → Domains & Routes → delete routes (traffic returns to bare GitHub Pages origin).

- [ ] **Step 4: Write README.md with operator commands**

```markdown
# visit-log

Edge request logger for csfields.com. Captures every request to Workers Logs + D1, then pass-through fetches GitHub Pages.

## Deploy
npx wrangler login
npx wrangler d1 create visit-log-db   # first time only; paste id into wrangler.toml
npm run db:remote
npm run deploy

## Live tail
npm run tail

## Query recent visits
npx wrangler d1 execute visit-log-db --remote --command \
  "SELECT ts, ip, country, method, status, path, bot_guess, substr(ua,1,60) AS ua
   FROM visits ORDER BY id DESC LIMIT 50;"

## Humans-ish only
npx wrangler d1 execute visit-log-db --remote --command \
  "SELECT ts, ip, country, path, substr(ua,1,80) AS ua
   FROM visits WHERE bot_guess = 0 ORDER BY id DESC LIMIT 50;"

## Retention prune (90 days)
npx wrangler d1 execute visit-log-db --remote --command \
  "DELETE FROM visits WHERE ts < datetime('now', '-90 days');"
```

- [ ] **Step 5: Commit wrangler.toml id + README** (do not commit secrets; D1 id is fine)

```bash
git add workers/visit-log/wrangler.toml workers/visit-log/README.md
git commit -m "$(cat <<'EOF'
Configure visit-log D1 binding and operator docs.

EOF
)"
```

---

### Task 6: Verify in production

- [ ] **Step 1: Hit the site from your browser**

Open `https://csfields.com/` (hard refresh).

- [ ] **Step 2: Confirm Workers Logs**

```bash
cd workers/visit-log && npm run tail
```
Expected: a JSON line with `"type":"visit"`, your IP, `path:"/"`, `bot_guess:0`.

- [ ] **Step 3: Confirm D1 row**

```bash
npx wrangler d1 execute visit-log-db --remote --command \
  "SELECT id, ts, ip, method, path, query, status, bot_guess FROM visits ORDER BY id DESC LIMIT 5;"
```
Expected: newest row matches your hit; `status` 200.

- [ ] **Step 4: Confirm non-GET / scanner-style path still logged**

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  -H 'Content-Type: application/json' \
  -d '{"probe":true}' \
  'https://csfields.com/nope?x=1'
```

Then query:
```bash
npx wrangler d1 execute visit-log-db --remote --command \
  "SELECT method, path, query, body, bot_guess FROM visits ORDER BY id DESC LIMIT 1;"
```
Expected: `POST`, `/nope`, `x=1`, body `{"probe":true}`, `bot_guess:1` (curl UA).

- [ ] **Step 5: Confirm site still looks normal**

Load `https://csfields.com/` — name, tagline, treeline, time-of-day palette unchanged.

---

### Task 7: Optional retention cron (same Worker)

Only if you want automatic 90-day prune; otherwise use the README manual DELETE.

**Files:**
- Modify: `workers/visit-log/wrangler.toml`
- Modify: `workers/visit-log/src/index.js`

- [ ] **Step 1: Add cron trigger**

In `wrangler.toml`:
```toml
[triggers]
crons = ["0 5 * * *"]
```

- [ ] **Step 2: Export scheduled handler**

Append to `src/index.js`:

```js
export async function scheduled(event, env, ctx) {
  ctx.waitUntil(
    env.DB.prepare(
      "DELETE FROM visits WHERE ts < datetime('now', '-90 days')"
    ).run()
  );
}
```

Change default export to object form if needed:

```js
export default {
  async fetch(request, env, ctx) { /* existing */ },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      env.DB.prepare(
        "DELETE FROM visits WHERE ts < datetime('now', '-90 days')"
      ).run()
    );
  },
};
```

- [ ] **Step 3: Deploy and commit**

```bash
npm run deploy
git add workers/visit-log/wrangler.toml workers/visit-log/src/index.js
git commit -m "$(cat <<'EOF'
Prune visit-log D1 rows older than 90 days on a daily cron.

EOF
)"
```

---

## Operator cheat sheet (after ship)

| Question | Command |
|---|---|
| Who hit me recently? | D1 `ORDER BY id DESC LIMIT 50` |
| Likely humans? | `WHERE bot_guess = 0` |
| What are bots probing? | `WHERE bot_guess = 1 GROUP BY path` |
| Live stream | `npm run tail` |
| Site broken after deploy? | Delete Worker routes in dashboard |

---

## Spec coverage checklist

| Requirement | Task |
|---|---|
| Capture all methods/paths/bots/query/cookies | 2, 4 |
| Bodies when small+textual; else length | 2, 4 |
| Workers Logs (`console.log`) | 3, 4 |
| D1 SQLite persistence | 1, 3, 5 |
| Pass-through to GitHub Pages | 4, 5, 6 |
| Free-plan fit / no site break on log failure | 4, 5 |
| Review commands for the operator | 5 README, cheat sheet |
| No on-site privacy blurb | (removed by request) |
| Retention | 5 README + optional 7 |

## Placeholder scan

No TBD/TODO steps. All code is concrete. `database_id` is filled at Task 5 from `wrangler d1 create` output (cannot be known before create).
