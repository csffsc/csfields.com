# visit-log

Route-attached Cloudflare Worker in front of `csfields.com` (single static `index.html` on GitHub Pages). On each request it pass-through-fetches the origin, then persists a visit row to D1 (`visits`) and Workers Logs via `ctx.waitUntil`. Logging failures never break the site response.

`bot_score` is always `NULL` — Cloudflare Bot Management is not enabled on this account. Do not filter or trust that column. `bot_guess` is a best-effort heuristic and has false negatives against spoofed browser UAs; prefer the belt-and-braces human query below when eyeballing real traffic.

## Deploy

```bash
npx wrangler login          # deploy only; D1 reads use Infisical (below)
npx wrangler d1 create visit-log-db   # first time only; paste id into wrangler.toml
npm run db:remote           # applies schema via Infisical → CLOUDFLARE_API_TOKEN
npm run deploy
```

## Secrets (Infisical Cloud)

Remote D1 commands load `CLOUDFLARE_API_TOKEN` from Infisical — not from git or a committed `.env`.

| Infisical | Value |
|-----------|--------|
| Project | `csfields` |
| Environment | `prod` |
| Folder | `/visit-log` |
| Secret | `CLOUDFLARE_API_TOKEN` |

**One-time project link** (run locally, then commit `.infisical.json`):

```bash
cd workers/visit-log
infisical init   # select project csfields
```

**Runtime auth to Infisical**

- **Local (Mac):** `infisical login` — then run npm scripts without setting `INFISICAL_TOKEN`
- **Cloud Agents / CI:** inject `INFISICAL_TOKEN` (read-only service token for `csfields` / `prod` / `/visit-log`)

Create a service token in Infisical: **Project Settings → Service Tokens → Create** — scope to env `prod`, path `/visit-log`, read-only. Paste the token into the Cursor environment secret `INFISICAL_TOKEN` (not into chat or git).

**Verify wrangler + D1 via Infisical:**

```bash
npm run auth:check
npm run d1:query -- "SELECT COUNT(*) AS n FROM visits;"
```

All `db:remote`, `db:dev`, and `d1:query` scripts wrap commands with `scripts/with-infisical.sh`. Local `--local` D1 does not need Cloudflare credentials.

Optional overrides: `INFISICAL_PROJECT_ID`, `INFISICAL_ENV`, `INFISICAL_PATH`. Set `VISIT_LOG_SKIP_INFISICAL=1` only if `CLOUDFLARE_API_TOKEN` is already exported (e.g. debugging).

## Rollback

If the site breaks, remove the Worker routes in the Cloudflare dashboard: **Workers → visit-log → Domains & Routes**. Traffic then hits the bare GitHub Pages origin again (no logging).

## Live tail

```bash
npm run tail
```

## Recent visits

```bash
npm run d1:query -- \
  "SELECT ts, ip, country, method, status, path, bot_guess, substr(ua,1,60) AS ua
   FROM visits ORDER BY id DESC LIMIT 50;"
```

## Likely-human (belt and braces)

`bot_guess = 0` alone is not enough. Also drop obvious probe shapes (404s, `.php`, `/wp-`):

```bash
npm run d1:query -- \
  "SELECT ts, ip, country, status, path, substr(ua,1,80) AS ua
   FROM visits
   WHERE bot_guess = 0
     AND (status IS NULL OR status != 404)
     AND path NOT LIKE '%.php%'
     AND path NOT LIKE '/wp-%'
   ORDER BY id DESC LIMIT 50;"
```

## Scanner probes by path

```bash
npm run d1:query -- \
  "SELECT path, COUNT(*) AS n
   FROM visits
   WHERE bot_guess = 1
      OR status = 404
      OR path LIKE '%.php%'
      OR path LIKE '/wp-%'
   GROUP BY path
   ORDER BY n DESC
   LIMIT 50;"
```

## Traffic by day

```bash
npm run d1:query -- \
  "SELECT date(ts) AS day, COUNT(*) AS n
   FROM visits
   GROUP BY date(ts)
   ORDER BY day DESC;"
```

## Traffic by country

```bash
npm run d1:query -- \
  "SELECT country, COUNT(*) AS n
   FROM visits
   GROUP BY country
   ORDER BY n DESC
   LIMIT 50;"
```

## Repeat visitors by IP

```bash
npm run d1:query -- \
  "SELECT ip, country, COUNT(*) AS n, MIN(ts) AS first_seen, MAX(ts) AS last_seen
   FROM visits
   GROUP BY ip
   HAVING n > 1
   ORDER BY n DESC
   LIMIT 50;"
```

## Retention sanity check

Daily cron `0 5 * * *` (see `[triggers]` in `wrangler.toml`) prunes rows older than 90 days. Use this to confirm retained range:

```bash
npm run d1:query -- \
  "SELECT COUNT(*) AS rows, MIN(ts) AS oldest, MAX(ts) AS newest FROM visits;"
```

Manual prune fallback:

```bash
npm run d1:query -- \
  "DELETE FROM visits WHERE ts < datetime('now', '-90 days');"
```

## Privacy

Stores client IPs, full URLs, and cookie headers in D1. Retained 90 days. No on-site privacy disclosure today.
