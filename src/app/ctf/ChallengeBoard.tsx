'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Category, Challenge } from '@/lib/platform-data';
import type { CtfSchedule } from '@/lib/ctf-schedule';
import InstanceControl from './InstanceControl';
import ChallengeDescription from '@/components/ChallengeDescription';
import { safeResourceUrl } from '@/lib/challenge-media';

type ChallengeBoardProps = {
  initialCategory: string;
  initialChallengeId?: string;
  schedule?: CtfSchedule;
  isAuthenticated: boolean;
  categories: Category[];
  challenges: Challenge[];
};

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => { finished: Promise<void> };
};

export default function ChallengeBoard({ initialCategory, initialChallengeId, isAuthenticated, categories, challenges: initialChallenges }: ChallengeBoardProps) {
  const visibleCategories = useMemo(() => categories.filter((category) => category.visible), [categories]);
  const [challenges, setChallenges] = useState(initialChallenges);
  const [activeCategory, setActiveCategory] = useState(
    visibleCategories.some((category) => category.slug === initialCategory) ? initialCategory : 'all',
  );
  const [selected, setSelected] = useState<Challenge | null>(
    () => initialChallenges.find((challenge) => challenge.id === initialChallengeId) ?? null,
  );
  const [hoveredChallengeId, setHoveredChallengeId] = useState<string | null>(null);
  const [transitionChallengeId, setTransitionChallengeId] = useState<string | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [flag, setFlag] = useState('');
  const [submission, setSubmission] = useState<{ state: 'idle' | 'submitting' | 'correct' | 'duplicate' | 'wrong' | 'error'; message?: string }>({ state: 'idle' });
  const dialogRef = useRef<HTMLElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const transitionSourceRef = useRef<HTMLElement | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const selectedId = selected?.id;

  const closeChallenge = useCallback(() => {
    if (closeTimerRef.current) return;
    const viewTransition = (document as ViewTransitionDocument).startViewTransition;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const source = transitionSourceRef.current;
    if (viewTransition && source?.isConnected && !reduceMotion) {
      document.documentElement.classList.remove('challenge-opening');
      document.documentElement.classList.add('challenge-closing');
      const transition = viewTransition.call(document, () => {
        source.style.viewTransitionName = 'challenge-panel';
        flushSync(() => {
          setTransitionChallengeId(null);
          setSelected(null);
        });
      });
      const cleanupTransition = () => {
        source.style.viewTransitionName = '';
        document.documentElement.classList.remove('challenge-closing');
        transitionSourceRef.current = null;
      };
      transition.finished.then(cleanupTransition, cleanupTransition);
      return;
    }
    setIsClosing(true);
    const duration = reduceMotion ? 0 : 180;
    closeTimerRef.current = window.setTimeout(() => {
      setTransitionChallengeId(null);
      setSelected(null);
      setIsClosing(false);
      closeTimerRef.current = null;
      transitionSourceRef.current = null;
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
    const previousFocus = returnFocusRef.current;
    const handleDialogKeys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeChallenge();
      if (event.key !== 'Tab') return;
      const focusable = [...(dialogRef.current?.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), video[controls], iframe, [tabindex="0"]') ?? [])];
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

  const openChallenge = (challenge: Challenge, source: HTMLElement) => {
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
    const viewTransition = (document as ViewTransitionDocument).startViewTransition;
    const useSharedTransition = Boolean(viewTransition) && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const update = () => {
      source.style.viewTransitionName = '';
      flushSync(() => {
        setIsClosing(false);
        setTransitionChallengeId(useSharedTransition ? challenge.id : null);
        setSelected(challenge);
        setFlag('');
        setSubmission({ state: 'idle' });
      });
    };
    transitionSourceRef.current = useSharedTransition ? source : null;
    if (useSharedTransition && viewTransition) {
      document.documentElement.classList.remove('challenge-closing');
      document.documentElement.classList.add('challenge-opening');
      source.style.viewTransitionName = 'challenge-panel';
      const transition = viewTransition.call(document, update);
      const cleanupTransition = () => document.documentElement.classList.remove('challenge-opening');
      transition.finished.then(cleanupTransition, cleanupTransition);
    } else {
      update();
    }
  };

  const submitFlag = async () => {
    if (!isAuthenticated || !selected || !flag.trim()) return;
    const submittedId = selected.id;
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
        setSubmission({ state: 'wrong', message: '오답입니다' });
        return;
      }
      setChallenges((current) => current.map((challenge) => challenge.id === submittedId
        ? { ...challenge, solved: true, solves: payload.solves, points: payload.points }
        : challenge));
      setSelected((challenge) => challenge?.id === submittedId ? { ...challenge, solved: true, solves: payload.solves, points: payload.points } : challenge);
      setSubmission(
        payload.alreadySolved
          ? { state: 'duplicate', message: '이미 해결했습니다' }
          : { state: 'correct', message: '정답입니다' },
      );
    } catch (error) {
      setSubmission({ state: 'error', message: error instanceof Error ? error.message : '제출에 실패했습니다.' });
    }
  };

  return (
    <main className="challenge-main">
      <header className="challenge-heading">
        <div className="challenge-tools">
          <div className="category-tabs" role="group" aria-label="카테고리 필터">
            <button type="button" aria-pressed={activeCategory === 'all'} className={activeCategory === 'all' ? 'active' : ''} onClick={() => setActiveCategory('all')}>ALL</button>
            {visibleCategories.map((category) => (
              <button key={category.id} type="button" aria-pressed={activeCategory === category.slug} className={activeCategory === category.slug ? 'active' : ''} onClick={() => setActiveCategory(category.slug)}>
                {category.shortName}
              </button>
            ))}
          </div>
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
                <div
                  key={challenge.id}
                  className={`challenge-card-slot ${hoveredChallengeId === challenge.id ? 'is-active' : ''}`}
                  style={{ '--stack-index': index, '--stack-step': Math.min(index, 4) } as React.CSSProperties}
                  onPointerEnter={(event) => { if (event.pointerType !== 'touch') setHoveredChallengeId(challenge.id); }}
                  onPointerLeave={() => setHoveredChallengeId(null)}
                  onPointerCancel={() => setHoveredChallengeId(null)}
                  onFocus={() => setHoveredChallengeId(challenge.id)}
                  onBlur={() => setHoveredChallengeId(null)}
                >
                <button
                  type="button"
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
            <button type="button" onClick={() => setActiveCategory('all')}>전체 문제 보기</button>
          </div>
        )}
      </div>

      {selected && (
        <div className={`challenge-dialog-backdrop ${isClosing ? 'is-closing' : ''}`} role="presentation" onMouseDown={closeChallenge}>
          <section
            ref={dialogRef}
            className={`challenge-dialog ${transitionChallengeId === selected.id ? 'is-shared-transition' : ''}`}
            style={{ '--category-accent': visibleCategories.find((category) => category.slug === selected.category)?.color ?? '#34b27b', viewTransitionName: transitionChallengeId === selected.id ? 'challenge-panel' : undefined } as React.CSSProperties}
            role="dialog"
            aria-modal="true"
            aria-labelledby="challenge-dialog-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <span className="card-beam dialog-beam" aria-hidden="true" />
            <header className="dialog-header">
              <button className="dialog-close" type="button" onClick={closeChallenge} aria-label="닫기" autoFocus>
                <svg viewBox="0 0 18 18" aria-hidden="true"><path d="m4 4 10 10M14 4 4 14" /></svg>
              </button>
              <div className="dialog-hero">
                <div>
                  <h2 id="challenge-dialog-title">{selected.title}</h2>
                  <p className="dialog-author"><span>Author</span> {selected.author || '-'}</p>
                </div>
                <div className="dialog-value"><strong>{selected.points}</strong><span>POINTS</span></div>
              </div>
            </header>
            <div className="dialog-body" tabIndex={0} role="region" aria-label="문제 설명">
              <ChallengeDescription content={selected.description || selected.summary} />
              {selected.fileUrl && safeResourceUrl(selected.fileUrl) && (
                <a className="challenge-file" href={safeResourceUrl(selected.fileUrl)} target="_blank" rel="noopener noreferrer" download>
                  <span className="file-icon" aria-hidden="true">↓</span><span>문제 파일<small>첨부파일 다운로드</small></span><span aria-hidden="true">↗</span>
                </a>
              )}
              {!selected.usesVm && selected.connectionUrl && safeResourceUrl(selected.connectionUrl) && (
                <a className="challenge-file challenge-access-link" href={safeResourceUrl(selected.connectionUrl)} target="_blank" rel="noopener noreferrer">
                  <span className="file-icon" aria-hidden="true">↗</span><span>접속 주소<small>{selected.connectionUrl}</small></span><span aria-hidden="true">→</span>
                </a>
              )}
              {(selected.usesVm || selected.instanceSlug) && (selected.instanceSlug
                ? <InstanceControl key={selected.id} challengeId={selected.id} enabled />
                : <div className="instance-control vm-pending"><strong>Instance 준비 중</strong><p>생성 방식이 연결되면 이곳에서 Instance를 시작할 수 있습니다.</p></div>)}
            </div>
            <form className="flag-form" onSubmit={(event) => { event.preventDefault(); void submitFlag(); }}>
              <div className="flag-form-head">
                <label htmlFor="flag-input">플래그 제출</label>
                {isAuthenticated && submission.message && (
                  <span className={`flag-status-badge is-${submission.state}`} role="status">
                    {submission.message}
                  </span>
                )}
              </div>
              <div className={`flag-input-box is-${submission.state}`}>
                <input
                  id="flag-input"
                  name="flag"
                  required
                  maxLength={256}
                  value={flag}
                  onChange={(event) => {
                    setFlag(event.target.value);
                    if (submission.state !== 'idle') setSubmission({ state: 'idle' });
                  }}
                  placeholder={isAuthenticated ? 'KCTF{…}' : '로그인 후 제출할 수 있습니다'}
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  disabled={!isAuthenticated}
                  aria-invalid={submission.state === 'wrong' || submission.state === 'error'}
                />
                <button type="submit" disabled={!isAuthenticated || !flag.trim() || submission.state === 'submitting'}>{submission.state === 'submitting' ? '확인 중…' : isAuthenticated ? '제출 →' : '로그인 필요'}</button>
              </div>
              {!isAuthenticated && selected && (
                <p className="submission-message error" role="status">
                  플래그를 제출하려면 <a href={`/login?callbackUrl=${encodeURIComponent(`/ctf?category=${activeCategory}&challenge=${selected.id}`)}`}>로그인해 주세요.</a>
                </p>
              )}
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
