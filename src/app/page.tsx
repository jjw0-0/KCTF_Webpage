'use client';

import Link from 'next/link';
import PageLayout from '@/components/PageLayout';
import { useCategories } from '@/components/CategoryProvider';
import { event } from '@/lib/platform-data';

function ArrowIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none">
      <path d="M5 12h14M14 7l5 5-5 5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export default function HomePage() {
  const { categories } = useCategories();
  const visibleCategories = categories.filter((category) => category.visible);

  return (
    <PageLayout>
      <main className="landing-main">
        <section className="landing-hero" aria-labelledby="landing-title">
          <div className="hero-copy">
            <div className="status-pill">
              <span className="status-dot" />
              {event.status}
            </div>

            <p className="eyebrow mt-8">K.KNOCK SECURITY COMPETITION</p>
            <h1 id="landing-title" className="hero-title" aria-label="KCTF">
              <span>K</span><span>C</span><span>T</span><span>F</span>
            </h1>
            <p className="hero-summary">
              경계를 의심하고, 시스템을 해체하고, 더 안전하게 다시 연결하는
              K.knock의 해킹 대회.
            </p>

            <div className="hero-actions">
              <Link href="/ctf" className="button button-primary">
                문제 탐색하기 <ArrowIcon />
              </Link>
              <Link href="/scoreboard" className="button button-ghost">
                스코어보드 보기
              </Link>
            </div>
          </div>

          <aside className="event-console" aria-label="대회 정보">
            <div className="console-topline">
              <span>KCTF://EVENT</span>
              <span className="text-kctf">ONLINE</span>
            </div>
            <div className="console-grid">
              <div className="console-block console-date">
                <span className="console-label">START</span>
                <strong>12.10</strong>
                <small>10:00 KST</small>
              </div>
              <div className="console-separator">→</div>
              <div className="console-block console-date">
                <span className="console-label">END</span>
                <strong>12.13</strong>
                <small>22:00 KST</small>
              </div>
            </div>
            <div className="console-metrics">
              <div><span>MODE</span><strong>TEAM</strong></div>
              <div><span>DURATION</span><strong>84H</strong></div>
              <div><span>CATEGORIES</span><strong>{visibleCategories.length}</strong></div>
            </div>
            <div className="signal-line" aria-hidden="true">
              {Array.from({ length: 18 }).map((_, index) => (
                <i key={index} style={{ height: `${10 + ((index * 13) % 34)}%` }} />
              ))}
            </div>
          </aside>
        </section>

        <section className="category-section" aria-labelledby="category-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">ATTACK SURFACE / 01</p>
              <h2 id="category-title">Choose your vector.</h2>
            </div>
            <p>카테고리는 운영 상황에 맞춰 관리자 화면에서 추가·정렬·비공개할 수 있습니다.</p>
          </div>

          <div className="category-marquee">
            {visibleCategories.map((category, index) => (
              <Link key={category.id} href={`/ctf?category=${category.slug}`} className="category-strip">
                <span className="category-index">0{index + 1}</span>
                <span className="category-name">{category.shortName}</span>
                <span className="category-description">{category.description}</span>
                <ArrowIcon />
              </Link>
            ))}
          </div>
        </section>

        <section className="manifesto-section">
          <p className="eyebrow">K.KNOCK / SINCE 2001</p>
          <p className="manifesto-copy">
            우리는 정답보다 <em>좋은 질문</em>을, 우연한 성공보다
            <em> 재현 가능한 이해</em>를 믿습니다.
          </p>
          <div className="manifesto-meta">
            <span>KYONGGI UNIVERSITY</span>
            <span>HACKING &amp; SECURITY CLUB</span>
            <span>SUWON, KR</span>
          </div>
        </section>
      </main>
    </PageLayout>
  );
}
