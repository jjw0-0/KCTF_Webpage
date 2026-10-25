import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getCurrentAdminUser } from '@/lib/admin-auth';
import { formatActor, recordServerLog } from '@/lib/admin-logs';
import { ACTIVE_CTF_ID, getCategories } from '@/lib/categories';
import { prisma } from '@/lib/prisma';

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, { params }: RouteContext) {
  const admin = await getCurrentAdminUser();
  if (!admin) {
    return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
  }

  const { id } = await params;
  const category = await prisma.category.findFirst({
    where: { id, ctfId: ACTIVE_CTF_ID },
    select: { id: true, name: true, _count: { select: { challenges: true } } },
  });
  if (!category) return NextResponse.json({ error: '카테고리를 찾을 수 없습니다.' }, { status: 404 });
  if (category._count.challenges > 0) {
    return NextResponse.json({ error: '문제가 연결된 카테고리는 삭제할 수 없습니다.' }, { status: 409 });
  }

  await prisma.category.delete({ where: { id } });

  const actor = formatActor(admin);
  recordServerLog({
    level: 'WARN',
    source: 'ADMIN',
    action: 'ADMIN_CATEGORY_DELETE',
    actor,
    actorId: admin.id,
    request,
    statusCode: 200,
    message: `관리자 카테고리 삭제: ${actor} → [${category.name}]`,
    params: { categoryId: category.id, name: category.name },
  });

  revalidatePath('/');
  revalidatePath('/ctf');
  return NextResponse.json({ categories: await getCategories({ fallback: false }) });
}
