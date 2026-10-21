import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { ACTIVE_CTF_ID } from '@/lib/categories';
import { digestFlag, matchesFlag } from '@/lib/flags';
import { prisma } from '@/lib/prisma';
import { consumeRateLimit, rateLimitHeaders } from '@/lib/rate-limit';

const submissionSchema = z.object({ flag: z.string().trim().min(1).max(256) });
type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const limit = consumeRateLimit(`submit:${session.user.id}`, 15, 60_000);
  if (!limit.allowed) {
    return NextResponse.json({ error: '제출이 너무 빠릅니다. 잠시 후 다시 시도해 주세요.' }, { status: 429, headers: rateLimitHeaders(limit) });
  }

  const parsed = submissionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: '플래그를 확인해 주세요.' }, { status: 400 });

  const { id } = await params;
  const challenge = await prisma.challenge.findFirst({
    where: { id, ctfId: ACTIVE_CTF_ID, isVisible: true },
    select: { id: true, points: true, flagHash: true, solveCount: true },
  });
  if (!challenge) return NextResponse.json({ error: '문제를 찾을 수 없습니다.' }, { status: 404 });

  const correct = matchesFlag(parsed.data.flag, challenge.flagHash);
  if (!correct) {
    await prisma.submission.create({
      data: {
        challengeId: challenge.id,
        userId: session.user.id,
        flagDigest: digestFlag(parsed.data.flag),
        isCorrect: false,
      },
    });
    return NextResponse.json({ correct: false }, { headers: rateLimitHeaders(limit) });
  }

  try {
    await prisma.$transaction([
      prisma.submission.create({
        data: {
          challengeId: challenge.id,
          userId: session.user.id,
          flagDigest: digestFlag(parsed.data.flag),
          isCorrect: true,
        },
      }),
      prisma.solve.create({
        data: { challengeId: challenge.id, userId: session.user.id, points: challenge.points },
      }),
      prisma.challenge.update({
        where: { id: challenge.id },
        data: { solveCount: { increment: 1 } },
      }),
    ]);
    return NextResponse.json({ correct: true, alreadySolved: false, solves: challenge.solveCount + 1 }, { headers: rateLimitHeaders(limit) });
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') {
      return NextResponse.json({ correct: true, alreadySolved: true, solves: challenge.solveCount }, { headers: rateLimitHeaders(limit) });
    }
    throw error;
  }
}
