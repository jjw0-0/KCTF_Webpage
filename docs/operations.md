# Operations

This guide reflects the current scripts in `scripts/` and `docker-compose.prod.yml`. Run commands from the repository root on the intended host.

## First install

Point a domain at the host, install Docker Engine, Docker Compose and OpenSSL, and make ports 80/443 available for bundled Caddy. Then run:

```bash
./scripts/install.sh ctf.example.com
```

The installer creates `.env.prod.local` with owner-only permissions if absent, builds the images, runs Prisma migrations and seed, starts PostgreSQL, instancer and app, then starts Caddy. It prints the initial administrator credentials only when it creates the environment file. On later runs it reuses the existing file; check that file's permissions yourself if it was created manually. Store the credentials securely and establish a credential rotation procedure before handing the service to operators; the current UI has no password change flow. Back up `.env.prod.local`; losing its secrets can invalidate sessions and affect instance access.

The seed creates the initial `KCTF 2026` event and default categories only when that event does not exist. Confirm its schedule and competition mode in the administrator UI before opening registration or challenges.

## Configuration and network

Use [`.env.example`](../.env.example) as a reference. Production reads `.env.prod.local`; keep it out of version control. The key values are:

| Setting | Purpose |
| --- | --- |
| `DOMAIN` | Public application hostname |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Database credentials |
| `NEXTAUTH_SECRET` | Session signing secret |
| `DYNAMIC_FLAG_SECRET` | Per-owner dynamic flag secret |
| `KCTF_INSTANCER_TOKEN` | App to instancer credential |
| `INSTANCER_PUBLIC_HOST` | Public hostname for instances |
| `DISCORD_SOLVE_WEBHOOK_URL` | Optional solve notification webhook |
| `KCTF_HOST_PORT` | Loopback port for the app, default `3333` |

