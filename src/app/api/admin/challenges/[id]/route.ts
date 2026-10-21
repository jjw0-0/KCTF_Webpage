import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { ACTIVE_CTF_ID } from '@/lib/categories';
import { challengeInputSchema } from '@/lib/challenge-input';
import { getAdminChallenges } from '@/lib/challenges';
import { digestFlag } from '@/lib/flags';
import { prisma } from '@/lib/prisma';

type RouteContext = { params: Promise<{ id: string }> };

async function requireAdmin() {
  const session = await auth();
  return session?.user?.role === 'ADMIN';
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
  }

  const { id } = await params;
  const [existing, parsed] = await Promise.all([
    prisma.challenge.findFirst({ where: { id, ctfId: ACTIVE_CTF_ID }, select: { id: true } }),
    request.json().catch(() => null).then((body) => challengeInputSchema.safeParse(body)),
  ]);
  if (!existing) return NextResponse.json({ error: '문제를 찾을 수 없습니다.' }, { status: 404 });
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? '입력값을 확인해 주세요.' }, { status: 400 });

  const category = await prisma.category.findFirst({
    where: { id: parsed.data.categoryId, ctfId: ACTIVE_CTF_ID },
    select: { id: true },
  });
  if (!category) return NextResponse.json({ error: '카테고리를 찾을 수 없습니다.' }, { status: 400 });

  const { flag, visible, instanceSlug, ...data } = parsed.data;
  try {
    await prisma.challenge.update({
      where: { id },
      data: {
        ...data,
        instanceSlug: instanceSlug || null,
        isVisible: visible,
        ...(flag ? { flagHash: digestFlag(flag) } : {}),
      },
    });
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') {
      return NextResponse.json({ error: '이미 사용 중인 VM slug입니다.' }, { status: 409 });
    }
    throw error;
  }

  revalidatePath('/ctf');
  revalidatePath('/admin');
  return NextResponse.json({ challenges: await getAdminChallenges() });
}
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
  }

  const { id } = await params;
  const challenge = await prisma.challenge.findFirst({
    where: { id, ctfId: ACTIVE_CTF_ID },
    select: { id: true, _count: { select: { solves: true } } },
  });
  if (!challenge) return NextResponse.json({ error: '문제를 찾을 수 없습니다.' }, { status: 404 });
  if (challenge._count.solves > 0) {
    return NextResponse.json({ error: '풀이 기록이 있는 문제는 삭제 대신 비공개로 전환해 주세요.' }, { status: 409 });
  }

  const activeInstances = await prisma.challengeInstance.count({ where: { challengeId: id } });
  if (activeInstances > 0) {
    return NextResponse.json({ error: '실행 중인 VM이 있는 문제는 삭제할 수 없습니다.' }, { status: 409 });
  }

  await prisma.challenge.delete({ where: { id } });
  revalidatePath('/ctf');
  revalidatePath('/admin');
  return NextResponse.json({ challenges: await getAdminChallenges() });
}
