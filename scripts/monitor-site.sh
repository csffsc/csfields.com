#!/usr/bin/env bash
# Continuously monitor the live csfields.com production deployment
# (GitHub Pages origin behind the Cloudflare visit-log worker).
#
# Prints one timestamped line per poll with HTTP status and response time,
# and flags non-200 responses and content changes (e.g. a new Pages deploy)
# by comparing a short hash of the response body.
#
# Env overrides:
#   MONITOR_URL       target URL           (default: https://csfields.com/)
#   MONITOR_INTERVAL  seconds between polls (default: 60)
set -u

URL="${MONITOR_URL:-https://csfields.com/}"
INTERVAL="${MONITOR_INTERVAL:-60}"

echo "Monitoring $URL every ${INTERVAL}s (UTC). Ctrl-C to stop."
last_hash=""
while true; do
  ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  response="$(curl -s --max-time 20 -w '\n%{http_code} %{time_total}' "$URL" 2>/dev/null)"
  meta="$(printf '%s' "$response" | tail -n1)"
  code="$(printf '%s' "$meta" | cut -d' ' -f1)"
  ttime="$(printf '%s' "$meta" | cut -d' ' -f2)"
  html="$(printf '%s' "$response" | sed '$d')"
  # Cloudflare rewrites the obfuscated email and injects a per-request beacon
  # token on every response, so normalize those out before hashing; otherwise
  # every poll looks like a content change.
  norm="$(printf '%s' "$html" \
    | sed -E 's/data-cfemail="[0-9a-fA-F]+"/data-cfemail=""/g' \
    | sed -E 's@/cdn-cgi/l/email-protection#[0-9a-fA-F]+@/cdn-cgi/l/email-protection#@g' \
    | sed -E 's/window\.__CF\$cv\$params=\{[^}]*\}/window.__CF__cv__params={}/g')"
  hash="$(printf '%s' "$norm" | sha256sum | cut -c1-12)"

  flag=""
  case "$code" in
    200) ;;
    "") code="ERR"; flag=" [!] REQUEST FAILED" ;;
    *) flag=" [!] NON-200" ;;
  esac
  if [ -n "$last_hash" ] && [ "$hash" != "$last_hash" ] && [ "$code" = "200" ]; then
    flag="$flag [*] CONTENT CHANGED"
  fi
  [ "$code" = "200" ] && last_hash="$hash"

  echo "$ts  HTTP $code  ${ttime}s  sha:$hash$flag"
  sleep "$INTERVAL"
done