Instance ports are configured in [`config/instancer.env`](../config/instancer.env), currently `10021`–`10030`. Open the same range in the host and provider firewalls. [Cloudflare's default proxy ports](https://developers.cloudflare.com/fundamentals/reference/network-ports/) do not include this range; use DNS Only for the instance hostname unless a separately configured service handles it. Keep the instancer service and Docker socket access restricted to the host.

For instance challenges, the deployment ZIP must contain a root `Dockerfile` or `docker-compose.yml`. The instancer assigns the public port, so do not publish one in Compose. Its validation rejects privileged mode, Docker socket and device access, host namespaces, added capabilities, absolute host mounts, and external networks or volumes. CPU, memory, PID, and capability limits apply at runtime. Review private bundles before uploading them to production.

## Existing reverse proxy

To use a host-managed proxy, create `.env.prod.local` yourself before running the deploy script. Set `DOMAIN`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `NEXTAUTH_SECRET`, `DYNAMIC_FLAG_SECRET`, `KCTF_INSTANCER_TOKEN`, and `INSTANCER_PUBLIC_HOST` to production values. Set `ADMIN_EMAIL`, `ADMIN_USERNAME`, and `ADMIN_INITIAL_PASSWORD` if the seed should create the first administrator. Generate distinct secrets with `openssl rand -hex 32`, restrict the file to the deploy user (`chmod 600 .env.prod.local`), and keep a secure copy. Do not copy the development passwords from `.env.example`. Then run:

```bash
./scripts/deploy-prod.sh
```

The app binds to `127.0.0.1:${KCTF_HOST_PORT:-3333}`. Configure either [host Caddy](../examples/reverse-proxy/Caddyfile) or [host Nginx](../examples/reverse-proxy/nginx.conf) to forward to it. The files under `examples/` are templates and are not loaded automatically. Replace domain and certificate paths, test the proxy configuration, then reload it. For access logs, create `/var/log/kctf` and grant write access to the selected proxy; see the [proxy examples](../examples/reverse-proxy/README.md). This path does not start bundled Caddy; keep the host proxy's lifecycle separate.

## Updating and checking production

Review changes and database migrations, take a current PostgreSQL backup, then run `./scripts/deploy-prod.sh` on the approved revision. That script builds the app, instancer and migration image; runs `prisma migrate deploy` and `prisma db seed`; and starts PostgreSQL, instancer and app. It does **not** create or update the bundled Caddy container. Check the service state and health endpoint afterward:

```bash
docker compose --env-file .env.prod.local -f docker-compose.prod.yml ps
curl -fsS http://127.0.0.1:3333/api/health
```

If `KCTF_HOST_PORT` differs, use that port in the check. Keep a database backup from before migrations: reverting application code alone may not reverse a schema migration. Production data lives in Docker volumes, while instance state uses `/var/lib/kctf-instancer`; account for both in host recovery planning.

## Reviewed production deployment

The manually dispatched [Deploy production workflow](../.github/workflows/deploy.yml) first verifies that the exact `Master` revision already has a successful push CI run; it does not repeat the full suite and therefore avoids duplicate Actions usage. GitHub pauses the SSH job for approval only when required reviewers are configured for the `production` environment. After CI evidence and any configured environment protections pass, the SSH step checks that the dispatch came from `Master`. It then requires the host's fetched `Master` tip to match the triggering commit, and the host checkout must be clean. The remote script saves a private PostgreSQL custom-format dump under the deploy user's `~/kctf-backups` (or `KCTF_BACKUP_DIR` if set on the host) before checking out that commit, running `deploy-prod.sh`, and probing the app's published loopback port. It prints the previous revision and backup path for recovery. A failed backup stops deployment. A failed migration or health check leaves the backup available for an operator to assess and recover; no automatic database rollback occurs.

Before using the workflow for a production deployment, provision a dedicated deploy user with access to the repository checkout and Docker, and configure its `origin` to fetch the same repository. Complete the first install and verify `.env.prod.local` and the database are present. In GitHub **Settings → Environments → production**, configure required reviewers, prevent self-review if desired, and restrict deployment branches to `Master`. Add these **environment secrets**:

| Secret | Value |
| --- | --- |
| `DEPLOY_HOST` | Hostname or IP address of the production SSH server |
| `DEPLOY_USER` | Dedicated SSH deploy user |
| `DEPLOY_SSH_KEY` | Private SSH key authorized for that user |
| `DEPLOY_KNOWN_HOSTS` | Verified SSH host key entry for `DEPLOY_HOST` |
| `DEPLOY_PATH` | Absolute path to the host checkout; use letters, digits, `_`, `.`, `/`, or `-` |

Verify the host key out of band before adding `DEPLOY_KNOWN_HOSTS`; do not disable SSH host key checks. Protect the deploy key and restrict who can dispatch workflows. **The environment name alone does not enforce approval.** Review the exact SHA, migrations, backup capacity, and maintenance window before approving a run. Once the workflow file is available in GitHub, it can be dispatched; the host credentials are needed for deployment to succeed, and required reviewers must be configured separately to make approval mandatory. Adding the workflow file does not itself deploy anything.

The separate [Release images workflow](../.github/workflows/release.yml) requires successful push CI for the exact `Master` revision and publishes SHA-tagged multi-platform (`linux/amd64`, `linux/arm64`) web and instancer images to GHCR. Multi-platform publishing runs only on manual dispatch and can take longer than a single-architecture build. It does not deploy those images to the host; the host deployment builds from the approved checkout with the existing script. Its `release` environment also requires [explicit reviewer configuration](policy-setup.md) to act as an approval gate. Do not treat green CI or an AI-authored commit as deployment permission.

## Instance confirmation

In the participant challenge dialog, `Instance 종료` and `이 문제로 교체` can discard work inside the active challenge VM. Both actions require an action-specific confirmation before the API request is sent. Cancelling the dialog preserves the current Instance and does not call the mutation endpoint.
