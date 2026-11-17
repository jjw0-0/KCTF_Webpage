#!/bin/sh
set -eu

revision=${1:?missing revision}
deploy_path=${2:?missing deployment path}
case "$revision" in *[!0-9a-f]*|'') echo 'Invalid revision.' >&2; exit 1;; esac
[ "${#revision}" -eq 40 ] || { echo 'Expected a full SHA-1 commit ID.' >&2; exit 1; }
cd "$deploy_path"
[ -f .env.prod.local ] || { echo '.env.prod.local is missing.' >&2; exit 1; }
[ -z "$(git status --porcelain --untracked-files=all)" ] || { echo 'Deployment checkout is dirty.' >&2; exit 1; }
git fetch --no-tags origin refs/heads/Master
[ "$(git rev-parse FETCH_HEAD)" = "$revision" ] || { echo 'Master advanced or requested revision differs.' >&2; exit 1; }

backup_dir=${KCTF_BACKUP_DIR:-$HOME/kctf-backups}
[ ! -L "$backup_dir" ] || { echo 'Backup directory must not be a symlink.' >&2; exit 1; }
umask 077
mkdir -p "$backup_dir"
chmod 700 "$backup_dir"
backup_file=$(mktemp "$backup_dir/postgres-$(date -u +%Y%m%dT%H%M%SZ)-XXXXXXXX.dump")
trap 'rm -f "$backup_file"' EXIT HUP INT TERM
docker compose --env-file .env.prod.local -f docker-compose.prod.yml exec -T postgres sh -c 'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$backup_file"
[ -s "$backup_file" ] || { echo 'Database backup is empty.' >&2; exit 1; }
trap - HUP INT TERM EXIT
printf 'PostgreSQL backup saved: %s\n' "$backup_file"
printf 'Previous revision: %s\n' "$(git rev-parse HEAD)"

git checkout --detach "$revision"
./scripts/deploy-prod.sh
address=$(docker compose --env-file .env.prod.local -f docker-compose.prod.yml port app 3000)
case "$address" in 127.0.0.1:*) port=${address#127.0.0.1:};; *) echo 'App must bind to 127.0.0.1.' >&2; exit 1;; esac
case "$port" in *[!0-9]*|'') echo 'Invalid app port.' >&2; exit 1;; esac
[ "$port" -ge 1 ] && [ "$port" -le 65535 ] || { echo 'Invalid app port.' >&2; exit 1; }
curl --fail --silent --show-error --retry 12 --retry-delay 5 --retry-connrefused --max-time 10 "http://127.0.0.1:$port/api/health"
