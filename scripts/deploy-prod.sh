#!/bin/sh
set -eu

cd "$(dirname "$0")/.."

env_file=.env.prod.local
if [ ! -f "$env_file" ]; then
  printf '%s is missing. Run ./scripts/install.sh <domain> on a new server.\n' "$env_file" >&2
  exit 1
fi
command -v openssl >/dev/null 2>&1 || { printf 'OpenSSL is required.\n' >&2; exit 1; }
umask 077
if ! grep -Eq '^KCTF_INSTANCER_TOKEN=.+$' "$env_file"; then
  printf '\nKCTF_INSTANCER_TOKEN=%s\n' "$(openssl rand -hex 32)" >> "$env_file"
fi
if ! grep -Eq '^INSTANCE_FLAG_SECRET=.+$' "$env_file"; then
  printf 'INSTANCE_FLAG_SECRET=%s\n' "$(openssl rand -hex 48)" >> "$env_file"
fi

compose='docker compose --env-file .env.prod.local -f docker-compose.prod.yml'
$compose --profile tools build app instancer migrate
$compose --profile tools run --rm migrate
$compose --profile tools run --rm migrate npx prisma db seed
$compose up -d --no-build postgres instancer app
