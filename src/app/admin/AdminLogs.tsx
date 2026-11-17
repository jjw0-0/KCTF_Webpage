'use client';

import { useEffect, useMemo, useState } from 'react';
import type { AdminLogsPayload } from '@/lib/admin-logs';

type AdminLogsProps = {
  initialLogs: AdminLogsPayload;
  active: boolean;
  onError: (message: string) => void;
};

export default function AdminLogs({ initialLogs, active, onError }: AdminLogsProps) {
  const [logs, setLogs] = useState<AdminLogsPayload>(initialLogs);
  const [logTab, setLogTab] = useState<'server' | 'submissions' | 'instances'>('server');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [submissionResultFilter, setSubmissionResultFilter] = useState<'ALL' | 'CORRECT' | 'WRONG'>('ALL');
  const [logSearch, setLogSearch] = useState('');
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const refreshLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const response = await fetch('/api/admin/logs');
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? '로그를 불러오지 못했습니다.');
      setLogs(payload);
    } catch (error) {
      onError(error instanceof Error ? error.message : '로그를 불러오지 못했습니다.');
    } finally {
      setIsLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (active) {
      void (async () => {
        try {
          const ipRes = await fetch('https://api4.ipify.org?format=json');
          if (ipRes.ok) {
            const data = (await ipRes.json()) as { ip?: string };
            if (data?.ip) {
              await fetch('/api/client-ip', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ipv4: data.ip }),
              });
            }
          }
        } catch {
          // Ignore external IP lookup failure
        }
        await refreshLogs();
      })();
    }
  // Only activation changes should trigger the automatic external-IP/log refresh.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const logTimestampFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }),
    [],
  );

  const filteredServerLogs = useMemo(() => {
    const query = logSearch.trim().toLowerCase();
    return logs.serverLogs.filter((entry) => {
      if (!query) return true;
      return (
        (entry.ip && entry.ip.toLowerCase().includes(query)) ||
        (entry.actor && entry.actor.toLowerCase().includes(query)) ||
        (entry.method && entry.method.toLowerCase().includes(query)) ||
        (entry.path && entry.path.toLowerCase().includes(query)) ||
        (entry.userAgent && entry.userAgent.toLowerCase().includes(query)) ||
        entry.message.toLowerCase().includes(query)
      );
    });
  }, [logs.serverLogs, logSearch]);

  const filteredSubmissionLogs = useMemo(() => {
    const query = logSearch.trim().toLowerCase();
    return logs.submissionLogs.filter((entry) => {
      if (submissionResultFilter === 'CORRECT' && !entry.isCorrect) return false;
      if (submissionResultFilter === 'WRONG' && entry.isCorrect) return false;
      if (!query) return true;
      return (
        entry.username.toLowerCase().includes(query) ||
        entry.email.toLowerCase().includes(query) ||
        entry.challengeTitle.toLowerCase().includes(query) ||
        entry.category.toLowerCase().includes(query) ||
        entry.flag.toLowerCase().includes(query)
        || entry.ownerKey.toLowerCase().includes(query)
        || entry.tokenPrefix?.toLowerCase().includes(query)
        || entry.ipAddress?.toLowerCase().includes(query)
      );
    });
  }, [logs.submissionLogs, submissionResultFilter, logSearch]);

  const filteredInstanceLogs = useMemo(() => {
    const query = logSearch.trim().toLowerCase();
    return logs.instanceLogs.filter((entry) => !query || [
      entry.challengeTitle,
      entry.owner,
      entry.ip,
      entry.method,
      entry.path,
      entry.userAgent,
      String(entry.port),
    ].some((value) => value?.toLowerCase().includes(query)));
  }, [logs.instanceLogs, logSearch]);

  if (!active) return null;

  return (
          <section className="admin-panel logs-admin-panel">
            <div className="admin-panel-heading logs-panel-heading">
              <div className="admin-log-tabs" role="tablist" aria-label="로그 종류">
                <button
                  type="button"
                  role="tab"
                  aria-selected={logTab === 'server'}
                  className={logTab === 'server' ? 'active' : ''}
                  onClick={() => setLogTab('server')}
                >
                  HTTP 로그 <span>{logs.serverLogs.length}</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={logTab === 'submissions'}
                  className={logTab === 'submissions' ? 'active' : ''}
                  onClick={() => setLogTab('submissions')}
                >
                  문제 제출 로그 <span>{logs.submissionLogs.length}</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={logTab === 'instances'}
                  className={logTab === 'instances' ? 'active' : ''}
                  onClick={() => setLogTab('instances')}
                >
                  문제 서버 로그 <span>{logs.instanceLogs.length}</span>
                </button>
              </div>

              <div className="admin-log-controls">
                {logTab === 'submissions' && (
                  <div className="admin-log-filters" role="group" aria-label="제출 결과 필터">
                    {([
                      ['ALL', '전체'],
                      ['CORRECT', '정답'],
                      ['WRONG', '오답'],
                    ] as const).map(([val, label]) => (
                      <button
                        key={val}
                        type="button"
                        aria-pressed={submissionResultFilter === val}
                        className={submissionResultFilter === val ? 'active' : ''}
                        onClick={() => setSubmissionResultFilter(val)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}

                <input
                  type="search"
                  className="admin-log-search"
                  placeholder={logTab === 'server' ? 'IP·USER·경로·UA 검색…' : logTab === 'submissions' ? '닉네임·문제·플래그 검색…' : '문제·사용자·포트·IP·UA 검색…'}
                  value={logSearch}
                  onChange={(event) => setLogSearch(event.target.value)}
                  aria-label="로그 검색"
                />

                <button
                  type="button"
                  className="button button-ghost"
                  disabled={isLoadingLogs}
                  onClick={() => void refreshLogs()}
                >
                  {isLoadingLogs ? '불러오는 중…' : '새로고침'}
                </button>
              </div>
            </div>

            {logTab === 'server' ? (
              <div className="admin-server-log-list" role="region" aria-label="HTTP 로그 목록">
                <div className="admin-server-log-head">
                  <span>시각</span>
                  <span>IP</span>
                  <span>USER</span>
                  <span>STATUS</span>
                  <span>METHOD</span>
                  <span>요청</span>
                  <span>UA (클릭 시 전체 펼침)</span>
                </div>
                {filteredServerLogs.length ? (
                  filteredServerLogs.map((entry) => {
                    const statusCode = entry.statusCode ?? 200;
                    const statusTone =
                      statusCode >= 400 ? 'is-error' : statusCode >= 300 ? 'is-redirect' : 'is-ok';
                    const method = entry.method ?? 'GET';
                    const path = entry.path ?? '/';
                    const isExpanded = expandedLogId === entry.id;
                    return (
                      <div
                        key={entry.id}
                        role="button"
                        tabIndex={0}
                        aria-expanded={isExpanded}
                        className={isExpanded ? 'admin-server-log-row is-expanded' : 'admin-server-log-row'}
                        onClick={() => setExpandedLogId(isExpanded ? null : entry.id)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            setExpandedLogId(isExpanded ? null : entry.id);
                          }
                        }}
                      >
                        <time dateTime={entry.timestamp}>{logTimestampFormatter.format(new Date(entry.timestamp))}</time>
                        <span className="log-ip-inline">{entry.ip || '127.0.0.1'}</span>
                        <span className="log-actor-inline">{entry.actor || 'anonymous'}</span>
                        <span className={`log-status-inline ${statusTone}`}>{statusCode}</span>
                        <span className="log-method-inline">{method}</span>
                        <code className="log-line-text">{path}</code>
                        <span className="log-ua-inline">{entry.userAgent || '-'}</span>
                        {isExpanded && (
                          <div className="log-expanded-detail" onClick={(event) => event.stopPropagation()}>
                            <div><strong>STATUS</strong><code>{statusCode}</code></div>
                            <div><strong>METHOD</strong><code>{method}</code></div>
                            <div><strong>요청</strong><code>{path}</code></div>
                            <div><strong>UA</strong><code>{entry.userAgent || '-'}</code></div>
                            {entry.params && Object.keys(entry.params).length > 0 && (
                              <div><strong>파라미터</strong><code>{JSON.stringify(entry.params)}</code></div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="admin-log-empty">조건에 맞는 HTTP 로그가 없습니다.</div>
                )}
              </div>
            ) : logTab === 'submissions' ? (
              <div className="admin-submission-log-list" role="region" aria-label="문제 제출 로그 목록">
                <div className="admin-submission-log-head">
                  <span>시각</span>
                  <span>결과</span>
                  <span>참가자</span>
                  <span>문제</span>
                  <span>제출 플래그</span>
                </div>
                {filteredSubmissionLogs.length ? (
                  filteredSubmissionLogs.map((entry) => (
                    <div key={entry.id} className="admin-submission-log-row">
                      <time dateTime={entry.submittedAt}>{logTimestampFormatter.format(new Date(entry.submittedAt))}</time>
                      <span className={entry.isCorrect ? 'log-badge is-correct' : 'log-badge is-wrong'}>
                        {entry.isCorrect ? 'CORRECT' : 'WRONG'}
                      </span>
                      <div className="log-user">
                        <strong>{entry.username}</strong>
                        <small>{entry.email} · {entry.ownerKey} · {entry.tokenPrefix ?? '-'} · {entry.ipAddress ?? '-'}</small>
                      </div>
                      <div className="log-challenge">
                        <span>{entry.category}</span>
                        <strong>{entry.challengeTitle}</strong>
                      </div>
                      <code className="log-submitted-flag">{entry.flag}</code>
                    </div>
                  ))
                ) : (
                  <div className="admin-log-empty">조건에 맞는 문제 제출 로그가 없습니다.</div>
                )}
              </div>
            ) : (
              <div className="admin-server-log-list" role="region" aria-label="문제 서버 로그 목록">
                <div className="admin-server-log-head">
                  <span>시각</span><span>IP</span><span>USER</span><span>STATUS</span><span>METHOD</span><span>문제 / 요청</span><span>UA</span>
                </div>
                {filteredInstanceLogs.length ? filteredInstanceLogs.map((entry) => {
                  const isExpanded = expandedLogId === entry.id;
                  const method = entry.method ?? entry.protocol.toUpperCase();
                  const path = entry.path ?? '';
                  const statusTone = entry.status >= 400 ? 'is-error' : entry.status >= 300 ? 'is-redirect' : 'is-ok';
                  return (
                    <div
                      key={entry.id}
                      role="button"
                      tabIndex={0}
                      aria-expanded={isExpanded}
                      className={isExpanded ? 'admin-server-log-row is-expanded' : 'admin-server-log-row'}
                      onClick={() => setExpandedLogId(isExpanded ? null : entry.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setExpandedLogId(isExpanded ? null : entry.id);
                        }
                      }}
                    >
                      <time dateTime={entry.timestamp}>{logTimestampFormatter.format(new Date(entry.timestamp))}</time>
                      <span className="log-ip-inline">{entry.ip}</span>
                      <span className="log-actor-inline">{entry.owner}</span>
                      <span className={`log-status-inline ${statusTone}`}>{entry.status}</span>
                      <span className="log-method-inline">{method}</span>
                      <code className="log-line-text">[{entry.challengeTitle}:{entry.port}] {path}</code>
                      <span className="log-ua-inline">{entry.userAgent || '-'}</span>
                      {isExpanded && (
                        <div className="log-expanded-detail" onClick={(event) => event.stopPropagation()}>
                          <div><strong>문제</strong><code>{entry.challengeTitle} · {entry.protocol.toUpperCase()} {entry.port}</code></div>
                          <div><strong>METHOD</strong><code>{method}</code></div>
                          <div><strong>요청</strong><code>{path || '-'}</code></div>
                          <div><strong>UA</strong><code>{entry.userAgent || '-'}</code></div>
                          <div><strong>소요 시간</strong><code>{entry.durationMs ?? 0}ms</code></div>
                          {entry.params && Object.keys(entry.params).length > 0 && <div><strong>파라미터</strong><code>{JSON.stringify(entry.params)}</code></div>}
                        </div>
                      )}
                    </div>
                  );
                }) : <div className="admin-log-empty">조건에 맞는 문제 서버 로그가 없습니다.</div>}
              </div>
            )}
          </section>
  );
}
