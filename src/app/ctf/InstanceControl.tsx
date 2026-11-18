'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getTcpCommand } from '@/lib/challenge-media';

type Instance = { challengeId: string; url: string; accessToken: string; expiresAt: string };

export default function InstanceControl({ challengeId, connectionType, enabled }: { challengeId: string; connectionType: 'HTTP' | 'TCP'; enabled: boolean }) {
  const [instance, setInstance] = useState<Instance | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(enabled);
  const [requiresLogin, setRequiresLogin] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');

  useEffect(() => {
    if (!enabled) return;
    fetch('/api/instances').then(async (response) => {
      if (response.status === 401) {
        setRequiresLogin(true);
        return;
      }
      const payload = await response.json();
      if (response.ok) setInstance(payload.instance);
    }).catch(() => setMessage('Instance 상태를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'))
      .finally(() => setLoading(false));
  }, [enabled]);

  if (!enabled) return null;

  const create = async () => {
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch('/api/instances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeId }),
      });
      const payload = await response.json();
      if (response.status === 401) {
        setRequiresLogin(true);
        return;
      }
      if (!response.ok) throw new Error(payload.error ?? 'Instance 생성에 실패했습니다.');
      setInstance(payload.instance);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Instance 생성에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const destroy = async () => {
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch('/api/instances', { method: 'DELETE' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Instance 종료에 실패했습니다.');
      setInstance(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Instance 종료에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const isCurrent = instance?.challengeId === challengeId;
  const tcpCommand = isCurrent && connectionType === 'TCP' ? getTcpCommand(instance.url) : undefined;
  const authenticatedTcpCommand = tcpCommand && instance ? `(printf 'KCTF_TOKEN ${instance.accessToken}\\n'; cat) | ${tcpCommand}` : undefined;
  const instanceUrl = instance?.url.split('?')[0];
  const copyValue = authenticatedTcpCommand ?? instanceUrl;

  const copyAddress = async () => {
    if (!copyValue) return;
    try {
      await navigator.clipboard.writeText(copyValue);
      setCopyStatus('복사됨');
    } catch {
      setCopyStatus('복사 실패');
    }
  };

  return (
    <section className={`instance-control ${isCurrent ? 'is-ready' : ''}`} aria-label="Challenge Instance">
      <div className="instance-summary">
        <strong>Instance</strong>
        <small>{isCurrent ? `${new Date(instance.expiresAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}까지` : '1시간 동안 유지됩니다'}</small>
      </div>
      <div className="instance-actions">
        {requiresLogin ? (
          <Link className="instance-primary" href="/login?callbackUrl=/challenges">로그인 후 생성</Link>
        ) : isCurrent ? (
          <>
            <div className="instance-address">
              <code title={copyValue}>{authenticatedTcpCommand ?? instanceUrl}</code>
              <button type="button" onClick={() => void copyAddress()} aria-label={authenticatedTcpCommand ? 'Instance 명령어 복사' : 'Instance 주소 복사'}>
                <svg viewBox="0 0 18 18" aria-hidden="true"><rect x="6" y="6" width="8" height="8" rx="1" /><path d="M4 11H3.5A1.5 1.5 0 0 1 2 9.5v-6A1.5 1.5 0 0 1 3.5 2h6A1.5 1.5 0 0 1 11 3.5V4" /></svg>
                <span>{copyStatus || '복사'}</span>
              </button>
            </div>
            {!authenticatedTcpCommand && instanceUrl && (
              <a className="instance-primary" href={instanceUrl} target="_blank" rel="noopener noreferrer">
                열기
                <svg viewBox="0 0 18 18" aria-hidden="true"><path d="M7 4h7v7M14 4 7 11" /><path d="M12 10v4H4V6h4" /></svg>
              </a>
            )}
            <button className="instance-stop" type="button" onClick={() => void destroy()} disabled={loading}>종료</button>
          </>
        ) : (
          <button className="instance-primary" type="button" onClick={() => void create()} disabled={loading}>
            {loading ? '준비 중…' : instance ? '이 문제로 교체' : 'Instance 생성'}
          </button>
        )}
      </div>
      <div className="instance-feedback" aria-live="polite">
        {message && <p role="alert">{message}</p>}
        {!message && copyStatus && <span>{copyStatus === '복사됨' ? '클립보드에 복사했습니다.' : '복사하지 못했습니다. 주소를 직접 선택해 주세요.'}</span>}
      </div>
    </section>
  );
}

