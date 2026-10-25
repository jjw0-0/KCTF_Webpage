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

## Installation and running

Docker Compose is the simplest way to run the platform locally:

```bash
git clone git@github.com:jjw0-0/KCTF_Webpage.git
cd KCTF_Webpage
cp .env.example .env
docker compose up --build
```

Update the values in `.env` before starting, then open
`http://localhost:3000`. To run Next.js directly while keeping PostgreSQL in
Docker:

```bash
npm install
docker compose up -d postgres
npm run prisma:migrate
npm run dev
```

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

## Screenshots

![KCTF landing page](output/playwright/kctf-home.png)

The landing page summarizes the event schedule and challenge categories, with
direct links to registration, challenges, and the scoreboard.

![KCTF login page](output/playwright/kctf-login.png)

Protected challenge routes redirect unauthenticated visitors to the shared
login screen before showing participant content.

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

## Challenge content

The challenge board (`/ctf`) uses the network background and supports category
filtering. Reduced-motion preferences disable card movement and freeze the
background. Geist Sans/Mono are self-hosted from Vercel's official `geist`
package; Noto Sans KR supplies the Korean glyphs missing from Geist. The KCTF
brand lettering retains its display face.

The administrator's Challenges form supports an author name, an optional file URL,
and Markdown descriptions with a live preview. Existing plain-text descriptions
continue to work. Use blank lines between media and text:

```markdown
## 문제 설명
텍스트와 **강조**, 목록, 코드 블록을 사용할 수 있습니다.

![이미지 설명](https://example.com/diagram.png)

[문제 영상](https://example.com/demo.mp4)

[참고 영상](https://www.youtube.com/watch?v=VIDEO_ID)
```

MP4, WebM, OGV and M4V links render native video controls; YouTube and Vimeo
links render embedded players. Raw HTML is not rendered. Media and attachment
URLs must use HTTP(S) or a same-site path starting with `/`. Upload files to
your hosting first, then use their URL. A missing file or VM slug hides that
section in the participant dialog. The description scrolls while the flag
submission form stays visible.

## License

Copyright © 2025 K.knock
