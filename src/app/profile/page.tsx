import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import PageLayout from '@/components/PageLayout';
import { ACTIVE_CTF_ID } from '@/lib/categories';
import { getLeaderboard } from '@/lib/challenges';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) redirect('/login?callbackUrl=/profile');

  const [solves, challengeCount, leaderboard] = await Promise.all([
    prisma.solve.findMany({
      where: { userId: session.user.id, challenge: { ctfId: ACTIVE_CTF_ID } },
      include: { challenge: { include: { category: { select: { slug: true } } } } },
      orderBy: { solvedAt: 'desc' },
    }),
    prisma.challenge.count({ where: { ctfId: ACTIVE_CTF_ID, isVisible: true } }),
    getLeaderboard(),
  ]);
  const score = solves.reduce((total, solve) => total + solve.points, 0);
  const rank = leaderboard.find((entry) => entry.userId === session.user.id)?.rank;

  return (
    <PageLayout>
      <main className="profile-main">
        <section className="profile-card">
          <div className="profile-avatar">0x</div>
          <div>
            <p className="eyebrow">PLAYER PROFILE</p>
            <h1>{session.user.username}</h1>
            <p>{session.user.email}</p>
          </div>
          <Link href="/ctf" className="button button-primary">CONTINUE →</Link>
        </section>
        <section className="profile-grid">
          <article className="profile-stat"><span>RANK</span><strong>{rank ? `#${rank}` : '—'}</strong><small>LIVE</small></article>
          <article className="profile-stat"><span>SCORE</span><strong>{score}</strong><small>PTS</small></article>
          <article className="profile-stat"><span>SOLVED</span><strong>{solves.length}</strong><small>OF {challengeCount}</small></article>
          <article className="profile-stat"><span>STATUS</span><strong>ACTIVE</strong><small>{session.user.role}</small></article>
        </section>
        <section className="recent-solves">
          <div><p className="eyebrow">ACTIVITY / RECENT</p><h2>Solved challenges</h2></div>
          {solves.length ? solves.map((solve) => (
            <article key={solve.id}>
              <span className="status-dot" />
              <div><strong>{solve.challenge.title}</strong><small>{solve.challenge.category.slug.toUpperCase()}</small></div>
              <b>+{solve.points}</b>
              <time dateTime={solve.solvedAt.toISOString()}>{solve.solvedAt.toLocaleString('ko-KR')}</time>
            </article>
          )) : <p className="profile-empty">아직 해결한 문제가 없습니다.</p>}
        </section>
      </main>
    </PageLayout>
  );
}
