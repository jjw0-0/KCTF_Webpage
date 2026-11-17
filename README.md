# K.knock CTF Platform

[English](README.en.md) · [기여 안내](CONTRIBUTING.md) · [운영 가이드](docs/operations.md) · [공개 정책 준비](docs/policy-setup.md)

경기대학교 정보보안 동아리 **K.knock**의 CTF 플랫폼입니다. 문제 게시와 제출, 개인전·팀전 점수판, 관리자 운영 화면, 참가자별 또는 팀별 Docker 인스턴스를 지원합니다.

## 시작하기

운영 서버에는 Docker Engine, Docker Compose, OpenSSL, 서버를 가리키는 도메인이 필요합니다. 80/443 포트와 인스턴스 포트 범위를 열어야 합니다.

```bash
git clone https://github.com/jjw0-0/KCTF_Webpage.git
cd KCTF_Webpage
./scripts/install.sh ctf.example.com
```

처음 실행하면 설치 스크립트가 `.env.prod.local`에 비밀값을 생성하고 PostgreSQL migration과 seed를 실행한 뒤 앱, instancer, Caddy를 시작합니다. 최초 관리자 자격 증명은 새 환경 파일을 만들 때만 출력됩니다. **이 출력과 환경 파일을 안전하게 보관하세요.** 기존 reverse proxy를 사용한다면 [운영 가이드](docs/operations.md)의 수동 배포 절차를 따르세요.

개발 환경은 Node.js 22 LTS(22.12 이상), npm 10+, PostgreSQL이 필요합니다. [`.env.example`](.env.example)을 `.env`로 복사해 로컬 값을 설정한 다음 실행합니다.

```bash
npm ci
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

앱은 기본적으로 `http://localhost:3000`에서 열립니다. Docker Compose 개발 환경은 `.env`를 설정한 뒤 `docker compose up --build`로 실행할 수 있습니다. 이 구성은 Docker 소켓을 instancer에 연결하므로 신뢰할 수 있는 개발 호스트에서만 사용하세요.

## 주요 구성

| 구성 | 역할 |
| --- | --- |
| Next.js · React · TypeScript | 참가자 및 관리자 화면, API |
| PostgreSQL · Prisma | 계정, 문제, 제출, 점수 데이터 |
| Docker instancer | 격리된 문제 인스턴스 생성 및 수명 관리 |

문제 카드의 **PTS**, **SOLVERS**, 상세 화면의 **Author**, **INSTANCE** 표기는 실제 UI 용어를 따릅니다. 관리자는 참가자 제공 ZIP과 비공개 배포 ZIP을 별도로 등록할 수 있습니다. 배포 ZIP 최상위에 `Dockerfile` 또는 `docker-compose.yml`을 두고 컨테이너 내부 접속 포트를 지정합니다. Compose 문제는 관리자 화면에서 `Docker Compose 사용`을 켭니다. 외부 공개 포트는 instancer가 배정합니다.

## 운영과 정책

- [운영 가이드](docs/operations.md): 환경변수, 포트, proxy, 배포 및 점검
- [기여 안내](CONTRIBUTING.md): 개발 확인 명령과 변경 제안 방법
- [UI 결정 기록](docs/ui-polish.md): 문제 보드의 접근성, 동작, 모션 기준
- [공개 정책 준비](docs/policy-setup.md): 라이선스 결정, 보안 신고 채널, 배포 승인 설정

**라이선스는 아직 선택되지 않았습니다.** `Copyright © 2026 K.knock`이며, 재사용 조건은 유지관리자가 결정해 `LICENSE` 파일로 공개하기 전까지 명시되지 않습니다.
