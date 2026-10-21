import { ACTIVE_CTF_ID } from '@/lib/categories';
import { prisma } from '@/lib/prisma';
import { Challenge, challenges as fallbackChallenges } from '@/lib/platform-data';

export type AdminChallenge = {
  id: string;
  title: string;
  summary: string;
  description: string;
  categoryId: string;
  category: string;
  points: number;
  difficulty: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  tags: string[];
  instanceSlug: string;
  visible: boolean;
  solves: number;
};

export async function getChallenges(userId?: string): Promise<Challenge[]> {
  try {
    const rows = await prisma.challenge.findMany({
      where: { ctfId: ACTIVE_CTF_ID, isVisible: true, category: { isVisible: true } },
      include: {
        category: { select: { slug: true } },
        solves: { where: { userId: userId ?? '' }, select: { id: true } },
        _count: { select: { solves: true } },
      },
      orderBy: [{ category: { sortOrder: 'asc' } }, { points: 'asc' }, { title: 'asc' }],
    });

    if (!rows.length) return fallbackChallenges.map((challenge) => ({ ...challenge, solved: false, solves: 0 }));
    return rows.map((challenge) => ({
      id: challenge.id,
      title: challenge.title,
      summary: challenge.summary,
      category: challenge.category.slug,
      points: challenge.points,
      solves: challenge._count.solves,
      difficulty: challenge.difficulty,
      solved: challenge.solves.length > 0,
      tags: challenge.tags,
      instanceSlug: challenge.instanceSlug ?? undefined,
    }));
  } catch (error) {
    console.error('Unable to load challenges from PostgreSQL; using defaults.', error);
    return fallbackChallenges.map((challenge) => ({ ...challenge, solved: false, solves: 0 }));
  }
}

export async function getAdminChallenges(): Promise<AdminChallenge[]> {
  const rows = await prisma.challenge.findMany({
    where: { ctfId: ACTIVE_CTF_ID },
    include: {
      category: { select: { name: true } },
      _count: { select: { solves: true } },
    },
    orderBy: [{ category: { sortOrder: 'asc' } }, { points: 'asc' }, { title: 'asc' }],
  });

  return rows.map((challenge) => ({
    id: challenge.id,
    title: challenge.title,
    summary: challenge.summary,
    description: challenge.description,
    categoryId: challenge.categoryId,
    category: challenge.category.name,
    points: challenge.points,
    difficulty: challenge.difficulty,
    tags: challenge.tags,
    instanceSlug: challenge.instanceSlug ?? '',
    visible: challenge.isVisible,
    solves: challenge._count.solves,
  }));
}

export type LeaderboardEntry = {
  rank: number;
  userId: string;
  name: string;
  score: number;
  solved: number;
};

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  const scores = await prisma.solve.groupBy({
    by: ['userId'],
    _sum: { points: true },
    _count: { id: true },
    _max: { solvedAt: true },
    orderBy: [{ _sum: { points: 'desc' } }, { _max: { solvedAt: 'asc' } }],
    take: 100,
  });
  const users = await prisma.user.findMany({
    where: { id: { in: scores.map((score) => score.userId) } },
    select: { id: true, username: true },
  });
  const names = new Map(users.map((user) => [user.id, user.username]));

  return scores.map((score, index) => ({
    rank: index + 1,
    userId: score.userId,
    name: names.get(score.userId) ?? 'unknown',
    score: score._sum.points ?? 0,
    solved: score._count.id,
  }));
}
