'use client';

import { useMemo, useState } from 'react';
import { useCategories } from '@/components/CategoryProvider';
import { Challenge, challenges } from '@/lib/platform-data';

type ChallengeBoardProps = {
  initialCategory: string;
};

const difficultyLabel = {
  BEGINNER: 'Beginner',
  INTERMEDIATE: 'Intermediate',
  ADVANCED: 'Advanced',
};

export default function ChallengeBoard({ initialCategory }: ChallengeBoardProps) {
  const { categories } = useCategories();
  const validInitial = categories.some((category) => category.slug === initialCategory)
    ? initialCategory
    : 'all';
  const [activeCategory, setActiveCategory] = useState(validInitial);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Challenge | null>(null);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return challenges.filter((challenge) => {
      const categoryMatches = activeCategory === 'all' || challenge.category === activeCategory;
      const queryMatches = !normalized || [challenge.title, challenge.summary, ...challenge.tags]
        .some((value) => value.toLowerCase().includes(normalized));
      return categoryMatches && queryMatches;
    });
  }, [activeCategory, query]);

  const solvedCount = challenges.filter((challenge) => challenge.solved).length;

  return (
    <main className="challenge-main">
      <section className="challenge-intro">
        <div>
          <p className="eyebrow">PLAYER VIEW / CHALLENGES</p>
          <h1>Break the expected.</h1>
          <p>문제를 선택해 분석을 시작하세요. 해결한 문제는 초록색 신호로 표시됩니다.</p>
        </div>
        <div className="player-progress">
          <div className="progress-copy">
            <span>YOUR PROGRESS</span>
            <strong>{solvedCount}<small> / {challenges.length}</small></strong>
          </div>
          <div className="progress-track"><i style={{ width: `${(solvedCount / challenges.length) * 100}%` }} /></div>
        </div>
      </section>

      <section className="challenge-toolbar" aria-label="문제 필터">
        <div className="category-tabs" role="tablist" aria-label="카테고리">
          <button
            type="button"
            role="tab"
            aria-selected={activeCategory === 'all'}
            className={activeCategory === 'all' ? 'active' : ''}
            onClick={() => setActiveCategory('all')}
          >
            ALL <span>{challenges.length}</span>
          </button>
          {categories.filter((category) => category.visible).map((category) => {
            const count = challenges.filter((challenge) => challenge.category === category.slug).length;
            return (
              <button
                key={category.id}
                type="button"
                role="tab"
                aria-selected={activeCategory === category.slug}
                className={activeCategory === category.slug ? 'active' : ''}
                onClick={() => setActiveCategory(category.slug)}
              >
                {category.shortName} <span>{count}</span>
              </button>
            );
          })}
        </div>
        <label className="challenge-search">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="6" stroke="currentColor"/><path d="m16 16 4 4" stroke="currentColor"/></svg>
          <span className="sr-only">문제 검색</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search target..." />
          <kbd>/</kbd>
        </label>
      </section>

      <section className="challenge-results" aria-live="polite">
        <div className="result-meta">
          <span>{String(filtered.length).padStart(2, '0')} TARGETS FOUND</span>
          <span>SORT / CATEGORY</span>
        </div>

        {filtered.length > 0 ? (
          <div className="challenge-grid">
            {filtered.map((challenge, index) => {
              const category = categories.find((item) => item.slug === challenge.category);
              return (
                <button
                  key={challenge.id}
                  type="button"
                  className={`tilted-card ${challenge.solved ? 'is-solved' : ''}`}
                  style={{ '--card-tilt': `${index % 2 === 0 ? -2.2 : 2.2}deg` } as React.CSSProperties}
                  onClick={() => setSelected(challenge)}
                >
                  <span className="card-scan" />
                  <span className="card-topline">
                    <span className="card-category">{category?.shortName}</span>
                    <span className="card-status">{challenge.solved ? 'SOLVED' : `#${String(index + 1).padStart(2, '0')}`}</span>
                  </span>
                  <span className="card-body">
                    <strong>{challenge.title}</strong>
                    <span>{challenge.summary}</span>
                  </span>
                  <span className="card-bottomline">
                    <span>{difficultyLabel[challenge.difficulty]}</span>
                    <span className="card-points">{challenge.points}<small> pts</small></span>
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">
            <span>404</span>
            <p>조건에 맞는 문제가 없습니다.</p>
            <button type="button" onClick={() => { setActiveCategory('all'); setQuery(''); }}>필터 초기화</button>
          </div>
        )}
      </section>

      {selected && (
        <div className="challenge-dialog-backdrop" role="presentation" onMouseDown={() => setSelected(null)}>
          <section
            className="challenge-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="challenge-dialog-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="dialog-topline">
              <span>KCTF://CHALLENGE/{selected.id.toUpperCase()}</span>
              <button type="button" onClick={() => setSelected(null)} aria-label="닫기">×</button>
            </div>
            <p className="eyebrow">{selected.category.toUpperCase()} / {difficultyLabel[selected.difficulty]}</p>
            <h2 id="challenge-dialog-title">{selected.title}</h2>
            <p className="dialog-summary">{selected.summary}</p>
            <div className="dialog-stats">
              <div><span>VALUE</span><strong>{selected.points} PTS</strong></div>
              <div><span>SOLVES</span><strong>{selected.solves}</strong></div>
              <div><span>STATUS</span><strong>{selected.solved ? 'CLEARED' : 'OPEN'}</strong></div>
            </div>
            <div className="tag-list">{selected.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>
            <form className="flag-form" onSubmit={(event) => event.preventDefault()}>
              <label htmlFor="flag-input">Submit flag</label>
              <div>
                <input id="flag-input" placeholder="KCTF{...}" autoComplete="off" />
                <button type="submit">VERIFY →</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
