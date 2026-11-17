'use client';

import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { Challenge } from '@/lib/platform-data';
import ChallengeDescription from '@/components/ChallengeDescription';
import { getTcpCommand, safeResourceUrl } from '@/lib/challenge-media';
import InstanceControl from './InstanceControl';
import CopyCommand from './CopyCommand';

type Submission = { state: 'idle' | 'submitting' | 'correct' | 'duplicate' | 'wrong' | 'error'; message?: string };
type SolveResult = { solves: number; points: number };

type ChallengeDialogProps = {
  challenge: Challenge;
  category: string;
  accentColor: string;
  isAuthenticated: boolean;
  isClosing: boolean;
  transitionChallengeId: string | null;
  dialogRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  onSolved: (challengeId: string, result: SolveResult) => void;
};

export default function ChallengeDialog({ challenge, category, accentColor, isAuthenticated, isClosing, transitionChallengeId, dialogRef, onClose, onSolved }: ChallengeDialogProps) {
  const [flag, setFlag] = useState('');
  const [submission, setSubmission] = useState<Submission>({ state: 'idle' });
  const [hasMoreDescription, setHasMoreDescription] = useState(false);
  const submittingRef = useRef(false);
  const mountedRef = useRef(true);
  const bodyRef = useRef<HTMLDivElement>(null);
  const fileUrl = challenge.fileUrl ? safeResourceUrl(challenge.fileUrl) : undefined;
  const connectionUrl = challenge.connectionType !== 'TCP' && challenge.connectionUrl ? safeResourceUrl(challenge.connectionUrl) : undefined;
  const tcpCommand = challenge.connectionType === 'TCP' && challenge.connectionUrl ? getTcpCommand(challenge.connectionUrl) : undefined;

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    const update = () => setHasMoreDescription(body.scrollHeight - body.clientHeight - body.scrollTop > 8);
    const observer = new ResizeObserver(update);
    observer.observe(body);
    if (body.firstElementChild) observer.observe(body.firstElementChild);
    body.addEventListener('scroll', update, { passive: true });
    update();
    return () => {
      observer.disconnect();
      body.removeEventListener('scroll', update);
    };
  }, []);

  const submitFlag = async () => {
    if (!isAuthenticated || !flag.trim() || submittingRef.current) return;
    submittingRef.current = true;
    setSubmission({ state: 'submitting' });
    try {
      const response = await fetch(`/api/challenges/${encodeURIComponent(challenge.id)}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flag }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? '제출에 실패했습니다.');
      if (!payload.correct) {
        if (mountedRef.current) setSubmission({ state: 'wrong', message: '오답입니다' });
        return;
      }
      // Closing the dialog does not undo a flag the server has already accepted.
      onSolved(challenge.id, { solves: payload.solves, points: payload.points });
      if (mountedRef.current) setSubmission(payload.alreadySolved
        ? { state: 'duplicate', message: '이미 해결했습니다' }
        : { state: 'correct', message: '정답입니다' });
    } catch (error) {
      if (mountedRef.current) setSubmission({ state: 'error', message: error instanceof Error ? error.message : '제출에 실패했습니다.' });
    } finally {
      submittingRef.current = false;
    }
  };

  return (
        <div className={`challenge-dialog-backdrop ${isClosing ? 'is-closing' : ''}`} role="presentation" onMouseDown={onClose}>
          <section
            ref={dialogRef}
            className={`challenge-dialog ${transitionChallengeId === challenge.id ? 'is-shared-transition' : ''}`}
            style={{ '--category-accent': accentColor, viewTransitionName: transitionChallengeId === challenge.id ? 'challenge-panel' : undefined } as React.CSSProperties}
            role="dialog"
            aria-modal="true"
            aria-labelledby="challenge-dialog-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <span className="card-beam dialog-beam" aria-hidden="true" />
            <header className="dialog-header">
              <div className="dialog-hero">
                <div className="dialog-title-group">
                  <h2 id="challenge-dialog-title">{challenge.title}</h2>
                  <p className="dialog-author"><span>Author</span> {challenge.author || '-'}</p>
                </div>
                <div className="dialog-header-actions">
                  <div className="dialog-value"><strong>{challenge.points}</strong><span>PTS</span></div>
                  <button className="dialog-close" type="button" onClick={onClose} aria-label="닫기">
                    <svg viewBox="0 0 18 18" aria-hidden="true"><path d="m4 4 10 10M14 4 4 14" /></svg>
                  </button>
                </div>
              </div>
            </header>
            <div className="dialog-description-area">
              <div ref={bodyRef} className="dialog-body" tabIndex={0} role="region" aria-label="문제 설명">
                <ChallengeDescription content={challenge.description || challenge.summary} />
              </div>
              {hasMoreDescription && (
                <div className="dialog-scroll-hint" aria-hidden="true">
                  아래로 스크롤하여 설명 계속 읽기
                  <svg viewBox="0 0 16 16" fill="none"><path d="m3 6 5 5 5-5" /></svg>
                </div>
              )}
            </div>
            <footer className="dialog-dock">
              {(fileUrl || connectionUrl || tcpCommand || challenge.usesVm || challenge.instanceSlug) && (
                <div className="dialog-resources">
                  {fileUrl && (
                    <a className="challenge-file" href={fileUrl} target="_blank" rel="noopener noreferrer" download>
                      <span className="file-icon" aria-hidden="true"><svg viewBox="0 0 18 18"><path d="M9 2v9m0 0 3.5-3.5M9 11 5.5 7.5M3 15h12" /></svg></span>
                      <span>{challenge.attachmentName || '문제 파일'}<small>첨부파일 다운로드</small></span>
                    </a>
                  )}
                  {!challenge.usesVm && connectionUrl && (
                    <a className="challenge-file challenge-access-link" href={connectionUrl} target="_blank" rel="noopener noreferrer">
                      <span className="file-icon" aria-hidden="true"><svg viewBox="0 0 18 18"><path d="m5 13 8-8M7 5h6v6" /></svg></span>
                      <span>URL<small>{challenge.connectionUrl}</small></span>
                    </a>
                  )}
                  {!challenge.usesVm && tcpCommand && (
                    <div className="challenge-file challenge-access-command">
                      <span className="file-icon is-terminal" aria-hidden="true">NC</span>
                      <span>NC<small><CopyCommand command={tcpCommand} /></small></span>
                    </div>
                  )}
                  {(challenge.usesVm || challenge.instanceSlug) && (challenge.instanceSlug
                    ? <InstanceControl key={challenge.id} challengeId={challenge.id} connectionType={challenge.connectionType ?? 'HTTP'} enabled />
                    : <div className="instance-control vm-pending"><strong>Instance 준비 중</strong><p>생성 방식이 연결되면 이곳에서 Instance를 시작할 수 있습니다.</p></div>)}
                </div>
              )}
              <form className="flag-form" onSubmit={(event) => { event.preventDefault(); void submitFlag(); }}>
                <div className="flag-form-head">
                  <label htmlFor="flag-input">플래그 제출</label>
                  {isAuthenticated && (
                    <span className={`flag-status-badge is-${submission.state}`} role="status">
                      {submission.message && <svg viewBox="0 0 16 16" aria-hidden="true">
                        {submission.state === 'correct'
                          ? <path d="m3 8.2 3.1 3.1L13 4.5" />
                          : submission.state === 'duplicate'
                            ? <><path d="M8 2.1 14 13H2L8 2.1Z" /><path d="M8 5.7v3.5M8 11.4v.1" /></>
                            : <path d="m4 4 8 8m0-8-8 8" />}
                      </svg>}
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
                    disabled={!isAuthenticated || submission.state === 'submitting'}
                    aria-invalid={submission.state === 'wrong' || submission.state === 'error'}
                  />
                  <button type="submit" disabled={!isAuthenticated || !flag.trim() || submission.state === 'submitting'}>{submission.state === 'submitting' ? '확인 중…' : isAuthenticated ? '제출' : '로그인 필요'}</button>
                </div>
                {!isAuthenticated && challenge && (
                  <p className="submission-message error" role="status">
                    플래그를 제출하려면 <a href={`/login?callbackUrl=${encodeURIComponent(`/ctf?category=${category}&challenge=${challenge.id}`)}`}>로그인해 주세요.</a>
                  </p>
                )}
              </form>
            </footer>
          </section>
        </div>
  );
}
