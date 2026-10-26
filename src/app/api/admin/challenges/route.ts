import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdminUser } from '@/lib/admin-auth';
import { formatActor, recordServerLog } from '@/lib/admin-logs';
import { ACTIVE_CTF_ID } from '@/lib/categories';
import { challengeInputSchema, deriveChallengeSummary } from '@/lib/challenge-input';
import { getAdminChallenges } from '@/lib/challenges';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  const admin = await getCurrentAdminUser();
  if (!admin) {
    recordServerLog({
      level: 'WARN',
      source: 'ADMIN',
      action: 'ADMIN_CHALLENGE_CREATE_DENIED',
      actor: 'unauthorized',
      request,
      statusCode: 403,
      message: '권한 없는 사용자의 문제 생성 시도 차단',
    });
    return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
  }

  const parsed = challengeInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || (!parsed.data.flag && (!parsed.data.usesVm || !parsed.data.dynamicFlag))) {
    return NextResponse.json({ error: parsed.success ? '고정 플래그 문제의 플래그를 입력해 주세요.' : parsed.error.issues[0]?.message }, { status: 400 });
  }

  const category = await prisma.category.findFirst({
    where: { id: parsed.data.categoryId, ctfId: ACTIVE_CTF_ID },
    select: { id: true, name: true },
  });
  if (!category) return NextResponse.json({ error: '카테고리를 찾을 수 없습니다.' }, { status: 400 });

  const { flag, visible, instanceSlug, usesVm, dynamicFlag, usesCompose, instancePort, connectionUrl, ...data } = parsed.data;
  try {
    let challenge = await prisma.challenge.create({
      data: {
        ...data,
        summary: data.summary || deriveChallengeSummary(data.description),
        ctfId: ACTIVE_CTF_ID,
        flag: flag || null,
        usesVm,
        dynamicFlag: usesVm && dynamicFlag,
        usesCompose: usesVm && usesCompose,
        instancePort: usesVm ? instancePort : null,
        connectionUrl: usesVm || !connectionUrl ? null : connectionUrl,
        instanceSlug: usesVm && instanceSlug ? instanceSlug : null,
        isVisible: visible,
      },
    });
    if (usesVm && !challenge.instanceSlug) {
      challenge = await prisma.challenge.update({
        where: { id: challenge.id },
        data: { instanceSlug: challenge.id },
      });
    }

    const actor = formatActor(admin);
    recordServerLog({
      level: 'INFO',
      source: 'ADMIN',
      action: 'ADMIN_CHALLENGE_CREATE',
      actor,
      actorId: admin.id,
      request,
      statusCode: 201,
      message: `관리자 신규 문제 생성: ${actor} → [${challenge.title}] (${challenge.points}pts)`,
      params: {
        challengeId: challenge.id,
        title: challenge.title,
        categoryId: challenge.categoryId,
        categoryName: category.name,
        points: challenge.points,
        scoringMode: challenge.scoringMode,
        usesVm: challenge.usesVm,
        dynamicFlag: challenge.dynamicFlag,
        usesCompose: challenge.usesCompose,
        instancePort: challenge.instancePort,
        instanceSlug: challenge.instanceSlug,
        connectionUrl: challenge.connectionUrl,
        visible: challenge.isVisible,
      },
    });

    revalidatePath('/ctf');
    revalidatePath('/admin');
    return NextResponse.json({ challengeId: challenge.id, challenges: await getAdminChallenges() }, { status: 201 });
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') {
      return NextResponse.json({ error: '이미 사용 중인 VM slug입니다.' }, { status: 409 });
    }
    throw error;
  }
}
