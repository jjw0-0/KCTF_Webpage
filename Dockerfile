# Docker 이미지 빌드 명세서
# Next.js 애플리케이션을 컨테이너로 패키징
# Multi-stage 빌드로 개발/프로덕션 환경을 분리하고 최종 이미지 크기를 최소화합니다.

# Base stage - 공통 베이스 이미지
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

# Dependencies stage
FROM base AS deps
COPY package.json package-lock.json* ./

RUN npm ci

# Development stage
FROM base AS development
COPY package.json package-lock.json* ./

RUN npm ci

COPY . .
RUN npx prisma generate
EXPOSE 3000
ENV PORT 3000
CMD ["npm", "run", "dev"]

# Builder stage
FROM base AS builder
COPY package.json package-lock.json* ./

RUN npm ci

COPY . .
RUN npx prisma generate
RUN npm run build

# Production stage
FROM base AS production
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
