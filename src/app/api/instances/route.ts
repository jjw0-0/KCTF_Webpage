import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { formatActor, recordServerLog } from '@/lib/admin-logs';
import { ACTIVE_CTF_ID } from '@/lib/categories';
import { getCtfAccess } from '@/lib/ctf-access';
import { createRemoteInstance, destroyRemoteInstance } from '@/lib/instancer';
import { prisma } from '@/lib/prisma';
import { consumeRateLimit, rateLimitHeaders } from '@/lib/rate-limit';

const createSchema = z.object({ challengeId: z.string().min(1).max(64) });

async function currentUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, instancerId: true, username: true, email: true, isActive: true },
  });
  return user?.isActive ? user : null;
}

export async function GET(request: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const instance = await prisma.challengeInstance.findUnique({ where: { userId: user.id } });
  if (!instance) return NextResponse.json({ instance: null });

  if (instance.expiresAt.getTime() <= Date.now()) {
    await destroyRemoteInstance(instance.token).catch(() => null);
    await prisma.challengeInstance.delete({ where: { id: instance.id } }).catch(() => null);
    recordServerLog({
      level: 'INFO',
      source: 'VM',
      action: 'VM_EXPIRED_CLEANUP',
      actor: formatActor(user),
      actorId: user.id,
      request,
      statusCode: 200,
      message: `만료된 Instance 자동 정리: ${formatActor(user)} → slug=${instance.instanceSlug}`,
      params: {
        challengeId: instance.challengeId,
        instanceSlug: instance.instanceSlug,
        instancerId: user.instancerId,
        vmUrl: instance.url,
        expiresAt: instance.expiresAt.toISOString(),
      },
    });
    return NextResponse.json({ instance: null });
  }

  return NextResponse.json({
    instance: {
      challengeId: instance.challengeId,
      instanceSlug: instance.instanceSlug,
      url: instance.url,
      expiresAt: instance.expiresAt.toISOString(),
    },
  });
}

export async function POST(request: NextRequest) {
  const user = await currentUser();
  if (!user) {
    recordServerLog({
      level: 'WARN',
      source: 'VM',
      action: 'VM_CREATE_UNAUTHORIZED',
      actor: 'anonymous',
      request,
      statusCode: 401,
      message: '비로그인 사용자의 Instance 생성 요청 차단',
    });
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const actor = formatActor(user);
  const access = await getCtfAccess(ACTIVE_CTF_ID);
  if (!access.open) {
    recordServerLog({
      level: 'WARN',
      source: 'VM',
      action: 'VM_CREATE_DENIED',
      actor,
      actorId: user.id,
      request,
      statusCode: 403,
      message: `대회 비활성 중 Instance 생성 요청 차단: ${actor} (${access.reason})`,
      params: { instancerId: user.instancerId, reason: access.reason },
    });
    return NextResponse.json({ error: access.reason }, { status: 403 });
  }

  const limit = consumeRateLimit(`instance:${user.id}`, 3, 60_000);
  if (!limit.allowed) {
    recordServerLog({
      level: 'WARN',
      source: 'VM',
      action: 'VM_CREATE_RATE_LIMIT',
      actor,
      actorId: user.id,
      request,
      statusCode: 429,
      message: `Instance 생성 요청 속도 제한 초과 (Rate Limit): ${actor}`,
      params: {
        instancerId: user.instancerId,
        resetAt: new Date(limit.resetAt).toISOString(),
      },
    });
    return NextResponse.json(
      { error: 'Instance 요청이 너무 빠릅니다. 잠시 후 다시 시도해 주세요.' },
      { status: 429, headers: rateLimitHeaders(limit) },
    );
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(rawBody);
  if (!parsed.success) {
    recordServerLog({
      level: 'WARN',
      source: 'VM',
      action: 'VM_CREATE_BAD_REQUEST',
      actor,
      actorId: user.id,
      request,
      statusCode: 400,
      message: `잘못된 Instance 생성 요청 파라미터: ${actor}`,
      params: { rawBody, instancerId: user.instancerId },
    });
    return NextResponse.json({ error: '문제 정보를 확인해 주세요.' }, { status: 400 });
  }

  const challenge = await prisma.challenge.findFirst({
    where: {
      id: parsed.data.challengeId,
      ctfId: ACTIVE_CTF_ID,
      isVisible: true,
      usesVm: true,
      instanceSlug: { not: null },
      deploymentStatus: 'READY',
    },
    select: { id: true, title: true, instanceSlug: true },
  });
  if (!challenge?.instanceSlug) {
    recordServerLog({
      level: 'WARN',
      source: 'VM',
      action: 'VM_CREATE_NOT_FOUND',
      actor,
      actorId: user.id,
      request,
      statusCode: 404,
      message: `존재하지 않거나 비활성화된 Instance 문제 요청: ${actor} → challengeId=${parsed.data.challengeId}`,
      params: { challengeId: parsed.data.challengeId, instancerId: user.instancerId },
    });
    return NextResponse.json({ error: 'Instance를 사용할 수 없는 문제입니다.' }, { status: 404 });
  }

  try {
    const remote = await createRemoteInstance(challenge.instanceSlug, user.instancerId);
    const expiresAt = new Date(remote.expires_at);
    const instance = await prisma.challengeInstance.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        challengeId: challenge.id,
        instanceSlug: challenge.instanceSlug,
        token: remote.token,
        url: remote.url,
        expiresAt,
      },
      update: {
        challengeId: challenge.id,
        instanceSlug: challenge.instanceSlug,
        token: remote.token,
        url: remote.url,
        expiresAt,
      },
    });

    recordServerLog({
      id: `vm-inst-${instance.id}`,
      level: 'INFO',
      source: 'VM',
      action: 'VM_CREATE',
      actor,
      actorId: user.id,
      request,
      statusCode: 200,
      message: `Instance 생성 요청 및 할당 완료: ${actor} → [${challenge.title}] (${instance.url})`,
      params: {
        instanceId: instance.id,
        challengeId: challenge.id,
        challengeTitle: challenge.title,
        instanceSlug: challenge.instanceSlug,
        instancerId: user.instancerId,
        vmUrl: instance.url,
        expiresAt: instance.expiresAt.toISOString(),
      },
    });

    return NextResponse.json({
      instance: {
        challengeId: instance.challengeId,
        instanceSlug: instance.instanceSlug,
        url: instance.url,
        expiresAt: instance.expiresAt.toISOString(),
      },
    }, { headers: rateLimitHeaders(limit) });
  } catch (error) {
    console.error('Failed to create challenge instance.', error);
    recordServerLog({
      level: 'ERROR',
      source: 'VM',
      action: 'VM_CREATE_ERROR',
      actor,
      actorId: user.id,
      request,
      statusCode: 502,
      message: `Instance 생성 실패: ${actor} → [${challenge.title}] (slug=${challenge.instanceSlug})`,
      params: {
        challengeId: challenge.id,
        challengeTitle: challenge.title,
        instanceSlug: challenge.instanceSlug,
        instancerId: user.instancerId,
        error: error instanceof Error ? error.message : String(error),
      },
    });
    return NextResponse.json({ error: 'Instance를 시작하지 못했습니다. 관리자에게 문의해 주세요.' }, { status: 502 });
  }
}

