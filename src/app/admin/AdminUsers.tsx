'use client';

import { useState } from 'react';
import { useConfirmDialog } from '@/components/ConfirmDialog';
import SelectControl from '@/components/SelectControl';

type Role = 'USER' | 'ADMIN' | 'GHOST';
type User = { id: string; username: string; email: string; role: Role; teamMemberships: { team: { name: string } }[] };
type Team = { id: string; name: string; members: { user: { id: string; username: string } }[] };

const roleLabels: Record<Role, string> = { USER: 'Participant', ADMIN: 'Admin', GHOST: 'Ghost' };
const roleOptions = (Object.keys(roleLabels) as Role[]).map((role) => ({ value: role, label: roleLabels[role] }));

export default function AdminUsers({ users, teams, currentAdminId }: { users: User[]; teams: Team[]; currentAdminId: string }) {
  const [userList, setUserList] = useState(users);
  const [teamList, setTeamList] = useState(teams);
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
  }

  async function run(id: string, action: () => Promise<void>) {
    setPendingId(id);
    try { await action(); } catch (caught) { setError(caught instanceof Error ? caught.message : '요청에 실패했습니다.'); } finally { setPendingId(''); }
  }

  async function changeRole(user: User, role: Role) {
    if (role === user.role) return;
    const approved = await confirm({
      title: '사용자 역할 변경',
      description: `${user.username}의 역할을 ${roleLabels[user.role]}에서 ${roleLabels[role]}(으)로 변경합니다.`,
      confirmLabel: '역할 변경',
    });
    if (!approved) return;
    await run(user.id, async () => {
      await request('/api/admin/users', 'PATCH', { id: user.id, role });
      setUserList((current) => current.map((item) => item.id === user.id ? { ...item, role } : item));
    });
  }

  return (
    <section className="admin-panel participant-admin-panel">
      <div className="admin-panel-heading">
        <div><h3>사용자</h3><p>참가 권한을 지정하거나 계정을 삭제합니다.</p></div>
        <span className="admin-list-count">{userList.length}명</span>
      </div>
      {error && <p className="admin-notice error" role="alert">{error}</p>}
      <div className="participant-list" role="list">
        {userList.map((user) => (
          <article key={user.id} role="listitem">
            <div className="participant-identity">
              <strong>{user.username}{user.id === currentAdminId && <span>나</span>}</strong>
              <small>{user.email}</small>
              <small>{user.teamMemberships[0]?.team.name ?? '소속 팀 없음'}</small>
            </div>
            <div className="participant-actions">
              <div className={`participant-role is-${user.role.toLowerCase()}`}>
                <SelectControl
                  ariaLabel={`${user.username} 역할`}
                  value={user.role}
                  options={roleOptions}
                  disabled={pendingId === user.id || user.id === currentAdminId}
                  onChange={(role) => void changeRole(user, role)}
                />
              </div>
              <button
                type="button"
                className="participant-delete"
                disabled={pendingId === user.id || user.id === currentAdminId}
                onClick={() => void run(user.id, async () => {
                  if (await confirm({ title: '사용자 삭제', description: `${user.username} 계정과 풀이 기록을 삭제합니다.`, confirmLabel: '삭제', danger: true })) {
                    await request(`/api/admin/users?id=${encodeURIComponent(user.id)}`, 'DELETE');
                    setUserList((current) => current.filter((item) => item.id !== user.id));
                  }
                })}
              >
                삭제
              </button>
            </div>
          </article>
        ))}
      </div>

      <div className="admin-panel-heading participant-team-heading">
        <div><h3>팀</h3><p>팀 구성원을 확인하거나 팀을 삭제합니다.</p></div>
        <span className="admin-list-count">{teamList.length}팀</span>
      </div>
      <div className="participant-list" role="list">
        {teamList.length === 0 && <p className="admin-empty-state">등록된 팀이 없습니다.</p>}
        {teamList.map((team) => (
          <article key={team.id} role="listitem">
            <div className="participant-identity">
              <strong>{team.name}</strong>
              <small>{team.members.length ? team.members.map((member) => member.user.username).join(', ') : '팀원 없음'}</small>
            </div>
            <div className="participant-actions">
              <button
                type="button"
                className="participant-delete"
                disabled={pendingId === team.id}
                onClick={() => void run(team.id, async () => {
                  if (await confirm({ title: '팀 삭제', description: `${team.name} 팀과 팀 풀이 기록을 삭제합니다.`, confirmLabel: '삭제', danger: true })) {
                    await request(`/api/admin/teams?id=${encodeURIComponent(team.id)}`, 'DELETE');
                    setTeamList((current) => current.filter((item) => item.id !== team.id));
                  }
                })}
              >
                삭제
              </button>
            </div>
          </article>
        ))}
      </div>
      {confirmation}
    </section>
  );
}
