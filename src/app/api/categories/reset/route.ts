import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { ACTIVE_CTF_ID, getCategories } from '@/lib/categories';
import { defaultCategories } from '@/lib/platform-data';
import { prisma } from '@/lib/prisma';

export async function POST() {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') {
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

  revalidatePath('/');
  revalidatePath('/ctf');
  return NextResponse.json({ categories: await getCategories({ fallback: false }) });
}

