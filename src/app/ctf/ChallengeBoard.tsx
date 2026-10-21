'use client';

import { useMemo, useState } from 'react';
import { Category, Challenge, challenges } from '@/lib/platform-data';
import InstanceControl from './InstanceControl';

type ChallengeBoardProps = {
  initialCategory: string;
  categories: Category[];
};

const difficultyLabel = {
  BEGINNER: 'Beginner',
  INTERMEDIATE: 'Intermediate',
  ADVANCED: 'Advanced',
};

export default function ChallengeBoard({ initialCategory, categories }: ChallengeBoardProps) {
  const visibleCategories = categories.filter((category) => category.visible);
  const [activeCategory, setActiveCategory] = useState(
    visibleCategories.some((category) => category.slug === initialCategory) ? initialCategory : 'all',
  );
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Challenge | null>(null);

  const groups = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return visibleCategories.flatMap((category) => {
      if (activeCategory !== 'all' && activeCategory !== category.slug) return [];
      const items = challenges.filter((challenge) => challenge.category === category.slug && (
        !normalized || [challenge.title, challenge.summary, ...challenge.tags]
          .some((value) => value.toLowerCase().includes(normalized))
      ));
      return items.length ? [{ category, items }] : [];
    });
  }, [activeCategory, query, visibleCategories]);

  const resultCount = groups.reduce((count, group) => count + group.items.length, 0);
  const solvedCount = challenges.filter((challenge) => challenge.solved).length;

  return (
    <main className="challenge-main">
      <header className="challenge-heading">
        <div>
          <h1>KCTF</h1>
          <p><time dateTime="2026-12-10">2026.12.10</time> ~ <time dateTime="2026-12-13">2026.12.13</time></p>
        </div>
        <div className="challenge-tools">
          <div className="category-tabs" role="tablist" aria-label="카테고리 필터">
            <button type="button" role="tab" aria-selected={activeCategory === 'all'} className={activeCategory === 'all' ? 'active' : ''} onClick={() => setActiveCategory('all')}>ALL</button>
            {visibleCategories.map((category) => (
              <button key={category.id} type="button" role="tab" aria-selected={activeCategory === category.slug} className={activeCategory === category.slug ? 'active' : ''} onClick={() => setActiveCategory(category.slug)}>
                {category.shortName}
              </button>
            ))}
          </div>
          <label className="challenge-search">
            <span className="sr-only">문제 검색</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search challenges" />
          </label>
          <span className="challenge-progress">{solvedCount}/{challenges.length} SOLVED</span>
        </div>
      </header>

      <div className="challenge-groups" aria-live="polite">
        {groups.map(({ category, items }) => (
          <section className="challenge-group" key={category.id} aria-labelledby={`category-${category.id}`}>
            <div className="challenge-group-title">
              <h2 id={`category-${category.id}`}>{category.shortName}</h2>
              <span>{String(items.length).padStart(2, '0')}</span>
            </div>
            <div className="challenge-stack">
              {items.map((challenge, index) => (
                <button
                  key={challenge.id}
                  type="button"
                  className={`stacked-card ${challenge.solved ? 'is-solved' : ''}`}
                  style={{ '--stack-index': index } as React.CSSProperties}
                  onClick={() => setSelected(challenge)}
                >
                  <span className="stacked-card-state">{challenge.solved ? 'SOLVED' : difficultyLabel[challenge.difficulty]}</span>
                  <strong>{challenge.title}</strong>
                  <span className="stacked-card-points">{challenge.points}<small> pts</small></span>
                </button>
              ))}
            </div>
          </section>
        ))}

        {!resultCount && (
          <div className="empty-state">
            <p>조건에 맞는 문제가 없습니다.</p>
            <button type="button" onClick={() => { setActiveCategory('all'); setQuery(''); }}>필터 초기화</button>
          </div>
        )}
      </div>

      {selected && (
        <div className="challenge-dialog-backdrop" role="presentation" onMouseDown={() => setSelected(null)}>
          <section className="challenge-dialog" role="dialog" aria-modal="true" aria-labelledby="challenge-dialog-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="dialog-topline">
              <span>KCTF / {selected.category.toUpperCase()}</span>
              <button type="button" onClick={() => setSelected(null)} aria-label="닫기">×</button>
            </div>
            <p className="eyebrow">{difficultyLabel[selected.difficulty]}</p>
            <h2 id="challenge-dialog-title">{selected.title}</h2>
            <p className="dialog-summary">{selected.summary}</p>
            <div className="dialog-stats">
              <div><span>VALUE</span><strong>{selected.points} PTS</strong></div>
              <div><span>SOLVES</span><strong>{selected.solves}</strong></div>
              <div><span>STATUS</span><strong>{selected.solved ? 'CLEARED' : 'OPEN'}</strong></div>
            </div>
            <div className="tag-list">{selected.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>
            <InstanceControl challengeId={selected.id} enabled={Boolean(selected.instanceSlug)} />
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
