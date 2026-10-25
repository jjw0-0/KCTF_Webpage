'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Instance = { challengeId: string; url: string; expiresAt: string };

export default function InstanceControl({ challengeId, enabled }: { challengeId: string; enabled: boolean }) {
  const [instance, setInstance] = useState<Instance | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(enabled);
  const [requiresLogin, setRequiresLogin] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    fetch('/api/instances').then(async (response) => {
      if (response.status === 401) {
        setRequiresLogin(true);
        return;
      }
      const payload = await response.json();
      if (response.ok) setInstance(payload.instance);
    }).catch(() => setMessage('VM 상태를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'))
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
      if (!response.ok) throw new Error(payload.error ?? 'VM 발급에 실패했습니다.');
      setInstance(payload.instance);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'VM 발급에 실패했습니다.');
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
      if (!response.ok) throw new Error(payload.error ?? 'VM 종료에 실패했습니다.');
      setInstance(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'VM 종료에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const isCurrent = instance?.challengeId === challengeId;

  return (
    <section className="instance-control" aria-label="Challenge VM">
      <div>
        <span>ISOLATED VM</span>
        <small>{isCurrent ? `~ ${new Date(instance.expiresAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}` : '1 HOUR TTL'}</small>
      </div>
      {requiresLogin ? (
        <Link href={`/login?callbackUrl=/ctf`}>로그인 후 발급</Link>
      ) : isCurrent ? (
        <div className="instance-actions">
          <a href={instance.url} target="_blank" rel="noreferrer">OPEN VM ↗</a>
          <button type="button" onClick={() => void destroy()} disabled={loading}>종료</button>
        </div>
      ) : (
        <button type="button" onClick={() => void create()} disabled={loading}>
          {loading ? '준비 중…' : instance ? '현재 VM 교체' : 'VM 생성'}
        </button>
      )}
      {message && <p role="alert">{message}</p>}
    </section>
  );
}

