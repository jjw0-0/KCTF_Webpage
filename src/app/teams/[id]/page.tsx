import Link from 'next/link';
import { notFound } from 'next/navigation';
import PageLayout from '@/components/PageLayout';
import ProfileImage from '@/components/ProfileImage';
import ScoreHistoryChart from '@/components/ScoreHistoryChart';
import { ACTIVE_CTF_ID } from '@/lib/categories';
import { getLeaderboard, getScoreHistory } from '@/lib/challenges';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ownerKey = `team:${id}`;
  const [team, leaderboard] = await Promise.all([
    prisma.team.findFirst({
      where: { id, ctfId: ACTIVE_CTF_ID },
      select: {
        id: true,
        name: true,
        members: {
          orderBy: [{ isLeader: 'desc' }, { joinedAt: 'asc' }],
          select: {
            isLeader: true,
            user: { select: { id: true, username: true, avatarData: true, updatedAt: true } },
          },
        },
        solves: {
          orderBy: { solvedAt: 'desc' },
          select: {
            id: true,
            points: true,
            solvedAt: true,
            user: { select: { id: true, username: true } },
            challenge: { select: { title: true, category: { select: { slug: true } } } },
          },
        },
      },
    }),
    getLeaderboard(),
  ]);
  if (!team) notFound();

  const entry = leaderboard.find((item) => item.userId === ownerKey);
  const history = entry ? await getScoreHistory([ownerKey]) : [];
  const leader = team.members.find((member) => member.isLeader)?.user ?? team.members[0]?.user;
  const leaderAvatar = leader?.avatarData
    ? `/api/users/${leader.id}/avatar?v=${leader.updatedAt.getTime()}`
    : undefined;
  const dateFormatter = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <PageLayout>
      <main className="profile-main team-page">
        <section className="profile-card" aria-labelledby="team-title">
          <ProfileImage src={leaderAvatar} name={team.name} />
          <div className="profile-identity">
            <h1 id="team-title">{team.name}</h1>
            <p>{team.members.length} members</p>
          </div>
          <dl className="profile-record" aria-label="팀 기록">
            <div><dt>순위</dt><dd>{entry ? `#${entry.rank}` : '—'}</dd></div>
            <div><dt>점수</dt><dd>{entry?.score ?? 0}<span> PTS</span></dd></div>
            <div><dt>해결</dt><dd>{team.solves.length}</dd></div>
          </dl>
        </section>

        <section className="team-members" aria-labelledby="team-members-title">
          <h2 id="team-members-title">팀원</h2>
          <ul>
            {team.members.map((member) => (
              <li key={member.user.id}>
                <Link href={`/users/${member.user.id}`}>{member.user.username}</Link>
                {member.isLeader && <span>Leader</span>}
              </li>
            ))}
          </ul>
        </section>

        {entry && history.length > 0 && (
          <section className="team-score-section" aria-labelledby="team-score-title">
            <h2 id="team-score-title">점수 변동</h2>
            <ScoreHistoryChart leaderboard={[entry]} history={history} />
          </section>
        )}

        <section className="recent-solves">
          <div><h2>해결한 문제</h2></div>
          {team.solves.length ? team.solves.map((solve) => (
            <article key={solve.id}>
              <div>
                <strong>{solve.challenge.title}</strong>
                <small>{solve.challenge.category.slug.toUpperCase()} · <Link href={`/users/${solve.user.id}`}>{solve.user.username}</Link></small>
              </div>
              <b>+{solve.points}</b>
              <time dateTime={solve.solvedAt.toISOString()}>{dateFormatter.format(solve.solvedAt)}</time>
            </article>
          )) : <div className="profile-empty"><p>아직 해결한 문제가 없습니다.</p></div>}
        </section>
      </main>
    </PageLayout>
  );
}
