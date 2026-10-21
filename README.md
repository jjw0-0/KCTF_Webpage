# KCTF Platform

KCTF 플랫폼으로, 공정하고 효율적인 대회 운영을 지원합니다.

## Tech Stack

- **Framework**: Next.js 16.4 (TypeScript, App Router)
- **UI**: React 19, Tailwind CSS, custom KCTF design system
- **Database**: PostgreSQL 16
- **ORM**: Prisma 7 with the PostgreSQL driver adapter
- **Web Server**: Caddy (TLS/reverse proxy) or Nginx
- **Infrastructure**: Docker Compose

## Prerequisites

- Docker and Docker Compose
- Node.js 22+
- npm

## Project Structure

```
/
├── public/                  # Static assets
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── (auth)/          # Auth pages
│   │   ├── ctf/             # Participant challenge board
│   │   ├── admin/           # Admin dashboard
│   │   ├── profile/         # Participant profile
│   │   ├── scoreboard/      # Individual rankings
│   │   └── api/             # API routes
│   ├── lib/                 # Libraries and utilities
│   ├── components/          # Shared UI components
├── prisma/
│   ├── schema.prisma        # Prisma schema
│   └── migrations/          # Database migrations
├── docker-compose.yml       # Docker Compose configuration
├── docker-compose.prod.yml  # Production stack
├── Dockerfile               # Next.js Docker image
└── nginx/
    └── conf.d/              # Nginx configuration (서버에 복사하여 사용)
```

## Git Workflow

CI/CD는 추후 추가 예정입니다.

## Production deployment

The production app listens on host loopback port `3020`; Caddy terminates TLS
for `ctf.jjw0-0.kr`. The deploy script applies migrations, seeds defaults, and
passes the existing `jjw-instancer` token without writing it to disk.

```bash
./scripts/deploy-prod.sh
```

Required variables are `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, and
`NEXTAUTH_SECRET`. Keep them in `.env.prod.local`, which is excluded by the
repository's `.env*.local` ignore rule.

To bootstrap an administrator, run the seed command with `ADMIN_EMAIL`,
`ADMIN_USERNAME`, and a 14+ character `ADMIN_INITIAL_PASSWORD` in the migration
container environment.

The seed creates sample challenge cards with unguessable placeholder flags. Set
the real flag, points, visibility, category, and optional instancer slug from the
administrator's **Challenges** screen before the event. Flags are stored as keyed
digests and are never returned by the API.

## License

Copyright © 2025 K.knock
