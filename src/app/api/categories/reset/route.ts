import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getCurrentAdminUser } from '@/lib/admin-auth';
import { formatActor, recordServerLog } from '@/lib/admin-logs';
import { ACTIVE_CTF_ID, getCategories } from '@/lib/categories';
import { defaultCategories } from '@/lib/platform-data';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  const admin = await getCurrentAdminUser();
  if (!admin) {
    return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
  }

  await prisma.$transaction([
    ...defaultCategories.map((category) => prisma.category.upsert({
      where: { id: category.id },
      create: {
        id: category.id,
        ctfId: ACTIVE_CTF_ID,
        name: category.name,
        slug: category.slug,
        shortName: category.shortName,
        description: category.description,
        accentColor: category.color,
        sortOrder: category.order,
        isVisible: category.visible,
      },
      update: {
        name: category.name,
        slug: category.slug,
        shortName: category.shortName,
        description: category.description,
        accentColor: category.color,
        sortOrder: category.order,
        isVisible: category.visible,
      },
    })),
    prisma.category.deleteMany({
      where: {
        ctfId: ACTIVE_CTF_ID,
        id: { notIn: defaultCategories.map((category) => category.id) },
        challenges: { none: {} },
      },
    }),
  ]);

  const actor = formatActor(admin);
  recordServerLog({
    level: 'WARN',
    source: 'ADMIN',
    action: 'ADMIN_CATEGORY_RESET',
    actor,
    actorId: admin.id,
    request,
    statusCode: 200,
    message: `관리자 카테고리 기본값 초기화: ${actor}`,
  });

  revalidatePath('/');
  revalidatePath('/ctf');
  return NextResponse.json({ categories: await getCategories({ fallback: false }) });
}
