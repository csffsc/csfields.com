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
