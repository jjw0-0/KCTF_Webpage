import { ACTIVE_CTF_ID } from '@/lib/categories';
import { calculateChallengePoints } from '@/lib/challenge-scoring';
import { prisma } from '@/lib/prisma';

export async function getAdminUsers() {
  const [users, teams] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        teamMemberships: {
          where: { team: { ctfId: ACTIVE_CTF_ID } },
          select: { team: { select: { name: true } } },
        },
      },
    }),
    prisma.team.findMany({
      where: { ctfId: ACTIVE_CTF_ID },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        members: { select: { user: { select: { id: true, username: true } } } },
      },
    }),
  ]);
  return { users, teams };
}

export async function refreshChallengeScores(challengeIds: string[]) {
  const ids = [...new Set(challengeIds)];
  if (!ids.length) return;
  const challenges = await prisma.challenge.findMany({
    where: { id: { in: ids } },
    select: { id: true, points: true, scoringMode: true, minimumPoints: true, decaySolves: true, decrementPerSolve: true },
  });
  for (const challenge of challenges) {
    const solveCount = await prisma.solve.count({ where: { challengeId: challenge.id, user: { role: 'USER' } } });
    const points = calculateChallengePoints(challenge, solveCount);
    await prisma.$transaction([
      prisma.challenge.update({ where: { id: challenge.id }, data: { solveCount } }),
      prisma.solve.updateMany({ where: { challengeId: challenge.id }, data: { points } }),
    ]);
  }
}
