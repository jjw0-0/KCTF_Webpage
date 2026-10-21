import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // Generation does not connect to the database. Runtime always receives the
    // real URL from Docker; the fallback keeps local code generation portable.
    url: process.env.DATABASE_URL ?? 'postgresql://kctf:kctf@127.0.0.1:5432/kctf',
  },
});
