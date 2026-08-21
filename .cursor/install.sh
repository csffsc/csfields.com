#!/usr/bin/env bash
set -euo pipefail

if ! command -v infisical >/dev/null 2>&1; then
  curl -1sLf 'https://artifacts-cli.infisical.com/setup.deb.sh' | sudo -E bash
  sudo apt-get update -qq
  sudo apt-get install -y -qq infisical
fi

cd workers/visit-log
npm ci
