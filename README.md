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
│   │   ├── scoreboard/      # Team rankings
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

The production stack binds the app to loopback port `3020`; Caddy terminates TLS
for `ctf.jjw0-0.kr` and proxies requests to the container.

```bash
docker compose --env-file .env.prod.local -f docker-compose.prod.yml up -d --build
```

Required variables are `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, and
`NEXTAUTH_SECRET`. Keep them in `.env.prod.local`, which is excluded by the
repository's `.env*.local` ignore rule.

## License

Copyright © 2025 K.knock
