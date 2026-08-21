#!/usr/bin/env bash
# Inject visit-log secrets from Infisical Cloud, then run the given command.
# Requires INFISICAL_TOKEN (service token or machine-identity access token).
# Optional: INFISICAL_PROJECT_ID when .infisical.json is missing.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

config_env=""
config_path=""
if [[ -f infisical.config.json ]]; then
  read -r config_env config_path < <(node -e "
    const fs = require('node:fs');
    try {
      const cfg = JSON.parse(fs.readFileSync('infisical.config.json', 'utf8'));
      process.stdout.write([cfg.env || '', cfg.path || ''].join('\t'));
    } catch {
      process.stdout.write('\t');
    }
  ")
fi

INFISICAL_ENV="${INFISICAL_ENV:-${config_env:-prod}}"
INFISICAL_PATH="${INFISICAL_PATH:-${config_path:-/visit-us}}"

if [[ $# -lt 1 ]]; then
  echo "usage: $0 <command> [args...]" >&2
  exit 1
fi

if [[ -n "${CLOUDFLARE_API_TOKEN:-}" && "${VISIT_LOG_SKIP_INFISICAL:-}" == "1" ]]; then
  exec "$@"
fi

if ! command -v infisical >/dev/null 2>&1; then
  cat >&2 <<'EOF'
infisical CLI not found.

Install (macOS):
  brew install infisical/get-cli/infisical

Install (Linux):
  curl -1sLf 'https://artifacts-cli.infisical.com/setup.sh' | sudo -E bash

Cloud Agents need INFISICAL_TOKEN (read-only service token for csfields prod).
Local dev can use `infisical login` instead.
EOF
  exit 1
fi

# INFISICAL_TOKEN is required in CI/Cloud Agents. Locally, infisical login also works.
if [[ -z "${INFISICAL_TOKEN:-}" ]]; then
  echo "INFISICAL_TOKEN not set; using infisical CLI login session (if available)." >&2
fi

export INFISICAL_DISABLE_UPDATE_CHECK="${INFISICAL_DISABLE_UPDATE_CHECK:-true}"

project_id="${INFISICAL_PROJECT_ID:-}"
if [[ -z "$project_id" && -f .infisical.json ]]; then
  project_id="$(node -e "
    const fs = require('node:fs');
    try {
      const cfg = JSON.parse(fs.readFileSync('.infisical.json', 'utf8'));
      process.stdout.write(String(cfg.workspaceId || cfg.projectId || ''));
    } catch {
      process.stdout.write('');
    }
  ")"
fi

args=(run --env="$INFISICAL_ENV" --path="$INFISICAL_PATH")
if [[ -n "$project_id" ]]; then
  args+=(--projectId="$project_id")
else
  cat >&2 <<'EOF'
Infisical project id is missing.

Run once locally from workers/visit-log:
  infisical init
(select project csfields, then commit the generated workspaceId in .infisical.json)

Or set INFISICAL_PROJECT_ID in the environment.
EOF
  exit 1
fi
args+=(-- "$@")

exec infisical "${args[@]}"
