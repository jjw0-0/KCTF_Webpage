import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { createRemoteInstance, destroyRemoteInstance } from '@/lib/instancer';
import { challenges } from '@/lib/platform-data';
import { prisma } from '@/lib/prisma';
import { consumeRateLimit, rateLimitHeaders } from '@/lib/rate-limit';

const requestSchema = z.object({ challengeId: z.string().min(1).max(80) });

async function currentUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, instancerId: true },
  });
}

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const instance = await prisma.challengeInstance.findUnique({ where: { userId: user.id } });
  if (!instance || instance.expiresAt <= new Date()) {
    if (instance) await prisma.challengeInstance.delete({ where: { userId: user.id } });
    return NextResponse.json({ instance: null });
  }
  return NextResponse.json({
    instance: { challengeId: instance.challengeId, url: instance.url, expiresAt: instance.expiresAt },
  });
}

export async function POST(request: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const limit = consumeRateLimit(`instance:${user.id}`, 3, 60_000);
  if (!limit.allowed) {
    return NextResponse.json({ error: 'VM 발급 요청이 너무 빠릅니다.' }, { status: 429, headers: rateLimitHeaders(limit) });
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: '문제 ID가 올바르지 않습니다.' }, { status: 400 });
  const challenge = challenges.find((item) => item.id === parsed.data.challengeId);
  if (!challenge?.instanceSlug) return NextResponse.json({ error: '이 문제는 VM 발급을 지원하지 않습니다.' }, { status: 400 });

  try {
    const remote = await createRemoteInstance(challenge.instanceSlug, user.instancerId);
    const instance = await prisma.challengeInstance.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        challengeId: challenge.id,
        instanceSlug: challenge.instanceSlug,
        token: remote.token,
        url: remote.url,
        expiresAt: new Date(remote.expires_at),
      },
      update: {
        challengeId: challenge.id,
        instanceSlug: challenge.instanceSlug,
        token: remote.token,
        url: remote.url,
        expiresAt: new Date(remote.expires_at),
      },
    });
    return NextResponse.json({
      instance: { challengeId: instance.challengeId, url: instance.url, expiresAt: instance.expiresAt },
    }, { status: 201, headers: rateLimitHeaders(limit) });
  } catch (error) {
    console.error('Instancer create failed.', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'VM 발급에 실패했습니다.' }, { status: 502 });
  }
}

export async function DELETE() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  const instance = await prisma.challengeInstance.findUnique({ where: { userId: user.id } });
  if (!instance) return NextResponse.json({ instance: null });

  try {
    await destroyRemoteInstance(instance.token);
    await prisma.challengeInstance.delete({ where: { userId: user.id } });
    return NextResponse.json({ instance: null });
  } catch (error) {
    console.error('Instancer destroy failed.', error);
    return NextResponse.json({ error: 'VM 종료에 실패했습니다.' }, { status: 502 });
  }
}

