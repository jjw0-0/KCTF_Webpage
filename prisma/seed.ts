import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { defaultCategories } from '../src/lib/platform-data';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required to seed KCTF.');

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString, connectionTimeoutMillis: 5_000, max: 2 }),
});

async function main() {
  const bootstrapDefaults = !(await prisma.cTF.findUnique({ where: { id: 'kctf-2026' }, select: { id: true } }));
  await prisma.cTF.upsert({
    where: { id: 'kctf-2026' },
    create: {
      id: 'kctf-2026',
      name: 'KCTF 2026',
      description: 'K.knock internal security competition',
      mode: 'INDIVIDUAL',
      status: 'SCHEDULED',
      startTime: new Date('2026-12-10T01:00:00.000Z'),
      endTime: new Date('2026-12-13T13:00:00.000Z'),
    },
    update: { mode: 'INDIVIDUAL' },
  });

  if (bootstrapDefaults) {
    for (const category of defaultCategories) {
      await prisma.category.create({
        data: {
          id: category.id,
          ctfId: 'kctf-2026',
          name: category.name,
          slug: category.slug,
          shortName: category.shortName,
          description: category.description,
          accentColor: category.color,
          sortOrder: category.order,
          isVisible: category.visible,
        },
      });
    }
  }

  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const adminUsername = process.env.ADMIN_USERNAME?.trim();
  const adminPassword = process.env.ADMIN_INITIAL_PASSWORD;
  if (adminEmail && adminUsername && adminPassword) {
    if (adminPassword.length < 14) throw new Error('ADMIN_INITIAL_PASSWORD must be at least 14 characters.');
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    await prisma.user.upsert({
      where: { email: adminEmail },
      create: {
        email: adminEmail,
        username: adminUsername,
        passwordHash,
        role: 'ADMIN',
      },
      update: {},
    });
    console.log(`Admin account ensured for ${adminEmail}.`);
  } else {
    console.log('Admin account skipped; provide ADMIN_EMAIL, ADMIN_USERNAME, and ADMIN_INITIAL_PASSWORD to create one.');
  }

  console.log(bootstrapDefaults
    ? `Bootstrapped KCTF 2026 with ${defaultCategories.length} categories and an empty challenge catalog.`
    : 'KCTF 2026 already exists; preserved administrator-managed categories and challenges.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

