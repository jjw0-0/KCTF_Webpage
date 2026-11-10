import Link from 'next/link';
import { notFound } from 'next/navigation';
import PageLayout from '@/components/PageLayout';
import ProfileImage from '@/components/ProfileImage';
import { ACTIVE_CTF_ID } from '@/lib/categories';
import { getLeaderboard } from '@/lib/challenges';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function UserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, leaderboard, challengeCount] = await Promise.all([
    prisma.user.findFirst({
      where: { id, role: 'USER' },
      select: {
        id: true,
        username: true,
        avatarData: true,
        updatedAt: true,
        teamMemberships: {
          where: { team: { ctfId: ACTIVE_CTF_ID } },
          take: 1,
          select: { team: { select: { id: true, name: true } } },
        },
        solves: {
          where: { challenge: { ctfId: ACTIVE_CTF_ID } },
          orderBy: { solvedAt: 'desc' },
          select: {
            id: true,
            points: true,
            solvedAt: true,
            challenge: { select: { title: true, category: { select: { slug: true } } } },
          },
        },
      },
    }),
    getLeaderboard(),
    prisma.challenge.count({ where: { ctfId: ACTIVE_CTF_ID, isVisible: true } }),
  ]);
  if (!user) notFound();

  const team = user.teamMemberships[0]?.team;
  const entry = leaderboard.find((item) => item.userId === (team ? `team:${team.id}` : user.id));
  const avatarUrl = user.avatarData ? `/api/users/${user.id}/avatar?v=${user.updatedAt.getTime()}` : undefined;
  const dateFormatter = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <PageLayout>
      <main className="profile-main">
        <section className="profile-card" aria-labelledby="profile-title">
          <ProfileImage src={avatarUrl} name={user.username} />
          <div className="profile-identity">
            <h1 id="profile-title">{user.username}</h1>
            {team ? <p><Link href={`/teams/${team.id}`}>{team.name}</Link></p> : <p>Individual participant</p>}
          </div>
          <dl className="profile-record" aria-label="참가 기록">
            <div><dt>순위</dt><dd>{entry ? `#${entry.rank}` : '—'}</dd></div>
            <div><dt>점수</dt><dd>{entry?.score ?? 0}<span> PTS</span></dd></div>
            <div><dt>기여 해결</dt><dd>{user.solves.length}<span> / {challengeCount}</span></dd></div>
          </dl>
        </section>
        <section className="recent-solves">
          <div><h2>해결한 문제</h2></div>
          {user.solves.length ? user.solves.map((solve) => (
            <article key={solve.id}>
              <div><strong>{solve.challenge.title}</strong><small>{solve.challenge.category.slug.toUpperCase()}</small></div>
              <b>+{solve.points}</b>
              <time dateTime={solve.solvedAt.toISOString()}>{dateFormatter.format(solve.solvedAt)}</time>
            </article>
          )) : <div className="profile-empty"><p>아직 해결한 문제가 없습니다.</p></div>}
        </section>
      </main>
    </PageLayout>
  );
}
