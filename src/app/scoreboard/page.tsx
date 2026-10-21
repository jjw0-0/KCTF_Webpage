import PageLayout from '@/components/PageLayout';
import { leaderboard } from '@/lib/platform-data';

export default function ScoreboardPage() {
  return (
    <PageLayout>
      <main className="scoreboard-main">
        <header className="scoreboard-heading">
          <p className="eyebrow">LIVE RANKING / TEAM MODE</p>
          <h1>Scoreboard</h1>
          <p>풀이 속도보다 끝까지 파고드는 집요함을 기록합니다.</p>
        </header>
        <section className="score-podium" aria-label="상위 팀">
          {[leaderboard[1], leaderboard[0], leaderboard[2]].map((team) => (
            <article key={team.rank} className={`podium-card podium-${team.rank}`}>
              <span>0{team.rank}</span>
              <strong>{team.name}</strong>
              <b>{team.score.toLocaleString()} PTS</b>
              <small>{team.solved} SOLVED</small>
            </article>
          ))}
        </section>
        <section className="score-table">
          <div className="score-row score-head"><span>RANK</span><span>TEAM</span><span>SOLVED</span><span>SCORE</span></div>
          {leaderboard.map((team) => (
            <div className="score-row" key={team.rank}>
              <span>#{String(team.rank).padStart(2, '0')}</span>
              <strong>{team.name}</strong>
              <span>{team.solved}</span>
              <b>{team.score.toLocaleString()}</b>
            </div>
          ))}
        </section>
      </main>
    </PageLayout>
  );
}
