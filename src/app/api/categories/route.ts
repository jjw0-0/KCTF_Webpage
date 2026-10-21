import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { auth } from '@/auth';
import { ACTIVE_CTF_ID, getCategories } from '@/lib/categories';
import { prisma } from '@/lib/prisma';

const categoryPatchSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().trim().min(1).max(40),
  shortName: z.string().trim().min(1).max(10),
  description: z.string().trim().max(240),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  order: z.number().int().min(1).max(100),
  visible: z.boolean(),
});

const categoriesSchema = z.object({
  categories: z.array(categoryPatchSchema).min(1).max(30),
});

const createSchema = z.object({
  name: z.string().trim().min(1).max(40),
});

async function isAdmin() {
  const session = await auth();
  return session?.user?.role === 'ADMIN';
}

function slugify(value: string) {
  return value.toLowerCase().trim()
    .replace(/[^a-z0-9가-힣]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'category';
}

export async function GET() {
  const categories = await getCategories();
  return NextResponse.json({ categories }, {
    headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120' },
  });
}

export async function POST(request: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: '카테고리 이름을 확인해 주세요.' }, { status: 400 });

  const baseSlug = slugify(parsed.data.name);
  const existing = await prisma.category.findMany({
    where: { ctfId: ACTIVE_CTF_ID, slug: { startsWith: baseSlug } },
    select: { slug: true },
  });
  const used = new Set(existing.map((item) => item.slug));
  let slug = baseSlug;
  let suffix = 2;
  while (used.has(slug)) slug = `${baseSlug}-${suffix++}`;

  const aggregate = await prisma.category.aggregate({
    where: { ctfId: ACTIVE_CTF_ID },
    _max: { sortOrder: true },
  });
  await prisma.category.create({
    data: {
      ctfId: ACTIVE_CTF_ID,
      name: parsed.data.name,
      slug,
      shortName: parsed.data.name.slice(0, 10).toUpperCase(),
      description: '새로운 공격 표면을 위한 카테고리입니다.',
      accentColor: '#4de0a7',
      sortOrder: (aggregate._max.sortOrder ?? 0) + 1,
    },
  });

  revalidatePath('/');
  revalidatePath('/ctf');
  return NextResponse.json({ categories: await getCategories({ fallback: false }) }, { status: 201 });
}

export async function PUT(request: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });

  const parsed = categoriesSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: '카테고리 데이터 형식이 올바르지 않습니다.' }, { status: 400 });

  const ids = new Set(parsed.data.categories.map((category) => category.id));
  if (ids.size !== parsed.data.categories.length) {
    return NextResponse.json({ error: '중복된 카테고리 ID가 있습니다.' }, { status: 400 });
  }

  await prisma.$transaction(parsed.data.categories.map((category, index) => prisma.category.update({
    where: { id: category.id, ctfId: ACTIVE_CTF_ID },
    data: {
      name: category.name,
      shortName: category.shortName,
      description: category.description,
      accentColor: category.color,
      sortOrder: index + 1,
      isVisible: category.visible,
    },
  })));

  revalidatePath('/');
  revalidatePath('/ctf');
  return NextResponse.json({ categories: await getCategories({ fallback: false }) });
}

