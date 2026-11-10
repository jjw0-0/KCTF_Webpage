'use client';

import { useState } from 'react';
import { useConfirmDialog } from '@/components/ConfirmDialog';

type Role = 'USER' | 'ADMIN' | 'GHOST';
type User = { id: string; username: string; email: string; role: Role; teamMemberships: { team: { name: string } }[] };
type Team = { id: string; name: string; members: { user: { id: string; username: string } }[] };

const roleLabels: Record<Role, string> = { USER: 'Participant', ADMIN: 'Admin', GHOST: 'Ghost' };

export default function AdminUsers({ users, teams, currentAdminId }: { users: User[]; teams: Team[]; currentAdminId: string }) {
  const [error, setError] = useState('');
  const [pendingId, setPendingId] = useState('');
  const { confirm, confirmation } = useConfirmDialog();

  async function request(url: string, method: string, body?: object) {
    setError('');
    const response = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error ?? '요청에 실패했습니다.');
    window.location.reload();
  }

  async function run(id: string, action: () => Promise<void>) {
    setPendingId(id);
    try { await action(); } catch (caught) { setError(caught instanceof Error ? caught.message : '요청에 실패했습니다.'); } finally { setPendingId(''); }
  }

  return (
    <section className="admin-panel participant-admin-panel">
      <div className="admin-panel-heading">
        <div><h3>사용자</h3><p>참가 권한을 지정하거나 계정을 삭제합니다.</p></div>
        <span className="admin-list-count">{users.length}명</span>
      </div>
      {error && <p className="admin-notice error" role="alert">{error}</p>}
      <div className="participant-list" role="list">
        {users.map((user) => (
          <article key={user.id} role="listitem">
            <div className="participant-identity">
              <strong>{user.username}{user.id === currentAdminId && <span>나</span>}</strong>
              <small>{user.email}</small>
              <small>{user.teamMemberships[0]?.team.name ?? '소속 팀 없음'}</small>
            </div>
            <div className="participant-actions">
              <label>
                <span className="sr-only">{user.username} 역할</span>
                <select
                  value={user.role}
                  disabled={pendingId === user.id || user.id === currentAdminId}
                  onChange={(event) => void run(user.id, () => request('/api/admin/users', 'PATCH', { id: user.id, role: event.target.value }))}
                >
                  {(Object.keys(roleLabels) as Role[]).map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}
                </select>
              </label>
              <button
                type="button"
                className="danger"
                disabled={pendingId === user.id || user.id === currentAdminId}
                onClick={() => void run(user.id, async () => {
                  if (await confirm({ title: '사용자 삭제', description: `${user.username} 계정과 풀이 기록을 삭제합니다.`, confirmLabel: '삭제', danger: true })) {
                    await request(`/api/admin/users?id=${encodeURIComponent(user.id)}`, 'DELETE');
                  }
                })}
              >삭제</button>
            </div>
          </article>
        ))}
      </div>

      <div className="admin-panel-heading participant-team-heading">
        <div><h3>팀</h3><p>팀 구성원을 확인하거나 팀을 삭제합니다.</p></div>
        <span className="admin-list-count">{teams.length}팀</span>
      </div>
      <div className="participant-list" role="list">
        {teams.length === 0 && <p className="admin-empty-state">등록된 팀이 없습니다.</p>}
        {teams.map((team) => (
          <article key={team.id} role="listitem">
            <div className="participant-identity">
              <strong>{team.name}</strong>
              <small>{team.members.length ? team.members.map((member) => member.user.username).join(', ') : '팀원 없음'}</small>
            </div>
            <div className="participant-actions">
              <button
                type="button"
                className="danger"
                disabled={pendingId === team.id}
                onClick={() => void run(team.id, async () => {
                  if (await confirm({ title: '팀 삭제', description: `${team.name} 팀과 팀 풀이 기록을 삭제합니다.`, confirmLabel: '삭제', danger: true })) {
                    await request(`/api/admin/teams?id=${encodeURIComponent(team.id)}`, 'DELETE');
                  }
                })}
              >삭제</button>
            </div>
          </article>
        ))}
      </div>
      {confirmation}
    </section>
  );
}
