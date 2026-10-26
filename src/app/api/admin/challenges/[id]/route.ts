import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdminUser } from '@/lib/admin-auth';
import { formatActor, recordServerLog } from '@/lib/admin-logs';
import { ACTIVE_CTF_ID } from '@/lib/categories';
import { challengeInputSchema, deriveChallengeSummary } from '@/lib/challenge-input';
import { calculateChallengePoints } from '@/lib/challenge-scoring';
import { getAdminChallenges } from '@/lib/challenges';
import { deleteRemoteDeployment, destroyRemoteInstance } from '@/lib/instancer';
import { prisma } from '@/lib/prisma';

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: RouteContext) {
  const admin = await getCurrentAdminUser();
  if (!admin) {
    recordServerLog({
      level: 'WARN',
      source: 'ADMIN',
      action: 'ADMIN_CHALLENGE_UPDATE_DENIED',
      actor: 'unauthorized',
      request,
      statusCode: 403,
      message: '권한 없는 사용자의 문제 수정 시도 차단',
    });
    return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
  }

  const { id } = await params;
  const [existing, parsed] = await Promise.all([
    prisma.challenge.findFirst({ where: { id, ctfId: ACTIVE_CTF_ID }, select: { id: true, title: true, usesVm: true, dynamicFlag: true, usesCompose: true, instancePort: true, instanceSlug: true, _count: { select: { solves: true } } } }),
    request.json().catch(() => null).then((body) => challengeInputSchema.safeParse(body)),
  ]);
  if (!existing) return NextResponse.json({ error: '문제를 찾을 수 없습니다.' }, { status: 404 });
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? '입력값을 확인해 주세요.' }, { status: 400 });
  if (existing.usesVm && !parsed.data.usesVm && !parsed.data.flag) {
    return NextResponse.json({ error: '일반 문제로 변경할 때는 플래그를 입력해 주세요.' }, { status: 400 });
  }
  if (parsed.data.usesVm && !parsed.data.dynamicFlag && existing.dynamicFlag && !parsed.data.flag) {
    return NextResponse.json({ error: '고정 플래그로 변경할 때는 원본 플래그를 입력해 주세요.' }, { status: 400 });
  }

  const category = await prisma.category.findFirst({
    where: { id: parsed.data.categoryId, ctfId: ACTIVE_CTF_ID },
    select: { id: true },
  });
  if (!category) return NextResponse.json({ error: '카테고리를 찾을 수 없습니다.' }, { status: 400 });

  const { flag, visible, instanceSlug, usesVm, dynamicFlag, usesCompose, instancePort, connectionUrl, ...data } = parsed.data;
  const deploymentConfigChanged = existing.usesVm && usesVm
    && (existing.usesCompose !== usesCompose || existing.instancePort !== instancePort);
  if (existing.instanceSlug && (existing.usesVm && !usesVm || deploymentConfigChanged)) {
    await deleteRemoteDeployment(existing.instanceSlug);
  }
  try {
    await prisma.$transaction(async (transaction) => {
      const challenge = await transaction.challenge.update({
        where: { id },
        data: {
          ...data,
          summary: data.summary || deriveChallengeSummary(data.description),
          usesVm,
          dynamicFlag: usesVm && dynamicFlag,
          usesCompose: usesVm && usesCompose,
          instancePort: usesVm ? instancePort : null,
          connectionUrl: usesVm || !connectionUrl ? null : connectionUrl,
          instanceSlug: usesVm ? (instanceSlug || existing.instanceSlug || id) : null,
          isVisible: visible,
          ...(!usesVm || deploymentConfigChanged
            ? { deploymentStatus: 'NONE' as const, deploymentError: null, deploymentUpdatedAt: null }
            : {}),
          solveCount: existing._count.solves,
          ...(flag ? { flag } : {}),
        },
        select: { points: true, scoringMode: true, minimumPoints: true, decaySolves: true, decrementPerSolve: true },
      });
      await transaction.solve.updateMany({
        where: { challengeId: id },
        data: { points: calculateChallengePoints(challenge, existing._count.solves) },
      });
    });
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') {
      return NextResponse.json({ error: '이미 사용 중인 VM slug입니다.' }, { status: 409 });
    }
    throw error;
  }

  const actor = formatActor(admin);
  recordServerLog({
    level: 'INFO',
    source: 'ADMIN',
    action: 'ADMIN_CHALLENGE_UPDATE',
    actor,
    actorId: admin.id,
    request,
    statusCode: 200,
    message: `관리자 문제 정보 수정: ${actor} → [${data.title}]`,
    params: {
      challengeId: id,
      title: data.title,
      categoryId: data.categoryId,
      points: data.points,
      scoringMode: data.scoringMode,
      usesVm,
      dynamicFlag: usesVm && dynamicFlag,
      usesCompose: usesVm && usesCompose,
      instancePort: usesVm ? instancePort : null,
      instanceSlug: usesVm && instanceSlug ? instanceSlug : null,
      connectionUrl: usesVm || !connectionUrl ? null : connectionUrl,
      visible,
      flagUpdated: Boolean(flag),
    },
  });

  revalidatePath('/ctf');
  revalidatePath('/admin');
  return NextResponse.json({ challengeId: id, challenges: await getAdminChallenges() });
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const admin = await getCurrentAdminUser();
  if (!admin) {
    recordServerLog({
      level: 'WARN',
      source: 'ADMIN',
      action: 'ADMIN_CHALLENGE_DELETE_DENIED',
      actor: 'unauthorized',
      request,
      statusCode: 403,
      message: '권한 없는 사용자의 문제 삭제 시도 차단',
    });
    return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
  }

  const { id } = await params;
  const challenge = await prisma.challenge.findFirst({
    where: { id, ctfId: ACTIVE_CTF_ID },
    select: { id: true, title: true, instanceSlug: true },
  });
  if (!challenge) return NextResponse.json({ error: '문제를 찾을 수 없습니다.' }, { status: 404 });

  const activeInstances = await prisma.challengeInstance.findMany({ where: { challengeId: id }, select: { token: true } });
  try {
    await Promise.all(activeInstances.map((instance) => destroyRemoteInstance(instance.token)));
    if (challenge.instanceSlug) await deleteRemoteDeployment(challenge.instanceSlug);
  } catch (error) {
    console.error('Failed to destroy challenge instances before deletion.', error);
    return NextResponse.json({ error: '실행 중인 VM을 종료하지 못해 문제를 삭제하지 않았습니다.' }, { status: 502 });
  }

  await prisma.$transaction([
    prisma.challengeInstance.deleteMany({ where: { challengeId: id } }),
    prisma.challenge.delete({ where: { id } }),
  ]);

  const actor = formatActor(admin);
  recordServerLog({
    level: 'WARN',
    source: 'ADMIN',
    action: 'ADMIN_CHALLENGE_DELETE',
    actor,
    actorId: admin.id,
    request,
    statusCode: 200,
    message: `관리자 문제 삭제: ${actor} → [${challenge.title}]`,
    params: {
      challengeId: challenge.id,
      title: challenge.title,
      instanceSlug: challenge.instanceSlug,
      terminatedVmCount: activeInstances.length,
    },
  });

  revalidatePath('/ctf');
  revalidatePath('/admin');
  return NextResponse.json({ challenges: await getAdminChallenges() });
}