export async function DELETE(request: NextRequest) {
  const user = await currentUser();
  if (!user) {
    recordServerLog({
      level: 'WARN',
      source: 'VM',
      action: 'VM_DESTROY_UNAUTHORIZED',
      actor: 'anonymous',
      request,
      statusCode: 401,
      message: '비로그인 사용자의 Instance 종료 요청 차단',
    });
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const actor = formatActor(user);
  const instance = await prisma.challengeInstance.findUnique({ where: { userId: user.id } });
  if (!instance) {
    recordServerLog({
      level: 'INFO',
      source: 'VM',
      action: 'VM_DESTROY_NOOP',
      actor,
      actorId: user.id,
      request,
      statusCode: 200,
      message: `활성 Instance 없음 상태에서 종료 요청: ${actor}`,
      params: { instancerId: user.instancerId },
    });
    return NextResponse.json({ instance: null });
  }

  try {
    await destroyRemoteInstance(instance.token);
  } catch (error) {
    console.error('Failed to destroy challenge instance.', error);
    recordServerLog({
      level: 'ERROR',
      source: 'VM',
      action: 'VM_DESTROY_ERROR',
      actor,
      actorId: user.id,
      request,
      statusCode: 502,
      message: `Instance 원격 종료 실패: ${actor} → slug=${instance.instanceSlug} (${instance.url})`,
      params: {
        challengeId: instance.challengeId,
        instanceSlug: instance.instanceSlug,
        instancerId: user.instancerId,
        vmUrl: instance.url,
        error: error instanceof Error ? error.message : String(error),
      },
    });
    return NextResponse.json({ error: 'Instance를 종료하지 못했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 502 });
  }

  await prisma.challengeInstance.delete({ where: { id: instance.id } }).catch(() => null);
  recordServerLog({
    level: 'INFO',
    source: 'VM',
    action: 'VM_DESTROY',
    actor,
    actorId: user.id,
    request,
    statusCode: 200,
    message: `Instance 종료 완료: ${actor} → slug=${instance.instanceSlug} (${instance.url})`,
    params: {
      instanceId: instance.id,
      challengeId: instance.challengeId,
      instanceSlug: instance.instanceSlug,
      instancerId: user.instancerId,
      vmUrl: instance.url,
    },
  });
  return NextResponse.json({ instance: null });
}
