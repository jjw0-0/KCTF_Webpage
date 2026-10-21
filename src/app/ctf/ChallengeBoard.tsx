'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Category, Challenge } from '@/lib/platform-data';
import InstanceControl from './InstanceControl';

type ChallengeBoardProps = {
  initialCategory: string;
  categories: Category[];
  challenges: Challenge[];
};

const difficultyLabel = {
  BEGINNER: 'Beginner',
  INTERMEDIATE: 'Intermediate',
  ADVANCED: 'Advanced',
};

export default function ChallengeBoard({ initialCategory, categories, challenges: initialChallenges }: ChallengeBoardProps) {
  const visibleCategories = useMemo(() => categories.filter((category) => category.visible), [categories]);
  const [challenges, setChallenges] = useState(initialChallenges);
  const [activeCategory, setActiveCategory] = useState(
    visibleCategories.some((category) => category.slug === initialCategory) ? initialCategory : 'all',
  );
  const [selected, setSelected] = useState<Challenge | null>(null);
  const [hoveredChallengeId, setHoveredChallengeId] = useState<string | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [flag, setFlag] = useState('');
  const [submission, setSubmission] = useState<{ state: 'idle' | 'submitting' | 'correct' | 'wrong' | 'error'; message?: string }>({ state: 'idle' });
  const dialogRef = useRef<HTMLElement>(null);
  const closeTimerRef = useRef<number | null>(null);
  const selectedId = selected?.id;

  const closeChallenge = useCallback(() => {
    if (closeTimerRef.current) return;
    setIsClosing(true);
    const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180;
    closeTimerRef.current = window.setTimeout(() => {
      setSelected(null);
      setIsClosing(false);
      closeTimerRef.current = null;
    }, duration);
  }, []);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement as HTMLElement | null;
    const handleDialogKeys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeChallenge();
      if (event.key !== 'Tab') return;
      const focusable = [...(dialogRef.current?.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)') ?? [])];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleDialogKeys);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleDialogKeys);
      previousFocus?.focus();
    };
  }, [closeChallenge, selectedId]);

  const groups = useMemo(() => {
    return visibleCategories.flatMap((category) => {
      if (activeCategory !== 'all' && activeCategory !== category.slug) return [];
      const items = challenges.filter((challenge) => challenge.category === category.slug);
      return items.length ? [{ category, items }] : [];
    });
  }, [activeCategory, challenges, visibleCategories]);

  const resultCount = groups.reduce((count, group) => count + group.items.length, 0);
  const solvedCount = challenges.filter((challenge) => challenge.solved).length;

  const openChallenge = (challenge: Challenge) => {
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    setIsClosing(false);
    setSelected(challenge);
    setFlag('');
    setSubmission({ state: 'idle' });
  };

  const submitFlag = async () => {
    if (!selected || !flag.trim()) return;
    setSubmission({ state: 'submitting' });
    try {
      const response = await fetch(`/api/challenges/${encodeURIComponent(selected.id)}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flag }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? '제출에 실패했습니다.');
      if (!payload.correct) {
        setSubmission({ state: 'wrong', message: '올바른 플래그가 아닙니다.' });
        return;
      }
      const updated = challenges.map((challenge) => challenge.id === selected.id
        ? { ...challenge, solved: true, solves: payload.solves }
        : challenge);
      setChallenges(updated);
      setSelected((challenge) => challenge ? { ...challenge, solved: true, solves: payload.solves } : null);
      setSubmission({ state: 'correct', message: payload.alreadySolved ? '이미 해결한 문제입니다.' : `정답입니다. +${selected.points} PTS` });
    } catch (error) {
      setSubmission({ state: 'error', message: error instanceof Error ? error.message : '제출에 실패했습니다.' });
    }
  };

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
          <span className="challenge-progress">{String(resultCount).padStart(2, '0')} CHALLENGES · {solvedCount}/{challenges.length} SOLVED</span>
        </div>
      </header>

      <div className="challenge-groups" aria-live="polite">
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
                <button
                  key={challenge.id}
                  type="button"
                  className={`stacked-card ${challenge.solved ? 'is-solved' : ''} ${hoveredChallengeId === challenge.id ? 'is-hovered' : ''}`}
                  style={{ '--stack-index': index } as React.CSSProperties}
                  aria-label={`${challenge.title}, ${challenge.points} 포인트, ${challenge.solves}명 해결${challenge.solved ? ', 해결 완료' : ''}`}
                  onPointerEnter={() => setHoveredChallengeId(challenge.id)}
                  onPointerLeave={() => setHoveredChallengeId(null)}
                  onPointerCancel={() => setHoveredChallengeId(null)}
                  onClick={() => openChallenge(challenge)}
                >
                  <strong>{challenge.title}</strong>
                  <span className="stacked-card-footer">
                    <span className="stacked-card-points">{challenge.points}<small>PTS</small></span>
                    <span className="stacked-card-meta">{challenge.solves}<small>SOLVERS</small></span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        ))}

        {!resultCount && (
          <div className="empty-state">
            <p>선택한 카테고리에 문제가 없습니다.</p>
            <button type="button" onClick={() => setActiveCategory('all')}>전체 문제 보기</button>
          </div>
        )}
      </div>

      {selected && (
        <div className={`challenge-dialog-backdrop ${isClosing ? 'is-closing' : ''}`} role="presentation" onMouseDown={closeChallenge}>
          <section
            ref={dialogRef}
            className="challenge-dialog"
            style={{ '--category-accent': visibleCategories.find((category) => category.slug === selected.category)?.color ?? '#34b27b' } as React.CSSProperties}
            role="dialog"
            aria-modal="true"
            aria-labelledby="challenge-dialog-title"
            aria-describedby="challenge-dialog-summary"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="dialog-topline">
              <span>KCTF / {selected.category.toUpperCase()}</span>
              <button type="button" onClick={closeChallenge} aria-label="닫기" autoFocus><span>CLOSE</span> ×</button>
            </div>
            <div className="dialog-hero">
              <div>
                <p className="eyebrow">{difficultyLabel[selected.difficulty]}</p>
                <h2 id="challenge-dialog-title">{selected.title}</h2>
              </div>
              <div className="dialog-value"><strong>{selected.points}</strong><span>POINTS</span></div>
            </div>
            <p id="challenge-dialog-summary" className="dialog-summary">{selected.summary}</p>
            <div className="dialog-stats">
              <div><span>SOLVES</span><strong>{selected.solves}</strong></div>
              <div><span>STATUS</span><strong>{selected.solved ? 'CLEARED' : 'OPEN'}</strong></div>
              <div><span>CATEGORY</span><strong>{selected.category.toUpperCase()}</strong></div>
            </div>
            <div className="tag-list">{selected.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>
            <InstanceControl challengeId={selected.id} enabled={Boolean(selected.instanceSlug)} />
            <form className="flag-form" onSubmit={(event) => { event.preventDefault(); void submitFlag(); }}>
              <label htmlFor="flag-input">Submit flag</label>
              <div>
                <input id="flag-input" value={flag} onChange={(event) => setFlag(event.target.value)} placeholder="KCTF{...}" autoComplete="off" />
                <button type="submit" disabled={submission.state === 'submitting'}>{submission.state === 'submitting' ? 'VERIFYING…' : 'VERIFY →'}</button>
              </div>
              {submission.message && <p className={`submission-message ${submission.state}`} role="status">{submission.message}</p>}
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
