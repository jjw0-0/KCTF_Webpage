'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import type { Category, Challenge } from '@/lib/platform-data';

type Transition = { ready: Promise<void>; finished: Promise<void>; skipTransition: () => void };
type TransitionDocument = Document & { startViewTransition?: (update: () => void) => Transition };

function updateAddress(category: string, challengeId?: string, replace = false) {
  const url = new URL(window.location.href);
  if (category === 'all') url.searchParams.delete('category');
  else url.searchParams.set('category', category);
  if (challengeId) url.searchParams.set('challenge', challengeId);
  else url.searchParams.delete('challenge');
  if (url.href === window.location.href) return;
  // Only entries opened here may close with Back; direct links must stay on the board.
  window.history[replace ? 'replaceState' : 'pushState']({ kctfDialog: Boolean(challengeId) && !replace }, '', url);
}

export default function useChallengeNavigation(initialCategory: string, initialChallengeId: string | undefined, categories: Category[], challenges: Challenge[]) {
  const [activeCategory, setActiveCategory] = useState(categories.some((category) => category.slug === initialCategory) ? initialCategory : 'all');
  const [selectedId, setSelectedId] = useState<string | null>(initialChallengeId ?? null);
  const [transitionChallengeId, setTransitionChallengeId] = useState<string | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const dialogRef = useRef<HTMLElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const sourceRef = useRef<HTMLElement | null>(null);
  const transitionRef = useRef<Transition | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const generationRef = useRef(0);
  const closeRequestedRef = useRef(false);
  const selected = challenges.find((challenge) => challenge.id === selectedId) ?? null;
  const dialogId = selected?.id;

  const stopTransition = useCallback(() => {
    generationRef.current += 1;
    transitionRef.current?.skipTransition();
    transitionRef.current = null;
    document.documentElement.classList.remove('challenge-opening', 'challenge-closing');
    if (sourceRef.current) sourceRef.current.style.viewTransitionName = '';
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
  }, []);

  const closeVisual = useCallback(() => {
    stopTransition();
    const generation = generationRef.current;
    const source = sourceRef.current;
    const start = (document as TransitionDocument).startViewTransition;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finish = () => {
      if (generationRef.current !== generation) return;
      setSelectedId(null);
      setTransitionChallengeId(null);
      setIsClosing(false);
      closeTimerRef.current = null;
    };
    if (start && source?.isConnected && !reduceMotion) {
      document.documentElement.classList.add('challenge-closing');
      const transition = start.call(document, () => {
        if (generationRef.current !== generation) return;
        source.style.viewTransitionName = 'challenge-panel';
        flushSync(finish);
      });
      transitionRef.current = transition;
      // Skipping an interrupted animation rejects ready, but still applies its UI update.
      void transition.ready.catch(() => {});
      const cleanup = () => {
        if (transitionRef.current !== transition) return;
        source.style.viewTransitionName = '';
        if (sourceRef.current === source) sourceRef.current = null;
        document.documentElement.classList.remove('challenge-closing');
        transitionRef.current = null;
      };
      void transition.finished.then(cleanup, cleanup);
    } else {
      setIsClosing(true);
      closeTimerRef.current = window.setTimeout(finish, reduceMotion ? 0 : 180);
    }
  }, [stopTransition]);

  const closeChallenge = useCallback(() => {
    if (closeRequestedRef.current) return;
    closeRequestedRef.current = true;
    if (window.history.state?.kctfDialog) window.history.back();
    else {
      updateAddress(activeCategory, undefined, true);
      closeVisual();
    }
  }, [activeCategory, closeVisual]);

  useEffect(() => {
    const restore = () => {
      closeRequestedRef.current = false;
      const params = new URLSearchParams(window.location.search);
      const category = params.get('category');
      setActiveCategory(categories.some((item) => item.slug === category) ? category! : 'all');
      const challenge = challenges.find((item) => item.id === params.get('challenge'));
      if (!challenge && selected) closeVisual();
      else {
        stopTransition();
        sourceRef.current = null;
        setTransitionChallengeId(null);
        setIsClosing(false);
        setSelectedId(challenge?.id ?? null);
      }
    };
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, [categories, challenges, selected, closeVisual, stopTransition]);

  useEffect(() => () => stopTransition(), [stopTransition]);

  useLayoutEffect(() => {
    if (!dialogId) return;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = returnFocusRef.current;
    const board = boardRef.current;
    const handleKeys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); closeChallenge(); }
      if (event.key !== 'Tab') return;
      const focusable = [...(dialogRef.current?.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), input:not(:disabled), video[controls], iframe, [tabindex="0"]') ?? [])];
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && (document.activeElement === first || !dialogRef.current?.contains(document.activeElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current?.contains(document.activeElement))) {
        event.preventDefault(); first.focus();
      }
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeys);
    dialogRef.current?.querySelector<HTMLButtonElement>('.dialog-close')?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeys);
      if (previousFocus?.isConnected) previousFocus.focus();
      else board?.querySelector<HTMLElement>('.category-tabs button')?.focus();
    };
  // Solving updates the selected object without moving focus or unlocking the body.
  }, [dialogId, closeChallenge]);

  const changeCategory = (category: string) => {
    setActiveCategory(category);
    updateAddress(category);
  };

  const openChallenge = (challenge: Challenge, source: HTMLElement) => {
    stopTransition();
    closeRequestedRef.current = false;
    const generation = generationRef.current;
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    updateAddress(activeCategory, challenge.id);
    const start = (document as TransitionDocument).startViewTransition;
    const animate = Boolean(start) && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const update = () => {
      if (generationRef.current !== generation) return;
      source.style.viewTransitionName = '';
      flushSync(() => {
        setIsClosing(false);
        setTransitionChallengeId(animate ? challenge.id : null);
        setSelectedId(challenge.id);
      });
    };
    sourceRef.current = animate ? source : null;
    if (start && animate) {
      document.documentElement.classList.add('challenge-opening');
      source.style.viewTransitionName = 'challenge-panel';
      const transition = start.call(document, update);
      transitionRef.current = transition;
      void transition.ready.catch(() => {});
      const cleanup = () => {
        if (transitionRef.current !== transition) return;
        document.documentElement.classList.remove('challenge-opening');
        transitionRef.current = null;
      };
      void transition.finished.then(cleanup, cleanup);
    } else update();
  };

  return { activeCategory, changeCategory, selected, openChallenge, closeChallenge, dialogRef, boardRef, transitionChallengeId, isClosing };
}
