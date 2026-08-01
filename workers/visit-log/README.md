# visit-log

Route-attached Cloudflare Worker in front of `csfields.com` (single static `index.html` on GitHub Pages). On each request it pass-through-fetches the origin, then persists a visit row to D1 (`visits`) and Workers Logs via `ctx.waitUntil`. Logging failures never break the site response.

`bot_score` is always `NULL` — Cloudflare Bot Management is not enabled on this account. Do not filter or trust that column. `bot_guess` is a best-effort heuristic and has false negatives against spoofed browser UAs; prefer the belt-and-braces human query below when eyeballing real traffic.

## Deploy

```bash
npx wrangler login
npx wrangler d1 create visit-log-db   # first time only; paste id into wrangler.toml
npm run db:remote
npm run deploy
```

## Rollback

If the site breaks, remove the Worker routes in the Cloudflare dashboard: **Workers → visit-log → Domains & Routes**. Traffic then hits the bare GitHub Pages origin again (no logging).

## Live tail

```bash
npm run tail
```

## Recent visits

```bash
npx wrangler d1 execute visit-log-db --remote --command \
  "SELECT ts, ip, country, method, status, path, bot_guess, substr(ua,1,60) AS ua
   FROM visits ORDER BY id DESC LIMIT 50;"
```

## Likely-human (belt and braces)

`bot_guess = 0` alone is not enough. Also drop obvious probe shapes (404s, `.php`, `/wp-`):

```bash
npx wrangler d1 execute visit-log-db --remote --command \
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
npx wrangler d1 execute visit-log-db --remote --command \
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
npx wrangler d1 execute visit-log-db --remote --command \
  "SELECT date(ts) AS day, COUNT(*) AS n
   FROM visits
   GROUP BY date(ts)
   ORDER BY day DESC;"
```

## Traffic by country

```bash
npx wrangler d1 execute visit-log-db --remote --command \
  "SELECT country, COUNT(*) AS n
   FROM visits
   GROUP BY country
   ORDER BY n DESC
   LIMIT 50;"
```

## Repeat visitors by IP

```bash
npx wrangler d1 execute visit-log-db --remote --command \
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
npx wrangler d1 execute visit-log-db --remote --command \
  "SELECT COUNT(*) AS rows, MIN(ts) AS oldest, MAX(ts) AS newest FROM visits;"
```

Manual prune fallback:

```bash
npx wrangler d1 execute visit-log-db --remote --command \
  "DELETE FROM visits WHERE ts < datetime('now', '-90 days');"
```

## Privacy

Stores client IPs, full URLs, and cookie headers in D1. Retained 90 days. No on-site privacy disclosure today.
