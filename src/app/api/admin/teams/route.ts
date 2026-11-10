import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdminUser } from '@/lib/admin-auth';
import { ACTIVE_CTF_ID } from '@/lib/categories';
import { refreshChallengeScores } from '@/lib/admin-users';
import { removeOwnerInstance } from '@/lib/owner-instance';
import { prisma } from '@/lib/prisma';

export async function DELETE(request: NextRequest) {
  if (!await getCurrentAdminUser()) return NextResponse.json({ error: '페이지를 찾을 수 없습니다.' }, { status: 404 });
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: '팀을 선택해 주세요.' }, { status: 400 });
  const team = await prisma.team.findFirst({
    where: { id, ctfId: ACTIVE_CTF_ID },
    select: { id: true, solves: { select: { challengeId: true } } },
  });
  if (!team) return NextResponse.json({ error: '페이지를 찾을 수 없습니다.' }, { status: 404 });
  await removeOwnerInstance(`team:${team.id}`);
  await prisma.team.delete({ where: { id: team.id } });
  await refreshChallengeScores(team.solves.map((solve) => solve.challengeId));
  return NextResponse.json({ ok: true });
}
