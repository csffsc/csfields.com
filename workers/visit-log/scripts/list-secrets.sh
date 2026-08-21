#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

config_env="prod"
config_path="/visit-us"
if [[ -f infisical.config.json ]]; then
  read -r config_env config_path < <(node -e "
    const fs = require('node:fs');
    try {
      const cfg = JSON.parse(fs.readFileSync('infisical.config.json', 'utf8'));
      process.stdout.write([(cfg.env || 'prod'), (cfg.path || '/')].join('\t'));
    } catch {
      process.stdout.write('prod\t/');
    }
  ")
fi

env="${INFISICAL_ENV:-$config_env}"
path="${INFISICAL_PATH:-$config_path}"

exec infisical secrets --env="$env" --path="$path"
