#!/bin/sh
set -eu

cd "$(dirname "$0")/.."

KCTF_INSTANCER_TOKEN="$(docker inspect jjw-instancer --format '{{range .Config.Env}}{{println .}}{{end}}' | sed -n 's/^INSTANCER_TOKEN=//p')"
test -n "$KCTF_INSTANCER_TOKEN"
export KCTF_INSTANCER_TOKEN

compose='docker compose --env-file .env.prod.local -f docker-compose.prod.yml'
$compose --profile tools build app migrate
$compose --profile tools run --rm migrate
$compose --profile tools run --rm migrate npx prisma db seed
$compose up -d --no-build app
