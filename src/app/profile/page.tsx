import Link from 'next/link';
import PageLayout from '@/components/PageLayout';
import { challenges } from '@/lib/platform-data';

export default function ProfilePage() {
  const solved = challenges.filter((challenge) => challenge.solved);

  return (
    <PageLayout>
      <main className="profile-main">
        <section className="profile-card">
          <div className="profile-avatar">0x</div>
          <div>
            <p className="eyebrow">PLAYER PROFILE</p>
            <h1>guest_operator</h1>
            <p>Team / not assigned</p>
          </div>
          <Link href="/ctf" className="button button-primary">CONTINUE →</Link>
        </section>
        <section className="profile-grid">
          <article className="profile-stat"><span>RANK</span><strong>#42</strong><small>TOP 38%</small></article>
          <article className="profile-stat"><span>SCORE</span><strong>350</strong><small>PTS</small></article>
          <article className="profile-stat"><span>SOLVED</span><strong>{solved.length}</strong><small>OF {challenges.length}</small></article>
          <article className="profile-stat"><span>STREAK</span><strong>02</strong><small>DAYS</small></article>
        </section>
        <section className="recent-solves">
          <div><p className="eyebrow">ACTIVITY / RECENT</p><h2>Solved challenges</h2></div>
          {solved.map((challenge) => (
            <article key={challenge.id}>
              <span className="status-dot" />
              <div><strong>{challenge.title}</strong><small>{challenge.category.toUpperCase()}</small></div>
              <b>+{challenge.points}</b>
              <time>JUST NOW</time>
            </article>
          ))}
        </section>
      </main>
    </PageLayout>
  );
}
