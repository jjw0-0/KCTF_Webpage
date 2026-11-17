# K.knock CTF Platform

[한국어](README.md) · [Contributing](CONTRIBUTING.md) · [Operations](docs/operations.md) · [Policy setup](docs/policy-setup.md)

The CTF platform operated by **K.knock**, the information security club at Kyonggi University. It supports challenges and submissions, individual and team scoreboards, an administrator console, and per-user or per-team Docker instances.

## Get started

Production requires Docker Engine, Docker Compose, OpenSSL, a domain pointing to the server, and open ports 80/443 plus the configured instance port range.

```bash
git clone https://github.com/jjw0-0/KCTF_Webpage.git
cd KCTF_Webpage
./scripts/install.sh ctf.example.com
```

On its first run, the installer generates secrets in `.env.prod.local`, runs PostgreSQL migrations and seed, then starts the app, instancer, and Caddy. It prints the initial administrator credentials only when it creates the environment file. **Store that output and the environment file securely.** For an existing reverse proxy, follow the manual deployment steps in [Operations](docs/operations.md).

For local development, use Node.js 22 LTS (22.12 or later), npm 10+, and PostgreSQL. Copy [`.env.example`](.env.example) to `.env`, set local values, then run:

```bash
npm ci
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

The app opens at `http://localhost:3000` by default. After setting `.env`, start the Docker Compose development environment with `docker compose up --build`. This configuration mounts the Docker socket into the instancer; use it only on a trusted development host.

## At a glance

| Component | Purpose |
| --- | --- |
| Next.js · React · TypeScript | Participant and administrator UI, API |
| PostgreSQL · Prisma | Accounts, challenges, submissions, scores |
| Docker instancer | Isolated challenge instances and lifecycle |

Challenge cards use **PTS** and **SOLVERS**; detail views use **Author** and **INSTANCE**. Administrators can upload a public participant ZIP and a separate private deployment ZIP. Put `Dockerfile` or `docker-compose.yml` at the deployment ZIP root and specify the container's internal entry port. Enable `Docker Compose 사용` in the administrator form for Compose challenges. The instancer assigns the public port.

## Operations and policies

- [Operations](docs/operations.md): environment, ports, proxy, deploys, and checks
- [Contributing](CONTRIBUTING.md): development checks and proposing changes
- [UI decisions](docs/ui-polish.md): challenge board accessibility, navigation, and motion
- [Policy setup](docs/policy-setup.md): license decision, security reporting, and deployment approval settings

**A license has not been selected.** `Copyright © 2026 K.knock`; reuse terms remain unspecified until maintainers choose a license and publish a `LICENSE` file.
