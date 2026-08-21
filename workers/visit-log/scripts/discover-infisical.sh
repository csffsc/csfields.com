#!/usr/bin/env bash
# Print Infisical folders and secrets across common env slugs so you can find CLOUDFLARE_API_TOKEN once.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! command -v infisical >/dev/null 2>&1; then
  echo "infisical CLI not found. Install: brew install infisical/get-cli/infisical" >&2
  exit 1
fi

project_id=""
if [[ -f .infisical.json ]]; then
  project_id="$(node -e "
    const fs = require('node:fs');
    try {
      const cfg = JSON.parse(fs.readFileSync('.infisical.json', 'utf8'));
      process.stdout.write(String(cfg.workspaceId || cfg.projectId || ''));
    } catch { process.stdout.write(''); }
  ")"
fi

pid_args=()
if [[ -n "$project_id" ]]; then
  pid_args=(--projectId="$project_id")
fi

try_env() {
  local env="$1"
  echo ""
  echo "========== environment: $env =========="

  echo "-- folders at / --"
  if infisical secrets folders get --env="$env" --path=/ "${pid_args[@]}" 2>/dev/null; then
    :
  else
    echo "(none or env slug does not exist)"
  fi

  echo "-- secrets at / (root) --"
  if out="$(infisical secrets --env="$env" --path=/ "${pid_args[@]}" 2>/dev/null)" && [[ -n "$out" ]]; then
    echo "$out"
  else
    echo "(empty or unavailable)"
  fi

  for folder in visit-us visit-log shared root; do
    echo "-- secrets at /$folder --"
    if out="$(infisical secrets --env="$env" --path="/$folder" "${pid_args[@]}" 2>/dev/null)" && [[ -n "$out" ]]; then
      echo "$out"
    else
      echo "(empty or folder missing)"
    fi
  done
}

for env in prod dev staging development production; do
  try_env "$env"
done

echo ""
echo "When you find CLOUDFLARE_API_TOKEN, edit infisical.config.json with the matching env + path, then: npm run auth:check"
