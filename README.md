# KCTF Platform

KCTF 플랫폼으로, 공정하고 효율적인 대회 운영을 지원합니다.

## Tech Stack

- **Framework**: Next.js 15.5.6 (TypeScript)
- **UI**: Tailwind CSS, shadcn/ui
- **Database**: PostgreSQL 16
- **ORM**: Prisma
- **Authentication**: NextAuth.js
- **Real-time**: Server-Sent Events (SSE)
- **Web Server**: Nginx with secure_link (기존 서버에 설정 추가)
- **Infrastructure**: Docker Compose

## Prerequisites

- Docker and Docker Compose
- Node.js 20+
- npm

## Project Structure

```
/
├── public/                  # Static assets
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── (auth)/          # Auth pages
│   │   ├── (ctf)/           # CTF pages
│   │   ├── admin/           # Admin dashboard
│   │   └── api/             # API routes
│   ├── domains/             # Business logic
│   │   ├── challenges/      # Challenge domain
│   │   ├── users/           # User domain
│   │   ├── teams/           # Team domain
│   │   └── submissions/     # Submission domain
│   ├── lib/                 # Libraries and utilities
│   ├── components/          # Shared UI components
│   └── styles/              # Global styles
├── prisma/
│   ├── schema.prisma        # Prisma schema
│   └── migrations/          # Database migrations
├── docker-compose.yml       # Docker Compose configuration
├── Dockerfile               # Next.js Docker image
└── nginx/
    └── conf.d/              # Nginx configuration (서버에 복사하여 사용)
```

## Git Workflow

CI/CD는 추후 추가 예정입니다.

## License

Copyright © 2025 K.knock
