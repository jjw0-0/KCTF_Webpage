import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentAdminUser } from '@/lib/admin-auth';
import { refreshChallengeScores } from '@/lib/admin-users';
import { removeOwnerInstance } from '@/lib/owner-instance';
import { prisma } from '@/lib/prisma';

const roleSchema = z.object({ id: z.string().min(1), role: z.enum(['USER', 'ADMIN', 'GHOST']) });
const notFound = () => NextResponse.json({ error: '페이지를 찾을 수 없습니다.' }, { status: 404 });

export async function PATCH(request: NextRequest) {
  const admin = await getCurrentAdminUser();
  if (!admin) return notFound();
  const parsed = roleSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: '역할을 확인해 주세요.' }, { status: 400 });
  const user = await prisma.user.findUnique({ where: { id: parsed.data.id }, select: { id: true, solves: { select: { challengeId: true } } } });
  if (!user) return notFound();
  if (user.id === admin.id && parsed.data.role !== 'ADMIN') {
    return NextResponse.json({ error: '현재 로그인한 관리자 역할은 변경할 수 없습니다.' }, { status: 400 });
  }
  await prisma.user.update({ where: { id: user.id }, data: { role: parsed.data.role } });
  await refreshChallengeScores(user.solves.map((solve) => solve.challengeId));
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const admin = await getCurrentAdminUser();
  if (!admin) return notFound();
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: '사용자를 선택해 주세요.' }, { status: 400 });
  if (id === admin.id) return NextResponse.json({ error: '현재 로그인한 계정은 삭제할 수 없습니다.' }, { status: 400 });
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true, solves: { select: { challengeId: true } } } });
  if (!user) return notFound();
  await removeOwnerInstance(`user:${user.id}`);
  await prisma.user.delete({ where: { id: user.id } });
  await refreshChallengeScores(user.solves.map((solve) => solve.challengeId));
  return NextResponse.json({ ok: true });
}
