import { ACTIVE_CTF_ID } from '@/lib/categories';
import { calculateChallengePoints } from '@/lib/challenge-scoring';
import { prisma } from '@/lib/prisma';
import { Challenge } from '@/lib/platform-data';

export type AdminChallenge = {
  id: string;
  title: string;
  summary: string;
  description: string;
  author: string;
  fileUrl: string;
  attachmentName: string;
  attachmentSize: number;
  deploymentName: string;
  deploymentSize: number;
  deploymentStatus: 'NONE' | 'QUEUED' | 'BUILDING' | 'READY' | 'FAILED';
  deploymentError: string;
  deploymentUpdatedAt?: string;
  categoryId: string;
  category: string;
  points: number;
  currentPoints: number;
  scoringMode: 'STATIC' | 'DYNAMIC' | 'LINEAR';
  minimumPoints: number;
  decaySolves: number;
  decrementPerSolve: number;
  flag: string;
  difficulty: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  tags: string[];
  instanceSlug: string;
  usesVm: boolean;
  usesCompose: boolean;
  instancePort?: number;
  connectionUrl: string;
  visible: boolean;
  solves: number;
};

export async function getChallenges(userId?: string): Promise<Challenge[]> {
  try {
    const rows = await prisma.challenge.findMany({
      where: { ctfId: ACTIVE_CTF_ID, isVisible: true, category: { isVisible: true } },
      select: {
        id: true,
        title: true,
        summary: true,
        description: true,
        author: true,
        fileUrl: true,
        points: true,
        scoringMode: true,
        minimumPoints: true,
        decaySolves: true,
        decrementPerSolve: true,
        difficulty: true,
        tags: true,
        instanceSlug: true,
        usesVm: true,
        deploymentStatus: true,
        connectionUrl: true,
        category: { select: { slug: true } },
        solves: { where: { userId: userId ?? '' }, select: { id: true } },
        _count: { select: { solves: true } },
      },
      orderBy: [{ category: { sortOrder: 'asc' } }, { points: 'asc' }, { title: 'asc' }],
    });

    return rows.map((challenge) => ({
      id: challenge.id,
      title: challenge.title,
      summary: challenge.summary,
      description: challenge.description,
      author: challenge.author ?? undefined,
      fileUrl: challenge.fileUrl ?? undefined,
      category: challenge.category.slug,
      points: calculateChallengePoints(challenge, challenge._count.solves),
      solves: challenge._count.solves,
      difficulty: challenge.difficulty,
      solved: challenge.solves.length > 0,
      tags: challenge.tags,
      instanceSlug: challenge.instanceSlug ?? undefined,
      usesVm: challenge.usesVm && challenge.deploymentStatus === 'READY',
      connectionUrl: challenge.connectionUrl ?? undefined,
    }));
  } catch (error) {
    console.error('Unable to load challenges from PostgreSQL.', error);
    return [];
  }
}

export async function getAdminChallenges(): Promise<AdminChallenge[]> {
  const rows = await prisma.challenge.findMany({
    where: { ctfId: ACTIVE_CTF_ID },
    select: {
      id: true,
      title: true,
      summary: true,
      description: true,
      author: true,
      fileUrl: true,
      attachmentName: true,
      attachmentSize: true,
      deploymentName: true,
      deploymentSize: true,
      deploymentStatus: true,
      deploymentError: true,
      deploymentUpdatedAt: true,
      categoryId: true,
      points: true,
      scoringMode: true,
      minimumPoints: true,
      decaySolves: true,
      decrementPerSolve: true,
      flag: true,
      difficulty: true,
      tags: true,
      instanceSlug: true,
      usesVm: true,
      usesCompose: true,
      instancePort: true,
      connectionUrl: true,
      isVisible: true,
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
    author: challenge.author ?? '',
    fileUrl: challenge.fileUrl ?? '',
    attachmentName: challenge.attachmentName ?? '',
    attachmentSize: challenge.attachmentSize ?? 0,
    deploymentName: challenge.deploymentName ?? '',
    deploymentSize: challenge.deploymentSize ?? 0,
    deploymentStatus: challenge.deploymentStatus,
    deploymentError: challenge.deploymentError ?? '',
    deploymentUpdatedAt: challenge.deploymentUpdatedAt?.toISOString(),
    categoryId: challenge.categoryId,
    category: challenge.category.name,
    points: challenge.points,
    currentPoints: calculateChallengePoints(challenge, challenge._count.solves),
    scoringMode: challenge.scoringMode,
    minimumPoints: challenge.minimumPoints,
    decaySolves: challenge.decaySolves,
    decrementPerSolve: challenge.decrementPerSolve,
    flag: challenge.flag ?? '',
    difficulty: challenge.difficulty,
    tags: challenge.tags,
    instanceSlug: challenge.instanceSlug ?? '',
    usesVm: challenge.usesVm,
    usesCompose: challenge.usesCompose,
    instancePort: challenge.instancePort ?? undefined,
    connectionUrl: challenge.connectionUrl ?? '',
    visible: challenge.isVisible,
    solves: challenge._count.solves,
  }));
}

export type LeaderboardEntry = {
  rank: number;
  userId: string;
  name: string;
  avatarUrl?: string;
  score: number;
  solved: number;
};

export type ScoreHistoryEvent = {
  userId: string;
  name: string;
  points: number;
  solvedAt: Date;
};

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  const scores = await prisma.solve.groupBy({
    by: ['userId'],
    where: {
      challenge: { ctfId: ACTIVE_CTF_ID },
      user: { role: 'USER', isActive: true },
    },
    _sum: { points: true },
    _count: { id: true },
    _max: { solvedAt: true },
    orderBy: [{ _sum: { points: 'desc' } }, { _max: { solvedAt: 'asc' } }],
    take: 100,
  });
  const userIds = scores.map((score) => score.userId);
  const [users, avatarUsers] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, username: true },
    }),
    prisma.user.findMany({
      where: { id: { in: userIds }, avatarData: { not: null } },
      select: { id: true, updatedAt: true },
    }),
  ]);
  const userMap = new Map(users.map((user) => [user.id, user]));
  const avatarMap = new Map(avatarUsers.map((user) => [user.id, user.updatedAt.getTime()]));

  return scores.map((score, index) => {
    const user = userMap.get(score.userId);
    return {
      rank: index + 1,
      userId: score.userId,
      name: user?.username ?? 'unknown',
      avatarUrl: avatarMap.has(score.userId)
        ? `/api/users/${score.userId}/avatar?v=${avatarMap.get(score.userId)}`
        : undefined,
      score: score._sum.points ?? 0,
      solved: score._count.id,
    };
  });
}

export async function getScoreHistory(userIds: string[]): Promise<ScoreHistoryEvent[]> {
  if (!userIds.length) return [];
  const solves = await prisma.solve.findMany({
    where: { userId: { in: userIds }, challenge: { ctfId: ACTIVE_CTF_ID } },
    select: { userId: true, points: true, solvedAt: true, user: { select: { username: true } } },
    orderBy: { solvedAt: 'asc' },
  });
  return solves.map((solve) => ({
    userId: solve.userId,
    name: solve.user.username,
    points: solve.points,
    solvedAt: solve.solvedAt,
  }));
}
