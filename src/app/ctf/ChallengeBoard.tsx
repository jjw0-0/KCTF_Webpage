'use client';

import { useMemo, useState, useSyncExternalStore } from 'react';
import type { Category, Challenge } from '@/lib/platform-data';
import ChallengeDialog from './ChallengeDialog';
import useChallengeNavigation from './useChallengeNavigation';

type ChallengeBoardProps = {
  initialCategory: string;
  initialChallengeId?: string;
  isAuthenticated: boolean;
  categories: Category[];
  challenges: Challenge[];
};

const subscribeToHydration = () => () => {};

export default function ChallengeBoard({ initialCategory, initialChallengeId, isAuthenticated, categories, challenges: initialChallenges }: ChallengeBoardProps) {
  const ready = useSyncExternalStore(subscribeToHydration, () => true, () => false);
  const visibleCategories = useMemo(() => categories.filter((category) => category.visible), [categories]);
  const [challenges, setChallenges] = useState(initialChallenges);
  const [hoveredChallengeId, setHoveredChallengeId] = useState<string | null>(null);
  const { activeCategory, changeCategory, selected, openChallenge, closeChallenge, dialogRef, boardRef, transitionChallengeId, isClosing } = useChallengeNavigation(initialCategory, initialChallengeId, visibleCategories, challenges);
  const groups = useMemo(() => visibleCategories.flatMap((category) => {
    if (activeCategory !== 'all' && activeCategory !== category.slug) return [];
    const items = challenges.filter((challenge) => challenge.category === category.slug);
    return items.length ? [{ category, items }] : [];
  }), [activeCategory, challenges, visibleCategories]);
  const resultCount = groups.reduce((count, group) => count + group.items.length, 0);
  const availableChallenges = challenges.filter((challenge) => visibleCategories.some((category) => category.slug === challenge.category));
  const solvedCount = availableChallenges.filter((challenge) => challenge.solved).length;
  const categoryName = visibleCategories.find((category) => category.slug === activeCategory)?.shortName ?? '전체';

  return (
    <main className="challenge-main">
      <div ref={boardRef} inert={Boolean(selected)}>
        <header className="challenge-heading">
          <div className="challenge-tools">
            <div className="category-tabs" role="group" aria-label="카테고리 필터">
              <button type="button" disabled={!ready} aria-pressed={activeCategory === 'all'} className={activeCategory === 'all' ? 'active' : ''} onClick={() => changeCategory('all')}>ALL</button>
              {visibleCategories.map((category) => (
                <button key={category.id} type="button" disabled={!ready} aria-pressed={activeCategory === category.slug} className={activeCategory === category.slug ? 'active' : ''} onClick={() => changeCategory(category.slug)}>{category.shortName}</button>
              ))}
            </div>
            <p className="challenge-progress">전체 <strong>{solvedCount} / {availableChallenges.length}</strong> 해결</p>
            <p className="sr-only" role="status" aria-atomic="true">{categoryName} 문제 {resultCount}개 표시</p>
          </div>
        </header>

      <div className="challenge-groups">
        {groups.map(({ category, items }) => (
          <section className="challenge-group" key={category.id} aria-labelledby={`category-${category.id}`}>
            <div className="challenge-group-title">
              <h2 id={`category-${category.id}`}>{category.shortName}</h2>
              <span>{String(items.length).padStart(2, '0')}</span>
            </div>
            <div
              className={`challenge-stack ${items.some((challenge) => challenge.id === hoveredChallengeId) ? 'is-engaged' : ''}`}
              style={{ '--category-accent': category.color } as React.CSSProperties}
            >
              {items.map((challenge, index) => (
                <div
                  key={challenge.id}
                  className={`challenge-card-slot ${hoveredChallengeId === challenge.id ? 'is-active' : ''}`}
                  style={{ '--stack-index': index, '--stack-step': Math.min(index, 4), '--entrance-index': Math.min(index, 5) } as React.CSSProperties}
                  onPointerEnter={(event) => { if (event.pointerType !== 'touch') setHoveredChallengeId(challenge.id); }}
                  onPointerLeave={() => setHoveredChallengeId(null)}
                  onPointerCancel={() => setHoveredChallengeId(null)}
                  onFocus={() => setHoveredChallengeId(challenge.id)}
                  onBlur={() => setHoveredChallengeId(null)}
                >
                <button
                  type="button"
                  disabled={!ready}
                  className={`stacked-card ${challenge.solved ? 'is-solved' : ''} ${hoveredChallengeId === challenge.id ? 'is-hovered' : ''}`}
                  aria-label={`${challenge.title}, ${challenge.points} 포인트, ${challenge.solves}명 해결${challenge.solved ? ', 해결 완료' : ''}`}
                  onClick={(event) => openChallenge(challenge, event.currentTarget.querySelector<HTMLElement>('.stacked-card-surface') ?? event.currentTarget)}
                >
                  <span className="stacked-card-surface">
                    <svg className="card-circuit" viewBox="0 0 350 184" fill="none" aria-hidden="true">
                      <path d="M236 0v23l20 20h94M267 0v12l20 20h63M350 65h-37l-14 14h-40M0 142h20l12 12h50M350 129h-26l-16 16v39" />
                      <circle cx="259" cy="79" r="3" /><circle cx="82" cy="154" r="3" />
                      <path className="circuit-ticks" d="M48 16h18m-18 5h9M320 161h-18m18 5h-9" />
                    </svg>
                    <span className="card-beam" aria-hidden="true" />
                    <span className="card-id">
                      <span>{category.shortName} / {String(index + 1).padStart(3, '0')}</span>
                      <span className={`card-state ${challenge.solved ? 'is-cleared' : ''}`}>
                        {challenge.solved
                          ? <><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3.5 8.2 2.8 2.8 6.2-6.2" /></svg><span>SOLVED</span></>
                          : <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 12 12 4M7 4h5v5" /></svg>}
                      </span>
                    </span>
                    <strong>{challenge.title}</strong>
                    <span className="stacked-card-footer">
                      <span className="stacked-card-points">{challenge.points}<small>PTS</small></span>
                      <span className="stacked-card-meta">{challenge.solves}<small>SOLVERS</small></span>
                    </span>
                  </span>
                </button>
                </div>
              ))}
            </div>
          </section>
        ))}

        {!resultCount && (
          <div className="empty-state">
            <p>선택한 카테고리에 문제가 없습니다.</p>
            <button type="button" disabled={!ready} onClick={() => changeCategory('all')}>전체 문제 보기</button>
          </div>
        )}
      </div>

      </div>
      {selected && (
        <ChallengeDialog
          key={selected.id}
          challenge={selected}
          category={activeCategory}
          accentColor={visibleCategories.find((category) => category.slug === selected.category)?.color ?? '#34b27b'}
          isAuthenticated={isAuthenticated}
          isClosing={isClosing}
          transitionChallengeId={transitionChallengeId}
          dialogRef={dialogRef}
          onClose={closeChallenge}
          onSolved={(id, result) => setChallenges((current) => current.map((challenge) => challenge.id === id ? { ...challenge, solved: true, ...result } : challenge))}
        />
      )}
    </main>
  );
}
