# K.knock CTF Platform

[English](README.en.md)

경기대학교 정보보안 동아리 K.knock에서 운영하는 CTF 플랫폼입니다.

## 기술 스택

- Next.js, React, TypeScript
- PostgreSQL, Prisma
- Docker, Docker Compose

## 요구 사항

- Docker Engine
- Docker Compose
- 운영 서버를 가리키는 도메인

## 배포

```bash
git clone git@github.com:jjw0-0/KCTF_Webpage.git
cd KCTF_Webpage
./scripts/install.sh ctf.example.com
```

스크립트는 `.env.prod.local`을 생성하고 migration, seed, 애플리케이션,
instancer와 Caddy를 설정합니다. 최초 관리자 계정도 이때 생성됩니다.

이미 reverse proxy를 운영 중이면 `.env.prod.local`을 직접 작성하고 다음
스크립트만 실행합니다.

```bash
./scripts/deploy-prod.sh
```

애플리케이션은 호스트의 `127.0.0.1:3020`에서 대기합니다.

## 설정

전체 환경변수 형식은 [.env.example](.env.example)에 있습니다. 운영에 필요한
주요 값은 다음과 같습니다.

| 변수 | 용도 |
| --- | --- |
| `DOMAIN` | 플랫폼 도메인 |
| `POSTGRES_*` | PostgreSQL 접속 정보 |
| `NEXTAUTH_SECRET` | 세션 서명 키 |
| `DYNAMIC_FLAG_SECRET` | 개인·팀별 플래그 생성 키 |
| `KCTF_INSTANCER_TOKEN` | 애플리케이션과 instancer 사이의 인증 키 |
| `INSTANCER_PUBLIC_HOST` | 문제 인스턴스 접속 호스트 |
| `DISCORD_SOLVE_WEBHOOK_URL` | Solve 알림 Webhook, 선택 사항 |

인스턴스 포트는 [config/instancer.env](config/instancer.env)에서 지정합니다.

```dotenv
INSTANCER_PORT_MIN=10021
INSTANCER_PORT_MAX=10030
```

같은 범위를 서버 방화벽에도 열어야 합니다. 일반 Cloudflare 프록시는 이
포트들을 전달하지 않으므로 인스턴스용 호스트는 DNS Only로 설정합니다.

## Reverse proxy

Caddy와 Nginx 중 하나만 사용합니다.

- [deploy/caddy/Caddyfile](deploy/caddy/Caddyfile): Docker Compose가 사용하는
  실제 Caddy 설정
- [examples/reverse-proxy/Caddyfile](examples/reverse-proxy/Caddyfile): 호스트
  Caddy 예시
- [examples/reverse-proxy/nginx.conf](examples/reverse-proxy/nginx.conf): 호스트
  Nginx 예시

`examples/`의 파일은 자동으로 사용되지 않습니다. 하나를 복사해 도메인과
인증서 경로를 수정합니다. HTTP 로그를 사용하려면 `/var/log/kctf`를 만들고
선택한 proxy가 쓸 수 있게 설정해야 합니다.

## 인스턴스 문제

관리자 화면에서 다음 두 파일을 등록할 수 있습니다.

- 풀이자 제공 ZIP: 참가자가 내려받는 파일
- Instance 배포 ZIP: instancer가 빌드하는 비공개 파일

Dockerfile 문제는 ZIP 최상위에 `Dockerfile`을 둡니다. Compose 문제는
최상위에 `docker-compose.yml`을 두고 관리자 화면에서 `Docker Compose 사용`을
켭니다. 두 방식 모두 참가자가 접속할 컨테이너 내부 포트를 입력해야 합니다.

```yaml
services:
  web:
    build: ./web
    depends_on: [db]
    expose: ["8080"]
  db:
    image: postgres:16-alpine
```

Instancer가 공개 포트를 할당하므로 Compose의 published port는 사용하지
않습니다.

Privileged mode, Docker socket, host namespace, device, capability 추가,
절대 경로 mount와 external network/volume은 거부됩니다. 인스턴스에는 CPU,
memory, PID와 capability 제한이 적용됩니다.

개인전에서는 사용자마다, 팀전에서는 팀마다 인스턴스 하나를 사용합니다.

## License

Copyright © 2026 K.knock
