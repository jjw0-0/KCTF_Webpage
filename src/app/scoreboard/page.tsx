import PageLayout from '@/components/PageLayout';
import { getLeaderboard } from '@/lib/challenges';

export const dynamic = 'force-dynamic';

export default async function ScoreboardPage() {
  const leaderboard = await getLeaderboard();
  const podium = [leaderboard[1], leaderboard[0], leaderboard[2]].filter(Boolean);

  return (
    <PageLayout>
      <main className="scoreboard-main">
        <header className="scoreboard-heading">
          <p className="eyebrow">LIVE RANKING / INDIVIDUAL</p>
          <h1>Scoreboard</h1>
          <p>풀이 속도보다 끝까지 파고드는 집요함을 기록합니다.</p>
        </header>
        {leaderboard.length ? (
          <>
            <section className="score-podium" aria-label="상위 참가자">
              {podium.map((player) => (
                <article key={player.userId} className={`podium-card podium-${player.rank}`}>
                  <span>0{player.rank}</span>
                  <strong>{player.name}</strong>
                  <b>{player.score.toLocaleString()} PTS</b>
                  <small>{player.solved} SOLVED</small>
                </article>
              ))}
            </section>
            <section className="score-table">
              <div className="score-row score-head"><span>RANK</span><span>PLAYER</span><span>SOLVED</span><span>SCORE</span></div>
              {leaderboard.map((player) => (
                <div className="score-row" key={player.userId}>
                  <span>#{String(player.rank).padStart(2, '0')}</span>
                  <strong>{player.name}</strong>
                  <span>{player.solved}</span>
                  <b>{player.score.toLocaleString()}</b>
                </div>
              ))}
            </section>
          </>
        ) : (
          <section className="empty-state"><p>아직 등록된 풀이가 없습니다.</p></section>
        )}
      </main>
    </PageLayout>
  );
}
