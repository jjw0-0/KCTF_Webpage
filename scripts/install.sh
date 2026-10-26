#!/bin/sh
set -eu

cd "$(dirname "$0")/.."

domain=${1:-}
if [ -z "$domain" ] || ! printf '%s' "$domain" | grep -Eq '^[A-Za-z0-9.-]+$'; then
  printf 'Usage: %s ctf.example.com\n' "$0" >&2
  exit 1
fi

command -v docker >/dev/null 2>&1 || { printf 'Docker is required.\n' >&2; exit 1; }
docker compose version >/dev/null 2>&1 || { printf 'Docker Compose v2 is required.\n' >&2; exit 1; }
command -v openssl >/dev/null 2>&1 || { printf 'OpenSSL is required.\n' >&2; exit 1; }

env_file=.env.prod.local
created=false
if [ ! -e "$env_file" ]; then
  umask 077
  postgres_password=$(openssl rand -hex 24)
  nextauth_secret=$(openssl rand -hex 48)
  instance_flag_secret=$(openssl rand -hex 48)
  instancer_token=$(openssl rand -hex 32)
  admin_password=$(openssl rand -hex 16)
  admin_email=${ADMIN_EMAIL:-admin@$domain}
  admin_username=${ADMIN_USERNAME:-admin}

  printf '%s\n' \
    "DOMAIN=$domain" \
    'POSTGRES_USER=kctf' \
    "POSTGRES_PASSWORD=$postgres_password" \
    'POSTGRES_DB=kctf' \
    "NEXTAUTH_SECRET=$nextauth_secret" \
    "INSTANCE_FLAG_SECRET=$instance_flag_secret" \
    "KCTF_INSTANCER_TOKEN=$instancer_token" \
    "INSTANCER_PUBLIC_HOST=$domain" \
    'INSTANCER_TTL_MS=3600000' \
    'INSTANCER_PORT_MIN=10000' \
    'INSTANCER_PORT_MAX=19999' \
    'INSTANCER_MAX_MEMORY_MB=1024' \
    'INSTANCER_MAX_CPU=2' \
    'INSTANCER_MAX_PIDS=256' \
    'KCTF_HOST_PORT=3020' \
    "ADMIN_EMAIL=$admin_email" \
    "ADMIN_USERNAME=$admin_username" \
    "ADMIN_INITIAL_PASSWORD=$admin_password" > "$env_file"
  created=true
fi

./scripts/deploy-prod.sh
docker compose --env-file "$env_file" -f docker-compose.prod.yml --profile bundled-proxy up -d caddy

printf '\nKCTF is starting at https://%s\n' "$domain"
printf 'Allow inbound TCP 80, 443, and 10000-19999 (plus UDP 443) in the host firewall.\n'
if [ "$created" = true ]; then
  printf 'Initial admin: %s / %s\n' "$admin_email" "$admin_password"
  printf 'Credentials and generated secrets are stored in %s with owner-only permissions.\n' "$env_file"
fi
