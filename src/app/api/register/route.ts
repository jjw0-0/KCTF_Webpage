import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { consumeRateLimit, getClientAddress, rateLimitHeaders } from '@/lib/rate-limit';

const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  username: z.string().trim().min(2).max(24)
    .regex(/^[a-zA-Z0-9_가-힣-]+$/, '닉네임에는 문자, 숫자, 밑줄, 하이픈만 사용할 수 있습니다.'),
  password: z.string().min(10).max(128),
});

export async function POST(request: NextRequest) {
  const limit = consumeRateLimit(`register:${getClientAddress(request.headers)}`, 5, 60 * 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: '가입 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 429, headers: rateLimitHeaders(limit) },
    );
  }

  const parsed = registerSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? '입력값을 확인해 주세요.' },
      { status: 400, headers: rateLimitHeaders(limit) },
    );
  }

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: parsed.data.email }, { username: parsed.data.username }] },
    select: { email: true, username: true },
  });
  if (existing) {
    const error = existing.email === parsed.data.email
      ? '이미 가입된 이메일입니다.'
      : '이미 사용 중인 닉네임입니다.';
    return NextResponse.json({ error }, { status: 409, headers: rateLimitHeaders(limit) });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  try {
    await prisma.user.create({
      data: {
        email: parsed.data.email,
        username: parsed.data.username,
        passwordHash,
      },
    });
  } catch {
    return NextResponse.json(
      { error: '이미 사용 중인 이메일 또는 닉네임입니다.' },
      { status: 409, headers: rateLimitHeaders(limit) },
    );
  }

  return NextResponse.json({ ok: true }, { status: 201, headers: rateLimitHeaders(limit) });
}

