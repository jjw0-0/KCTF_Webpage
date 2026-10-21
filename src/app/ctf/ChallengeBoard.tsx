'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Challenge | null>(null);
  const [flag, setFlag] = useState('');
  const [submission, setSubmission] = useState<{ state: 'idle' | 'submitting' | 'correct' | 'wrong' | 'error'; message?: string }>({ state: 'idle' });
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
      if (event.key === '/' && !isTyping && !selected) {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [selected]);

  useEffect(() => {
    if (!selected) return;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement as HTMLElement | null;
    const handleDialogKeys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelected(null);
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
  }, [selected]);

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
  }, [activeCategory, challenges, query, visibleCategories]);

  const resultCount = groups.reduce((count, group) => count + group.items.length, 0);
  const solvedCount = challenges.filter((challenge) => challenge.solved).length;

  const openChallenge = (challenge: Challenge) => {
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
          <label className="challenge-search">
            <span className="sr-only">문제 검색</span>
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="6.5" stroke="currentColor" /><path d="m16 16 4 4" stroke="currentColor" /></svg>
            <input ref={searchInputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search challenges" />
            <kbd aria-hidden="true">/</kbd>
          </label>
          <span className="challenge-progress">{String(resultCount).padStart(2, '0')} SHOWN · {solvedCount}/{challenges.length} SOLVED</span>
        </div>
      </header>

      <div className="challenge-groups" aria-live="polite">
        {groups.map(({ category, items }) => (
          <section className="challenge-group" key={category.id} aria-labelledby={`category-${category.id}`}>
            <div className="challenge-group-title">
              <div>
                <h2 id={`category-${category.id}`}>{category.shortName}</h2>
                <p>{category.description}</p>
              </div>
              <span>{String(items.length).padStart(2, '0')}</span>
            </div>
            <div className="challenge-stack" style={{ '--category-accent': category.color } as React.CSSProperties}>
              {items.map((challenge, index) => (
                <button
                  key={challenge.id}
                  type="button"
                  className={`stacked-card ${challenge.solved ? 'is-solved' : ''}`}
                  style={{ '--stack-index': index } as React.CSSProperties}
                  onClick={() => openChallenge(challenge)}
                >
                  <span className="stacked-card-state">{challenge.solved ? 'SOLVED' : difficultyLabel[challenge.difficulty]}</span>
                  <span className="stacked-card-meta">{challenge.solves} solves</span>
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
          <section ref={dialogRef} className="challenge-dialog" role="dialog" aria-modal="true" aria-labelledby="challenge-dialog-title" aria-describedby="challenge-dialog-summary" onMouseDown={(event) => event.stopPropagation()}>
            <div className="dialog-topline">
              <span>KCTF / {selected.category.toUpperCase()}</span>
              <button type="button" onClick={() => setSelected(null)} aria-label="닫기" autoFocus><span>CLOSE</span> ×</button>
            </div>
            <p className="eyebrow">{difficultyLabel[selected.difficulty]}</p>
            <h2 id="challenge-dialog-title">{selected.title}</h2>
            <p id="challenge-dialog-summary" className="dialog-summary">{selected.summary}</p>
            <div className="dialog-stats">
              <div><span>VALUE</span><strong>{selected.points} PTS</strong></div>
              <div><span>SOLVES</span><strong>{selected.solves}</strong></div>
              <div><span>STATUS</span><strong>{selected.solved ? 'CLEARED' : 'OPEN'}</strong></div>
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
