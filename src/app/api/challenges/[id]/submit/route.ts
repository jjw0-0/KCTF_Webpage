import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { formatActor, recordServerLog } from '@/lib/admin-logs';
import { ACTIVE_CTF_ID } from '@/lib/categories';
import { getCtfAccess } from '@/lib/ctf-access';
import { calculateChallengePoints } from '@/lib/challenge-scoring';
import { matchesPlainFlag } from '@/lib/flags';
import { prisma } from '@/lib/prisma';
import { consumeRateLimit, rateLimitHeaders } from '@/lib/rate-limit';

const submissionSchema = z.object({ flag: z.string().trim().min(1).max(256) });
type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    recordServerLog({
      level: 'WARN',
      source: 'SUBMIT',
      action: 'FLAG_SUBMIT_UNAUTHORIZED',
      actor: 'anonymous',
      request,
      statusCode: 401,
      message: `비로그인 사용자의 플래그 제출 차단 (challengeId=${id})`,
      params: { challengeId: id },
    });
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, username: true, email: true, role: true, isActive: true },
  });
  if (!user?.isActive) {
    return NextResponse.json({ error: '활성 계정으로 로그인해 주세요.' }, { status: 401 });
  }

  const actor = formatActor(user);
  const access = await getCtfAccess(ACTIVE_CTF_ID);
  if (!access.open) {
    recordServerLog({
      level: 'WARN',
      source: 'SUBMIT',
      action: 'FLAG_SUBMIT_DENIED',
      actor,
      actorId: user.id,
      request,
      statusCode: 403,
      message: `대회 비활성 중 플래그 제출 차단: ${actor} (challengeId=${id})`,
      params: { challengeId: id, reason: access.reason },
    });
    return NextResponse.json({ error: access.reason }, { status: 403 });
  }

  const limit = consumeRateLimit(`submit:${session.user.id}`, 15, 60_000);
  if (!limit.allowed) {
    recordServerLog({
      level: 'WARN',
      source: 'SUBMIT',
      action: 'FLAG_SUBMIT_RATE_LIMIT',
      actor,
      actorId: user.id,
      request,
      statusCode: 429,
      message: `플래그 제출 속도 제한 초과 (Rate Limit): ${actor}`,
      params: { challengeId: id, resetAt: new Date(limit.resetAt).toISOString() },
    });
    return NextResponse.json(
      { error: '제출이 너무 빠릅니다. 잠시 후 다시 시도해 주세요.' },
      { status: 429, headers: rateLimitHeaders(limit) },
    );
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = submissionSchema.safeParse(rawBody);
  if (!parsed.success) {
    recordServerLog({
      level: 'WARN',
      source: 'SUBMIT',
      action: 'FLAG_SUBMIT_BAD_REQUEST',
      actor,
      actorId: user.id,
      request,
      statusCode: 400,
      message: `잘못된 플래그 제출 형식: ${actor} (challengeId=${id})`,
      params: { challengeId: id, reason: parsed.success ? 'invalid_flag' : parsed.error.issues[0]?.code },
    });
    return NextResponse.json({ error: '플래그를 확인해 주세요.' }, { status: 400 });
  }

  const challenge = await prisma.challenge.findFirst({
    where: { id, ctfId: ACTIVE_CTF_ID, isVisible: true },
    select: {
      id: true,
      title: true,
      points: true,
      scoringMode: true,
      minimumPoints: true,
      decaySolves: true,
      decrementPerSolve: true,
      flag: true,
      solveCount: true,
    },
  });
  if (!challenge) return NextResponse.json({ error: '문제를 찾을 수 없습니다.' }, { status: 404 });

  const submittedFlag = parsed.data.flag.trim();
  const correct = challenge.flag ? matchesPlainFlag(submittedFlag, challenge.flag) : false;
  if (!correct) {
    const sub = await prisma.submission.create({
      data: {
        challengeId: challenge.id,
        userId: session.user.id,
        flag: submittedFlag,
        isCorrect: false,
      },
    });
    recordServerLog({
      id: `sub-http-${sub.id}`,
      level: 'WARN',
      source: 'SUBMIT',
      action: 'FLAG_SUBMIT_WRONG',
      actor,
      actorId: user.id,
      request,
      statusCode: 200,
      message: `플래그 제출 (오답): ${actor} → [${challenge.title}]`,
      params: {
        submissionId: sub.id,
        challengeId: challenge.id,
        challengeTitle: challenge.title,
        isCorrect: false,
      },
    });
    return NextResponse.json({ correct: false }, { headers: rateLimitHeaders(limit) });
  }

  try {
    const result = await prisma.$transaction(async (transaction) => {
      const sub = await transaction.submission.create({
        data: {
          challengeId: challenge.id,
          userId: session.user.id,
          flag: submittedFlag,
          isCorrect: true,
        },
      });
      await transaction.solve.create({
        data: { challengeId: challenge.id, userId: session.user.id, points: challenge.points },
      });
      const updated = user.role === 'USER'
        ? await transaction.challenge.update({
            where: { id: challenge.id },
            data: { solveCount: { increment: 1 } },
            select: { points: true, scoringMode: true, minimumPoints: true, decaySolves: true, decrementPerSolve: true, solveCount: true },
          })
        : challenge;
      const points = calculateChallengePoints(updated, updated.solveCount);
      await transaction.solve.updateMany({ where: { challengeId: challenge.id }, data: { points } });
      return { subId: sub.id, points, solves: updated.solveCount };
    });

    recordServerLog({
      id: `sub-http-${result.subId}`,
      level: 'INFO',
      source: 'SUBMIT',
      action: 'FLAG_SUBMIT_CORRECT',
      actor,
      actorId: user.id,
      request,
      statusCode: 200,
      message: `플래그 제출 (정답 · Solve 달성): ${actor} → [${challenge.title}] (+${result.points}pts)`,
      params: {
        submissionId: result.subId,
        challengeId: challenge.id,
        challengeTitle: challenge.title,
        isCorrect: true,
        points: result.points,
        totalSolves: result.solves,
      },
    });

    return NextResponse.json(
      { correct: true, alreadySolved: false, points: result.points, solves: result.solves },
      { headers: rateLimitHeaders(limit) },
    );
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') {
      const currentPoints = calculateChallengePoints(challenge, challenge.solveCount);
      recordServerLog({
        level: 'INFO',
        source: 'SUBMIT',
        action: 'FLAG_SUBMIT_ALREADY_SOLVED',
        actor,
        actorId: user.id,
        request,
        statusCode: 200,
        message: `이미 해결한 문제 재제출: ${actor} → [${challenge.title}]`,
        params: {
          challengeId: challenge.id,
          challengeTitle: challenge.title,
          alreadySolved: true,
        },
      });
      return NextResponse.json(
        { correct: true, alreadySolved: true, solves: challenge.solveCount, points: currentPoints },
        { headers: rateLimitHeaders(limit) },
      );
    }
    throw error;
  }
}
