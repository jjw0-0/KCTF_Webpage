# Contributing to K.knock CTF Platform

Issues and pull requests are welcome. Describe the behavior you want to change, the reason, and a way to verify it. For UI changes, include screenshots at desktop and mobile widths when practical. Keep challenge flags, private deployment ZIPs, credentials, and participant data out of commits and screenshots.

## Development checks

Use Node.js 22 LTS (22.12 or later) and npm 10+. After `npm ci`, run the checks relevant to your change:

```bash
npm run prisma:generate
npm run lint
npm run type-check
npm test
npm run build
npm audit --omit=dev --audit-level=moderate
npm --prefix services/instancer ci
npm --prefix services/instancer test
npm --prefix services/instancer audit --omit=dev --audit-level=moderate
```

The production build needs `AUTH_SECRET` and `DATABASE_URL`; use local development values. Browser tests use an isolated PostgreSQL database and seeded account:

```bash
docker run --rm -d --name kctf-e2e-db -e POSTGRES_USER=kctf_test -e POSTGRES_PASSWORD=kctf_test -e POSTGRES_DB=kctf_test -p 127.0.0.1:5433:5432 postgres:16-alpine
export DATABASE_URL=postgresql://kctf_test:kctf_test@127.0.0.1:5433/kctf_test
npm run prisma:generate
npx prisma migrate deploy
npm run test:e2e:seed
npx playwright install chromium firefox webkit
npm run test:e2e
docker stop kctf-e2e-db
```

The seed rejects other database hosts, ports, or names. The fixture player is `e2e@example.test` and the fixture administrator is `e2e-admin@example.test`; both use `e2e-password-123` in that isolated database only. Playwright starts its own development server on port 3100. The default run executes the browser suite in Chromium and `tests/e2e/accessibility.spec.ts` in Firefox and WebKit. Local development and database setup are described in the [README](README.en.md). Keep migrations with schema changes and update both READMEs when public setup or behavior changes.

The [CI workflow](.github/workflows/ci.yml) runs lint, types, unit tests, build, dependency audits, instancer tests, the Chromium browser suite, and focused Firefox and WebKit accessibility tests on pull requests and pushes to `Master`. The separate [release workflow](.github/workflows/release.yml) is manually dispatched, runs CI first, then publishes revision-tagged web and instancer images to GHCR when dispatched from `Master`. The [production deployment workflow](.github/workflows/deploy.yml) is also manually dispatched and calls CI before a reviewed SSH deployment. Maintainers must configure required reviewers in both the `release` and `production` environments to make those steps wait for approval; see [policy setup](docs/policy-setup.md) and [operations](docs/operations.md).

## Submitting a change

1. Create a focused branch and make the smallest complete change.
2. Run the relevant checks and describe their results in the pull request.
3. Explain deployment or migration effects and include a rollback note if production data or infrastructure changes.

Maintainers review and merge changes. CI is a review gate; a passing run does not authorize production deployment. Contributors and AI assistants may prepare local commits or pull requests when requested. **Do not push, merge, or deploy without the repository owner's explicit authorization for that action.**

### Optional AI-assisted contribution

A maintainer can ask an AI assistant to prepare a focused patch, run the relevant checks, and show the diff for review. Ask separately for a local commit if wanted. Pushing a branch, opening a remote pull request, merging, publishing an image, and deploying each require the owner's explicit authorization; no repository instruction here grants automatic push access.

## Security reports

Please avoid public issues or proof of concept details for a suspected vulnerability. Maintainers should first publish a private reporting route as described in [policy setup](docs/policy-setup.md). Until then, contact a K.knock maintainer through an established private channel. Do not test against a live event or participant instance without authorization.

## License status

The repository does not yet state reuse terms. See [policy setup](docs/policy-setup.md) before assuming a contribution or downstream use is covered by an open source license.
