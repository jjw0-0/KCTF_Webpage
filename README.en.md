# K.knock CTF Platform

[한국어](README.md)

A CTF platform operated by K.knock, the information security club at Kyonggi
University.

## Stack

- Next.js, React, TypeScript
- PostgreSQL, Prisma
- Docker, Docker Compose

## Requirements

- Docker Engine
- Docker Compose
- A domain pointing to the production server

## Deployment

```bash
git clone git@github.com:jjw0-0/KCTF_Webpage.git
cd KCTF_Webpage
./scripts/install.sh ctf.example.com
```

The script creates `.env.prod.local`, applies migrations and seed data, and
starts the application, instancer, and Caddy. It also creates the initial
administrator.

If the host already runs a reverse proxy, create `.env.prod.local` and run:

```bash
./scripts/deploy-prod.sh
```

The application listens on `127.0.0.1:3020` on the host.

## Configuration

See [.env.example](.env.example) for the complete environment template.

| Variable | Purpose |
| --- | --- |
| `DOMAIN` | Platform domain |
| `POSTGRES_*` | PostgreSQL connection |
| `NEXTAUTH_SECRET` | Session signing key |
| `DYNAMIC_FLAG_SECRET` | Per-user or per-team flag key |
| `KCTF_INSTANCER_TOKEN` | Application-to-instancer credential |
| `INSTANCER_PUBLIC_HOST` | Public instance host |
| `DISCORD_SOLVE_WEBHOOK_URL` | Optional solve notification webhook |

Set the instance port range in
[config/instancer.env](config/instancer.env):

```dotenv
INSTANCER_PORT_MIN=10021
INSTANCER_PORT_MAX=10030
```

Open the same range in the host firewall. A normal Cloudflare proxy does not
forward these ports, so the instance hostname must use DNS Only.

## Reverse proxy

Use either Caddy or Nginx.

- [deploy/caddy/Caddyfile](deploy/caddy/Caddyfile): Caddy configuration loaded
  by Docker Compose
- [examples/reverse-proxy/Caddyfile](examples/reverse-proxy/Caddyfile): host
  Caddy example
- [examples/reverse-proxy/nginx.conf](examples/reverse-proxy/nginx.conf): host
  Nginx example

Files under `examples/` are not loaded automatically. Copy one and replace its
domain and certificate paths. To collect HTTP logs, create `/var/log/kctf` and
make it writable by the selected proxy.

## Instance challenges

The administrator can attach two files to a challenge:

- Public ZIP: downloaded by participants
- Instance deployment ZIP: private source built by the instancer

For a Dockerfile challenge, place `Dockerfile` at the archive root. For a
Compose challenge, place `docker-compose.yml` at the root and enable Compose in
the administrator form. Both modes require the container's internal entry
port.

```yaml
services:
  web:
    build: ./web
    depends_on: [db]
    expose: ["8080"]
  db:
    image: postgres:16-alpine
```

The instancer allocates the public port and ignores Compose published ports.

Privileged mode, Docker sockets, host namespaces, devices, added capabilities,
absolute host mounts, and external networks or volumes are rejected. Runtime
CPU, memory, PID, and capability limits are applied.

Individual mode gives each user one instance. Team mode gives each team one
shared instance.

## License

Copyright © 2026 K.knock
