import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import PageLayout from '@/components/PageLayout';
import ProfileAvatar from '@/components/ProfileAvatar';
import { ACTIVE_CTF_ID } from '@/lib/categories';
import { getLeaderboard } from '@/lib/challenges';
import { prisma } from '@/lib/prisma';
import { resolveOwner } from '@/lib/ownership';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) redirect('/login?callbackUrl=/profile');
  const owner = await resolveOwner(session.user.id);

  const [solves, challengeCount, leaderboard, user] = await Promise.all([
    prisma.solve.findMany({
      where: { ownerKey: owner.key, challenge: { ctfId: ACTIVE_CTF_ID } },
      include: { challenge: { include: { category: { select: { slug: true } } } } },
      orderBy: { solvedAt: 'desc' },
    }),
    prisma.challenge.count({ where: { ctfId: ACTIVE_CTF_ID, isVisible: true } }),
    getLeaderboard(),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { avatarData: true } }),
  ]);
  const score = solves.reduce((total, solve) => total + solve.points, 0);
  const leaderboardId = owner.teamId ? owner.key : session.user.id;
  const rank = leaderboard.find((entry) => entry.userId === leaderboardId)?.rank;
  const initials = session.user.username.slice(0, 2).toUpperCase();
  const dateFormatter = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <PageLayout>
      <main className="profile-main">
        <section className="profile-card" aria-labelledby="profile-title">
          <ProfileAvatar avatarData={user?.avatarData ?? undefined} initials={initials} />
          <div className="profile-identity">
            <h1 id="profile-title">{session.user.username}</h1>
            <p>{session.user.email}</p>
            {owner.teamId && <p><Link href={`/teams/${owner.teamId}`}>{owner.label}</Link></p>}
          </div>
          <dl className="profile-record" aria-label="참가 기록">
            <div><dt>순위</dt><dd>{rank ? `#${rank}` : '—'}</dd></div>
            <div><dt>점수</dt><dd>{score}<span> PTS</span></dd></div>
            <div><dt>해결</dt><dd>{solves.length}<span> / {challengeCount}</span></dd></div>
          </dl>
        </section>
        <section className="recent-solves">
          <div><h2>해결한 문제</h2></div>
          {solves.length ? solves.map((solve) => (
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
