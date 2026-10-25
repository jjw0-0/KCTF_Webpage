import Image from 'next/image';
import PageLayout from '@/components/PageLayout';
import ScoreHistoryChart from '@/components/ScoreHistoryChart';
import { getLeaderboard, getScoreHistory } from '@/lib/challenges';

export const dynamic = 'force-dynamic';

export default async function ScoreboardPage() {
  const leaderboard = await getLeaderboard();
  const history = await getScoreHistory(leaderboard.slice(0, 10).map((player) => player.userId));
  const pointFormatter = new Intl.NumberFormat('ko-KR');

  return (
    <PageLayout>
      <main className="scoreboard-main">
        <header className="scoreboard-heading">
          <h1>Scoreboard</h1>
        </header>
        <ScoreHistoryChart leaderboard={leaderboard} history={history} />
        <section className="score-table-wrap" aria-label="참가자 순위">
          <table className="score-table">
            <thead><tr><th>순위</th><th>플레이어</th><th>점수</th></tr></thead>
            <tbody>
            {leaderboard.map((player) => (
              <tr className={player.rank <= 3 ? 'is-top-three' : ''} key={player.userId}>
                <td>#{String(player.rank).padStart(2, '0')}</td>
                <th scope="row">
                  <div className="scoreboard-player">
                    <div className="scoreboard-avatar" aria-hidden="true">
                      {player.avatarData ? (
                        <Image src={player.avatarData} alt="" width={40} height={40} unoptimized />
                      ) : (
                        player.name.slice(0, 2).toUpperCase()
                      )}
                    </div>
                    <span>{player.name}</span>
                  </div>
                </th>
                <td>{pointFormatter.format(player.score)}</td>
              </tr>
            ))}
            </tbody>
          </table>
        </section>
      </main>
    </PageLayout>
  );
}
