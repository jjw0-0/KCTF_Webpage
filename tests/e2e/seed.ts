import bcrypt from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required');
const parsed = new URL(url);
if (parsed.hostname !== '127.0.0.1' || parsed.port !== '5433' || parsed.pathname !== '/kctf_test') {
  throw new Error('E2E seed only runs against the isolated local kctf_test database on port 5433');
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
const longDeploymentError = 'Docker image build failed: the deployment archive contains an invalid multi-stage configuration and the final runtime image could not resolve the requested entrypoint. Review the complete build output before uploading a corrected archive.';

try {
  await prisma.cTF.upsert({
    where: { id: 'kctf-2026' },
    create: { id: 'kctf-2026', name: 'E2E CTF', mode: 'INDIVIDUAL', status: 'ONGOING' },
    update: { status: 'ONGOING', startTime: null, endTime: null },
  });

  for (const category of [
    { id: 'e2e-web', name: 'Web', slug: 'web', shortName: 'WEB', sortOrder: 1 },
    { id: 'e2e-pwn', name: 'Pwnable', slug: 'pwn', shortName: 'PWN', sortOrder: 2 },
  ]) {
    await prisma.category.upsert({
      where: { id: category.id },
      create: { ...category, ctfId: 'kctf-2026', isVisible: true },
      update: { isVisible: true },
    });
  }

  for (const challenge of [
    {
      id: 'e2e-markdown', title: 'Markdown Signal', categoryId: 'e2e-web', points: 100,
      summary: 'A concise web challenge.',
      description: '# Signal\n\nRead the **response headers** to find the flag.\n\n- Inspect the request\n- Compare the cache',
      connectionType: 'HTTP' as const, connectionUrl: 'https://example.com/challenge', flag: 'KCTF{e2e_signal}',
      isVisible: true,
    },
    {
      id: 'e2e-tcp', title: 'Socket Relay', categoryId: 'e2e-pwn', points: 200,
      summary: 'Connect to the relay.',
      description: '# Relay\n\nThe service speaks a line protocol. Send `HELLO` first, then read the response.\n\n'
        + Array.from({ length: 20 }, (_, index) => `## Stage ${index + 1}\n\nInspect the request and keep the connection open until the next response arrives.`).join('\n\n')
        + '\n\n```text\n' + Array.from({ length: 40 }, (_, index) => `TRACE ${String(index + 1).padStart(2, '0')} HELLO relay`).join('\n') + '\n```',
      connectionType: 'TCP' as const, connectionUrl: 'relay.example.com:31337', flag: 'KCTF{e2e_relay}',
      isVisible: true,
    },
    {
      id: 'e2e-instance', title: 'HTTP Workshop', categoryId: 'e2e-web', points: 150,
      summary: 'Start the isolated HTTP service.',
      description: '# Workshop\n\nOpen the isolated service and inspect its response.\n\n'
        + Array.from({ length: 14 }, (_, index) => `## Check ${index + 1}\n\nFollow the response chain and compare each header before submitting the flag.`).join('\n\n'),
      connectionType: 'HTTP' as const, connectionUrl: null, flag: 'KCTF{e2e_instance}',
      fileUrl: 'https://example.com/workshop.zip', attachmentName: 'workshop.zip',
      usesVm: true, instanceSlug: 'e2e-http', deploymentStatus: 'READY' as const,
      isVisible: true,
    },
    {
      id: 'e2e-failed-deployment', title: 'Failed Deployment Fixture', categoryId: 'e2e-web', points: 50,
      summary: 'Administrator-only deployment failure fixture.',
      description: 'This hidden challenge verifies complete deployment error disclosure.',
      connectionType: 'HTTP' as const, connectionUrl: null, flag: 'KCTF{e2e_hidden}',
      usesVm: true, deploymentStatus: 'FAILED' as const, deploymentError: longDeploymentError,
      isVisible: false,
    },
  ]) {
    await prisma.challenge.upsert({
      where: { id: challenge.id },
      create: { ...challenge, ctfId: 'kctf-2026', difficulty: 'BEGINNER' },
      update: challenge,
    });
  }

  const player = await prisma.user.upsert({
    where: { email: 'e2e@example.test' },
    create: {
      email: 'e2e@example.test', username: 'e2e_player',
      passwordHash: await bcrypt.hash('e2e-password-123', 10), role: 'USER',
    },
    update: { role: 'USER' },
  });
  await prisma.challengeInstance.upsert({
    where: { ownerKey: `user:${player.id}` },
    create: {
      id: 'e2e-active-instance', ownerKey: `user:${player.id}`, userId: player.id,
      challengeId: 'e2e-instance', instanceSlug: 'e2e-http', token: 'e2e-runtime-token',
      accessToken: 'e2e-browser-token', url: 'http://instance.example.test:10022',
      expiresAt: new Date(Date.now() + 60 * 60_000),
    },
    update: {
      challengeId: 'e2e-instance', instanceSlug: 'e2e-http', token: 'e2e-runtime-token',
      accessToken: 'e2e-browser-token', url: 'http://instance.example.test:10022',
      expiresAt: new Date(Date.now() + 60 * 60_000),
    },
  });
  await prisma.user.upsert({
    where: { email: 'e2e-admin@example.test' },
    create: {
      email: 'e2e-admin@example.test', username: 'e2e_admin',
      passwordHash: await bcrypt.hash('e2e-password-123', 10), role: 'ADMIN',
    },
    update: { role: 'ADMIN' },
  });
  console.log('Seeded isolated E2E fixtures.');
} finally {
  await prisma.$disconnect();
}
