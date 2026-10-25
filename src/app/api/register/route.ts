import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { formatActor, recordServerLog } from '@/lib/admin-logs';
import { prisma } from '@/lib/prisma';
import { consumeRateLimit, getClientAddress, rateLimitHeaders } from '@/lib/rate-limit';

const registerSchema = z.object({
  username: z.string().trim().min(2).max(24).regex(/^[a-zA-Z0-9_-]+$/),
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(8).max(128),
});

export async function POST(request: NextRequest) {
  const clientAddress = getClientAddress(request.headers);
  const limit = consumeRateLimit(`register:${clientAddress}`, 5, 10 * 60_000);
  if (!limit.allowed) {
    recordServerLog({
      level: 'WARN',
      source: 'AUTH',
      action: 'USER_REGISTER_RATE_LIMIT',
      actor: 'anonymous',
      request,
      statusCode: 429,
      message: '회원가입 요청 속도 제한 초과 (Rate Limit)',
      params: { resetAt: new Date(limit.resetAt).toISOString() },
    });
    return NextResponse.json(
      { error: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 429, headers: rateLimitHeaders(limit) },
    );
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(rawBody);
  if (!parsed.success) {
    const safeParams = rawBody && typeof rawBody === 'object'
      ? {
          username: (rawBody as Record<string, unknown>).username,
          email: (rawBody as Record<string, unknown>).email,
        }
      : { rawBody };
    recordServerLog({
      level: 'WARN',
      source: 'AUTH',
      action: 'USER_REGISTER_BAD_REQUEST',
      actor: String(safeParams.username || safeParams.email || 'anonymous'),
      request,
      statusCode: 400,
      message: '회원가입 입력값 검증 실패',
      params: safeParams,
    });
    return NextResponse.json(
      { error: '닉네임(영문/숫자/_/- 2~24자), 이메일, 비밀번호(8자 이상)를 확인해 주세요.' },
      { status: 400, headers: rateLimitHeaders(limit) },
    );
  }

  const { username, email, password } = parsed.data;
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] },
    select: { email: true, username: true },
  });

  if (existing) {
    const conflictField = existing.email === email ? 'email' : 'username';
    recordServerLog({
      level: 'WARN',
      source: 'AUTH',
      action: 'USER_REGISTER_CONFLICT',
      actor: `${username} (${email})`,
      request,
      statusCode: 409,
      message: `회원가입 중복 차단 (${conflictField}): ${username} (${email})`,
      params: { username, email, conflictField },
    });
    return NextResponse.json(
      { error: existing.email === email ? '이미 등록된 이메일입니다.' : '이미 사용 중인 닉네임입니다.' },
      { status: 409, headers: rateLimitHeaders(limit) },
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { username, email, passwordHash },
    select: { id: true, instancerId: true, username: true, email: true, role: true },
  });

  const actor = formatActor(user);
  recordServerLog({
    id: `user-reg-${user.id}`,
    level: 'INFO',
    source: 'AUTH',
    action: 'USER_REGISTER',
    actor,
    actorId: user.id,
    request,
    statusCode: 201,
    message: `신규 계정 회원가입 완료: ${actor}`,
    params: {
      userId: user.id,
      instancerId: user.instancerId,
      username: user.username,
      email: user.email,
      role: user.role,
    },
  });

  return NextResponse.json({ user }, { status: 201, headers: rateLimitHeaders(limit) });
}
