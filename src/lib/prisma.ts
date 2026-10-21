/**
 * Prisma Client 싱글톤 인스턴스
 * Next.js 개발 환경에서 Hot Reload 시 다중 데이터베이스 연결을 방지합니다.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  // Creating a client is safe during Next.js builds; the adapter connects lazily.
  // Production provides DATABASE_URL through the container environment.
  const connectionString = process.env.DATABASE_URL
    ?? 'postgresql://kctf:kctf@127.0.0.1:5432/kctf';

  const adapter = new PrismaPg({
    connectionString,
    connectionTimeoutMillis: 5_000,
    max: 10,
  });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
