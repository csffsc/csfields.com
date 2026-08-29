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

Remote D1 loads `CLOUDFLARE_API_TOKEN` from Infisical. Config lives in two files:

| File | Purpose |
|------|---------|
| `.infisical.json` | Project link (`infisical init`) |
| `infisical.config.json` | **Env slug + folder path** — edit when you know where the secret is |

**Stuck? One command finds it:**

```bash
npm run secrets:discover
```

Look for `CLOUDFLARE_API_TOKEN` in the output, then set `infisical.config.json`:

```json
{ "env": "prod", "path": "/visit-log" }
```

Then `npm run auth:check`.

- **Interactive terminal:** `infisical login` — no token file needed
- **Cursor agent (local):** copy `.env.example` → `.env.local`, paste read-only `INFISICAL_TOKEN` (gitignored)
- **Cloud Agents:** same token as Runtime Secret `INFISICAL_TOKEN`

One-time local setup:

```bash
cp .env.example .env.local
# paste service token from Infisical → csfields → Service Tokens (prod, /visit-log, read)
```

```bash
npm run d1:query -- "SELECT COUNT(*) AS n FROM visits;"
```

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

## Periodic reports (Q)

Weekly (**168h**) and monthly (**672h** ≈ 28 days rolling) reports: 2XX summary + probe appendix, HTML email from **Q**, and a Cursor canvas.

Infisical `/visit-log` secrets:

| Secret | Purpose |
|--------|---------|
| `CLOUDFLARE_API_TOKEN` | D1 queries (existing) |
| `q_email` | From address (`q@csfields.com`) and SMTP user |
| `q_smtp_server` | Proton SMTP host |
| `q_smtp_port` | SMTP port (587) |
| `q_smtp_token` | Proton SMTP token |

Optional: `REPORT_TO` (defaults to `q_email`).

```bash
npm run report:weekly -- --dry-run    # canvas only, no email
npm run report:weekly                 # canvas + email from Q
npm run report:monthly
```

Canvas output: `~/.cursor/projects/Users-chris-Code-csfields-com/canvases/visit-log-{weekly|monthly}-YYYY-MM-DD.canvas.tsx` (override with `VISIT_LOG_CANVAS_DIR`).

Do not commit canvases or secrets.
