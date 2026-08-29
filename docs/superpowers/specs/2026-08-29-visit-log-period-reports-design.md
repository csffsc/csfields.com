# Visit-log weekly & monthly reports + Proton email

**Date:** 2026-08-29  
**Status:** Draft — awaiting approval

## Goal

Add **weekly** (last **168 hours**) and **monthly** (last **672 hours** ≈ 28 days rolling) visit-log reports for csfields.com, delivered as:

1. **HTML email** (Proton SMTP) to Chris
2. **Cursor canvas** with full inline data (same pattern as daily 2XX report)

Each report has **two parts**:

- **Part A — 2XX summary** (same filter as daily automation: `status BETWEEN 200 AND 299`)
- **Part B — Scanner / full-traffic appendix** (404s, bot probes, `.php`, `/wp-`, high-volume paths — not mixed into 2XX totals)

## Non-goals

- Calendar-month boundaries (use rolling 672h unless changed later)
- Committing canvases or report output to git
- On-site privacy page or public dashboard
- Replacing the existing daily 2XX automation (keep it; add weekly + monthly)

## Windows

| Report   | Lookback        | Notes                                      |
|----------|-----------------|--------------------------------------------|
| Weekly   | 168 hours       | Rolling from run time (UTC bounds in SQL)  |
| Monthly  | 672 hours       | 28 days rolling, not calendar month          |

SQL filter pattern:

```sql
ts >= datetime('now', '-168 hours')   -- weekly
ts >= datetime('now', '-672 hours')   -- monthly
```

## Aggregates (both parts)

**Part A (2XX only)** — same family as daily canvas:

- Totals, unique IPs, unique paths, `bot_guess` 0 vs 1
- By country, method, status, colo
- Hourly series (Eastern clock if practical)
- Top AS orgs; top visitor buckets (country + counts + time window, **no raw IPs**)
- Path breakdown; capture quality (cookie/body/query presence)

**Part B (appendix — non-2XX and probes)**:

- Counts by status class (3XX / 4XX / 5XX)
- Top probe paths (404, `.php`, `/wp-`, `bot_guess = 1`)
- Optional: top countries for probe traffic

## Delivery

### Email (Proton)

- **Provider:** Proton Mail with **SMTP** (requires **paid plan** — free tier has no SMTP)
- **SMTP:** `smtp.protonmail.ch`, port **587**, STARTTLS
- **Sender:** dedicated address e.g. `reports@yourdomain` or Proton alias
- **Recipient:** Chris (`REPORT_TO` — single inbox)

Secrets in Infisical **`csfields` / `prod` / `/visit-log`** (never git):

| Secret | Purpose |
|--------|---------|
| `CLOUDFLARE_API_TOKEN` | D1 queries |
| `q_email` | **Q** — `q@csfields.com`, SMTP auth user, default recipient |
| `q_smtp_server` | Proton SMTP host (`smtp.protonmail.ch`) |
| `q_smtp_port` | `587` |
| `q_smtp_token` | Proton SMTP token |

Optional: `REPORT_TO` if delivery should differ from `q_email`.

### Canvas

Written under project canvases directory:

- `visit-log-weekly-YYYY-MM-DD.canvas.tsx`
- `visit-log-monthly-YYYY-MM-DD.canvas.tsx`

Date stamp = report run date (UTC). Imports only from `cursor/canvas`; data inline; no fetch in canvas.

### Email body

- Subject: `csfields visit log — weekly|monthly — {date}`
- HTML: headline stats from Part A + short Part B probe summary
- Footer: “Full detail in Cursor canvas `{filename}`” (canvas opened manually in Cursor)

## Architecture (recommended)

**Repo script + Cursor automations** (not ad-hoc agent SQL each run).

```
workers/visit-log/
  scripts/
    report-period.mjs      # CLI: --period=weekly|monthly
    report-queries.mjs     # SQL builders + parsers
    report-email.mjs       # nodemailer + Proton SMTP
    report-canvas.mjs      # generate .canvas.tsx content
  package.json             # add "report:weekly", "report:monthly"
```

Flow:

1. Cursor automation (or manual): `npm run report:weekly` / `report:monthly`
2. Script runs D1 queries via `with-infisical.sh` + wrangler (reuse Infisical auth)
3. Script writes canvas file to canvases path
4. Script sends HTML email via SMTP (secrets from Infisical `run`)
5. Exit non-zero on D1 or SMTP failure; no git commit

**Why not Worker cron for email?** Visit-log Worker is request-path only; adding SMTP/canvas there couples production edge to reporting and complicates secrets. Keep reporting in operator tooling.

**Why not email-only?** You asked for canvas + email; canvas remains the rich artifact.

## Automations (Cursor)

| Name                         | Schedule (draft)     | Command              |
|------------------------------|----------------------|----------------------|
| Daily visit-log 2XX report   | Existing (~18:00 ET) | unchanged            |
| Weekly visit-log report      | `0 22 * * 0` (Sun)   | `npm run report:weekly`  |
| Monthly visit-log report     | `0 22 1 * *` (1st)   | `npm run report:monthly` |

Monthly cron is approximate; script always uses **672h rolling** window regardless of calendar.

Automations: same repo, `main`, Cloud Agent env with `INFISICAL_TOKEN` + Proton SMTP secrets available via Infisical at runtime.

## Proton account setup (manual)

1. Upgrade to plan with **SMTP submission** (if not already).
2. Proton → **Settings → Proton Mail → IMAP/SMTP → SMTP tokens** → generate token for automation.
3. Create or pick sender address (dedicated `reports@…` recommended).
4. Store SMTP secrets in Infisical `/visit-log`.
5. Test locally: `npm run report:weekly -- --dry-run` then `npm run report:weekly -- --email-only` (flags TBD in implementation).

## Privacy

- Email and canvas: no raw IPs, cookies, or full UAs (same as daily 2XX canvas).
- Appendix may list probe **paths** and aggregate counts only.

## Success criteria

- [ ] `npm run report:weekly` completes locally with canvas + email
- [ ] `npm run report:monthly` same for 672h window
- [ ] Part A totals match manual `d1:query` spot checks
- [ ] Part B separately counts 404/probe traffic
- [ ] Cloud Agent automation runs with `INFISICAL_TOKEN` only (SMTP via Infisical)
- [ ] No secrets in git or canvas source

## Open items

- Exact `REPORT_TO` address (chris@csfields.com vs personal Proton inbox)
- Whether monthly automation should run every 28 days instead of 1st-of-month cron
