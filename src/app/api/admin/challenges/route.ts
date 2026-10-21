import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { ACTIVE_CTF_ID } from '@/lib/categories';
import { challengeInputSchema } from '@/lib/challenge-input';
import { getAdminChallenges } from '@/lib/challenges';
import { digestFlag } from '@/lib/flags';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
  }

  const parsed = challengeInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !parsed.data.flag) {
    return NextResponse.json({ error: parsed.success ? '새 문제의 플래그를 입력해 주세요.' : parsed.error.issues[0]?.message }, { status: 400 });
  }

  const category = await prisma.category.findFirst({
    where: { id: parsed.data.categoryId, ctfId: ACTIVE_CTF_ID },
    select: { id: true },
  });
  if (!category) return NextResponse.json({ error: '카테고리를 찾을 수 없습니다.' }, { status: 400 });

  const { flag, visible, instanceSlug, ...data } = parsed.data;
  try {
    await prisma.challenge.create({
      data: {
        ...data,
        ctfId: ACTIVE_CTF_ID,
        flagHash: digestFlag(flag),
        instanceSlug: instanceSlug || null,
        isVisible: visible,
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
  return NextResponse.json({ challenges: await getAdminChallenges() }, { status: 201 });
}
