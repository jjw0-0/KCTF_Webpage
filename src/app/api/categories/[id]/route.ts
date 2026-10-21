import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { ACTIVE_CTF_ID, getCategories } from '@/lib/categories';
import { prisma } from '@/lib/prisma';

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: RouteContext) {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
  }

  const { id } = await params;
  const category = await prisma.category.findFirst({
    where: { id, ctfId: ACTIVE_CTF_ID },
    select: { id: true, _count: { select: { challenges: true } } },
  });
  if (!category) return NextResponse.json({ error: '카테고리를 찾을 수 없습니다.' }, { status: 404 });
  if (category._count.challenges > 0) {
    return NextResponse.json({ error: '문제가 연결된 카테고리는 삭제할 수 없습니다.' }, { status: 409 });
  }

  await prisma.category.delete({ where: { id } });
  revalidatePath('/');
  revalidatePath('/ctf');
  return NextResponse.json({ categories: await getCategories({ fallback: false }) });
}

