'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import type { AdminLogsPayload } from '@/lib/admin-logs';
import AdminLogs from './AdminLogs';
import { AdminChallenge } from '@/lib/challenges';
import { Category } from '@/lib/platform-data';
import ChallengeDescription from '@/components/ChallengeDescription';
import { useConfirmDialog } from '@/components/ConfirmDialog';
import SelectControl from '@/components/SelectControl';
import type { CtfSchedule } from '@/lib/ctf-schedule';
import AdminUsers from './AdminUsers';

type NavItem = 'event' | 'users' | 'categories' | 'challenges' | 'logs';
type Users = Awaited<ReturnType<typeof import('@/lib/admin-users').getAdminUsers>>;
type ChallengeForm = {
  title: string;
  description: string;
  author: string;
  categoryId: string;
  points: string;
  scoringMode: AdminChallenge['scoringMode'];
  minimumPoints: string;
  decaySolves: string;
  decrementPerSolve: string;
  flag: string;
  dynamicFlag: boolean;
  usesVm: boolean;
  usesCompose: boolean;
  instancePort: string;
  connectionType: AdminChallenge['connectionType'];
  connectionUrl: string;
};

const navItems: { id: NavItem; label: string }[] = [
  { id: 'event', label: 'CTF 관리' },
  { id: 'users', label: '사용자 관리' },
  { id: 'categories', label: '카테고리 관리' },
  { id: 'challenges', label: '문제 관리' },
  { id: 'logs', label: '로그' },
];

function emptyChallenge(categoryId = ''): ChallengeForm {
  return {
    title: '',
    description: '',
    author: '',
    categoryId,
    points: '100',
    scoringMode: 'STATIC',
    minimumPoints: '50',
    decaySolves: '20',
    decrementPerSolve: '10',
    flag: '',
    dynamicFlag: false,
    usesVm: false,
    usesCompose: false,
    instancePort: '',
    connectionType: 'HTTP',
    connectionUrl: '',
  };
}

const headings: Record<NavItem, [string, string]> = {
  event: ['대회 일정', '참가자 화면과 문제 제출에 적용되는 운영 시간을 설정합니다.'],
  users: ['사용자 관리', '참가자 역할과 사용자·팀 목록을 관리합니다.'],
  categories: ['카테고리 관리', '문제 목록의 분류와 노출 순서를 관리합니다.'],
  challenges: ['문제 관리', '문제 내용, 접속 방식, 플래그와 첨부파일을 관리합니다.'],
  logs: ['로그', 'HTTP 요청, 플래그 제출, 문제 서버 요청을 확인합니다.'],
};

const statusOptions: { value: CtfSchedule['status']; label: string }[] = [
  { value: 'DRAFT', label: '초안' },
  { value: 'SCHEDULED', label: '예약' },
  { value: 'ONGOING', label: '진행 중' },
  { value: 'PAUSED', label: '일시 중지' },
  { value: 'ENDED', label: '종료' },
];
const modeOptions: { value: CtfSchedule['mode']; label: string }[] = [
  { value: 'INDIVIDUAL', label: '개인전' },
  { value: 'TEAM', label: '팀전' },
];

const deploymentStatusCopy: Record<AdminChallenge['deploymentStatus'], { label: string; tone: string }> = {
  NONE: { label: '빌드 전', tone: 'is-idle' },
  QUEUED: { label: '빌드 대기', tone: 'is-pending' },
  BUILDING: { label: '빌드 중', tone: 'is-pending' },
  READY: { label: '빌드 성공', tone: 'is-success' },
  FAILED: { label: '빌드 실패', tone: 'is-failed' },
};

export default function AdminDashboard({
  initialCategories,
  initialChallenges,
  initialSchedule,
  initialLogs,
  initialUsers,
  currentAdminId,
}: {
  initialCategories: Category[];
  initialChallenges: AdminChallenge[];
  initialSchedule: CtfSchedule;
  initialLogs: AdminLogsPayload;
  initialUsers: Users;
  currentAdminId: string;
}) {
  const [categories, setCategories] = useState(initialCategories);
  const [challenges, setChallenges] = useState(initialChallenges);
  const [activeNav, setActiveNav] = useState<NavItem>('challenges');
  const [newCategory, setNewCategory] = useState('');
  const [notice, setNoticeMessage] = useState('');
  const [noticeTone, setNoticeTone] = useState<'neutral' | 'error'>('neutral');
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isChallengeEditorOpen, setIsChallengeEditorOpen] = useState(false);
  const [editingChallengeId, setEditingChallengeId] = useState<string | null>(null);
  const [challengeForm, setChallengeForm] = useState<ChallengeForm>(() => emptyChallenge(initialCategories[0]?.id));
  const [challengeFile, setChallengeFile] = useState<File | null>(null);
  const [deploymentFile, setDeploymentFile] = useState<File | null>(null);
  const [schedule, setSchedule] = useState(initialSchedule);
  const { confirm, confirmation } = useConfirmDialog();
  const challengeEditorRef = useRef<HTMLElement>(null);

  const setNotice = (message: string, tone: 'neutral' | 'error' = 'neutral') => {
    setNoticeMessage(message);
    setNoticeTone(tone);
  };

  const challengeCountByCategory = useMemo(() => new Map(categories.map((category) => [
    category.slug,
    challenges.filter((challenge) => challenge.categoryId === category.id).length,
  ])), [categories, challenges]);
  const editingChallenge = challenges.find((challenge) => challenge.id === editingChallengeId);

  useEffect(() => {
    const warnAboutUnsavedChanges = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warnAboutUnsavedChanges);
    return () => window.removeEventListener('beforeunload', warnAboutUnsavedChanges);
  }, [isDirty]);

  const patchCategory = (id: string, patch: Partial<Category>) => {
    setCategories(categories.map((category) => category.id === id ? { ...category, ...patch } : category));
    setIsDirty(true);
    setNotice('저장되지 않은 변경사항이 있습니다.');
  };

  const moveCategory = (id: string, direction: -1 | 1) => {
    const index = categories.findIndex((category) => category.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= categories.length) return;
    const reordered = [...categories];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setCategories(reordered.map((category, order) => ({ ...category, order: order + 1 })));
    setIsDirty(true);
    setNotice('노출 순서가 변경되었습니다. 저장을 눌러 반영하세요.');
  };

  const addCategory = async () => {
    if (!newCategory.trim()) return;
    if (isDirty) {
      setNotice('카테고리 편집 내용을 먼저 저장한 뒤 새 카테고리를 추가해 주세요.');
      return;
    }
    setIsSaving(true);
    try {
      const response = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCategory }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? '카테고리를 추가하지 못했습니다.');
      setCategories(payload.categories);
      setNewCategory('');
      setIsDirty(false);
      setNotice('새 카테고리가 참가자 화면에 반영되었습니다.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '카테고리를 추가하지 못했습니다.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteCategory = async (category: Category) => {
    if (isDirty) {
      setNotice('카테고리 편집 내용을 먼저 저장한 뒤 삭제해 주세요.');
      return;
    }
    if ((challengeCountByCategory.get(category.slug) ?? 0) > 0) {
      setNotice('문제가 연결된 카테고리는 삭제할 수 없습니다. 먼저 문제를 이동해 주세요.');
      return;
    }
    if (!(await confirm({ title: '카테고리 삭제', description: `“${category.name}” 카테고리를 삭제합니다. 이 작업은 되돌릴 수 없습니다.`, confirmLabel: '카테고리 삭제', danger: true }))) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/categories/${encodeURIComponent(category.id)}`, { method: 'DELETE' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? '카테고리를 삭제하지 못했습니다.');
      setCategories(payload.categories);
      setIsDirty(false);
      setNotice('카테고리가 삭제되었습니다.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '카테고리를 삭제하지 못했습니다.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const saveCategories = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/categories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categories }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? '변경사항을 저장하지 못했습니다.');
      setCategories(payload.categories);
      setIsDirty(false);
      setNotice('변경사항이 모든 참가자 화면에 반영되었습니다.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '변경사항을 저장하지 못했습니다.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const resetCategories = async () => {
    if (isDirty) {
      setNotice('카테고리 편집 내용을 먼저 저장하거나 페이지를 새로고침해 취소해 주세요.');
      return;
    }
    if (!(await confirm({ title: '카테고리 기본값 복원', description: '카테고리 이름, 공개 상태와 순서를 초기 구성으로 되돌립니다.', confirmLabel: '기본값 복원' }))) return;
    setIsSaving(true);
    try {
      const response = await fetch('/api/categories/reset', { method: 'POST' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? '기본 구성을 복원하지 못했습니다.');
      setCategories(payload.categories);
      setIsDirty(false);
      setNotice('기본 구성을 복원하고 참가자 화면에 반영했습니다.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '기본 구성을 복원하지 못했습니다.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const editChallenge = (challenge: AdminChallenge) => {
    setIsChallengeEditorOpen(true);
    setEditingChallengeId(challenge.id);
    setChallengeForm({
      title: challenge.title,
      description: challenge.description,
      author: challenge.author,
      categoryId: challenge.categoryId,
      points: String(challenge.points),
      scoringMode: challenge.scoringMode,
      minimumPoints: String(challenge.minimumPoints),
      decaySolves: String(challenge.decaySolves),
      decrementPerSolve: String(challenge.decrementPerSolve),
      flag: challenge.flag,
      dynamicFlag: challenge.dynamicFlag,
      usesVm: challenge.usesVm,
      usesCompose: challenge.usesCompose,
      instancePort: challenge.instancePort ? String(challenge.instancePort) : '',
      connectionType: challenge.connectionType,
      connectionUrl: challenge.connectionUrl,
    });
    setChallengeFile(null);
    setDeploymentFile(null);
    setNotice('');
    window.requestAnimationFrame(() => {
      challengeEditorRef.current?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'start',
      });
    });
  };

  const resetChallengeForm = () => {
    setIsChallengeEditorOpen(false);
    setEditingChallengeId(null);
    setChallengeForm(emptyChallenge(categories[0]?.id));
    setChallengeFile(null);
    setDeploymentFile(null);
  };

  const addChallenge = () => {
    resetChallengeForm();
    setNotice('');
    setIsChallengeEditorOpen(true);
    window.requestAnimationFrame(() => {
      challengeEditorRef.current?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'start',
      });
    });
  };

  const watchDeployment = async (challengeId: string) => {
    for (let attempt = 0; attempt < 150; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 2000));
      try {
        const response = await fetch(`/api/admin/challenges/${encodeURIComponent(challengeId)}/deployment`, { cache: 'no-store' });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? '배포 상태를 확인하지 못했습니다.');
        setChallenges(payload.challenges);
        if (payload.deployment?.status === 'READY') {
          setNotice('배포 이미지 빌드가 완료되었습니다.');
          return;
        }
        if (payload.deployment?.status === 'FAILED') {
          setNotice(payload.deployment.error ?? '배포 이미지 빌드에 실패했습니다.', 'error');
          return;
        }
      } catch (error) {
        setNotice(error instanceof Error ? error.message : '배포 상태를 확인하지 못했습니다.', 'error');
        return;
      }
    }
    setNotice('빌드가 계속 진행 중입니다. 잠시 후 문제 목록에서 상태를 확인해 주세요.');
  };

  const saveSchedule = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setNotice('일정을 저장하고 있습니다.');
    try {
      const response = await fetch('/api/admin/ctf', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: schedule.mode, status: schedule.status, startTime: schedule.startTime, endTime: schedule.endTime }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? '일정을 저장하지 못했습니다.');
      setSchedule(payload.schedule);
      setNotice('대회 일정을 저장했습니다.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '일정을 저장하지 못했습니다.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const saveChallenge = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!deploymentFile && !editingChallenge?.deploymentName) {
      setNotice('Deploy ZIP을 선택해 주세요.', 'error');
      return;
    }
    const instanceConfigurationChanged = Boolean(editingChallenge && challengeForm.usesVm && (
      !editingChallenge.usesVm
      || editingChallenge.usesCompose !== challengeForm.usesCompose
      || String(editingChallenge.instancePort ?? '') !== challengeForm.instancePort
      || editingChallenge.connectionType !== challengeForm.connectionType
    ));
    if (instanceConfigurationChanged && !deploymentFile) {
      setNotice('Instance 설정을 변경하려면 Deploy ZIP을 다시 선택해 주세요.', 'error');
      return;
    }
    setIsSaving(true);
    try {
      const current = editingChallenge;
      const response = await fetch(editingChallengeId
        ? `/api/admin/challenges/${encodeURIComponent(editingChallengeId)}`
        : '/api/admin/challenges', {
        method: editingChallengeId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...challengeForm,
          points: Number(challengeForm.points),
          minimumPoints: Number(challengeForm.minimumPoints),
          decaySolves: Number(challengeForm.decaySolves),
          decrementPerSolve: Number(challengeForm.decrementPerSolve),
          instancePort: challengeForm.usesVm ? Number(challengeForm.instancePort) : undefined,
          summary: '',
          difficulty: current?.difficulty ?? 'INTERMEDIATE',
          tags: current?.tags ?? [],
          instanceSlug: current?.instanceSlug ?? '',
          fileUrl: current?.fileUrl ?? '',
          visible: current?.visible ?? true,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? '문제를 저장하지 못했습니다.');
      setChallenges(payload.challenges);
      if (challengeFile) {
        const upload = new FormData();
        upload.set('file', challengeFile);
        const fileResponse = await fetch(`/api/admin/challenges/${encodeURIComponent(payload.challengeId)}/file`, { method: 'POST', body: upload });
        const filePayload = await fileResponse.json();
        if (!fileResponse.ok) throw new Error(`문제는 저장됐지만 파일 업로드에 실패했습니다. ${filePayload.error ?? ''}`.trim());
        setChallenges(filePayload.challenges);
      }
      if (deploymentFile) {
        const deploymentUpload = new FormData();
        deploymentUpload.set('file', deploymentFile);
        const deploymentResponse = await fetch(`/api/admin/challenges/${encodeURIComponent(payload.challengeId)}/deployment`, { method: 'POST', body: deploymentUpload });
        const deploymentPayload = await deploymentResponse.json();
        if (!deploymentResponse.ok) throw new Error(`문제는 저장됐지만 배포 ZIP 등록에 실패했습니다. ${deploymentPayload.error ?? ''}`.trim());
        setChallenges(deploymentPayload.challenges);
        if (challengeForm.usesVm) {
          setNotice('Deploy ZIP을 등록했습니다. 이미지를 빌드하고 있습니다.');
          void watchDeployment(payload.challengeId);
        } else {
          setNotice(editingChallengeId ? '문제 변경사항과 Deploy ZIP을 저장했습니다.' : '새 문제와 Deploy ZIP을 저장했습니다.');
        }
      } else {
        setNotice(editingChallengeId ? '문제 변경사항을 반영했습니다.' : '새 문제를 생성했습니다.');
      }
      resetChallengeForm();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '문제를 저장하지 못했습니다.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteChallenge = async (challenge: AdminChallenge) => {
    if (!(await confirm({ title: '문제 영구 삭제', description: `“${challenge.title}”의 풀이·제출 기록과 실행 중인 Instance를 함께 정리합니다. 삭제 후 복구할 수 없습니다.`, confirmLabel: '문제 삭제', danger: true }))) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/admin/challenges/${encodeURIComponent(challenge.id)}`, { method: 'DELETE' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? '문제를 삭제하지 못했습니다.');
      setChallenges(payload.challenges);
      if (editingChallengeId === challenge.id) resetChallengeForm();
      setNotice('문제를 삭제했습니다.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '문제를 삭제하지 못했습니다.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const [heading, description] = headings[activeNav];


  return (
    <main className="admin-main">
      <aside className="admin-sidebar">
        <div><h1>KCTF</h1><p className="admin-scope">관리자 페이지</p></div>
        <nav aria-label="관리자 메뉴">
          {navItems.map((item) => (
            <button type="button" key={item.id} aria-pressed={activeNav === item.id} className={activeNav === item.id ? 'active' : ''} onClick={() => setActiveNav(item.id)}>
              {item.label}
            </button>
          ))}
        </nav>
        <div className="admin-system-state"><strong>KCTF 2026</strong><small>운영 화면</small></div>
      </aside>

      <div className="admin-content">
        <header className="admin-heading">
          <div><p className="admin-path">관리자 / {navItems.find((item) => item.id === activeNav)?.label}</p><h2>{heading}</h2><p>{description}</p></div>
        </header>

        {activeNav === 'event' && (
          <section className="admin-panel event-admin-panel">
            <div className="admin-panel-heading">
              <div><h3>운영 시간</h3><p>표시와 자동 개방 기준은 한국 표준시(KST)입니다.</p></div>
            </div>
            <form className="event-admin-form" onSubmit={(event) => void saveSchedule(event)}>
              <div className="event-status-field form-field"><span>대회 방식</span>
                <SelectControl ariaLabel="대회 방식" value={schedule.mode} options={modeOptions} onChange={(mode) => setSchedule({ ...schedule, mode })} />
              </div>
              <div className="event-status-field form-field"><span>운영 상태</span>
                <SelectControl ariaLabel="운영 상태" value={schedule.status} options={statusOptions} onChange={(status) => setSchedule({ ...schedule, status })} />
              </div>
              <div className="event-time-range">
                <label>시작<input type="datetime-local" required value={schedule.startTime} onChange={(event) => setSchedule({ ...schedule, startTime: event.target.value })} /></label>
                <span aria-hidden="true" />
                <label>종료<input type="datetime-local" required value={schedule.endTime} onChange={(event) => setSchedule({ ...schedule, endTime: event.target.value })} /></label>
              </div>
              <div className="challenge-form-actions"><p className={`admin-notice ${noticeTone}`} aria-live="polite">{notice}</p><button className="button button-primary" disabled={isSaving}>{isSaving ? '저장 중…' : '일정 저장'}</button></div>
            </form>
          </section>
        )}

        {activeNav === 'categories' && (
          <section className="admin-panel">
            <div className="admin-panel-heading">
              <div><h3>카테고리</h3><p>표시 이름과 참가자 화면의 순서를 편집합니다.</p></div>
              <form onSubmit={(event) => { event.preventDefault(); void addCategory(); }} className="add-category-form">
                <label htmlFor="new-category" className="sr-only">새 카테고리명</label>
                <input id="new-category" name="newCategory" autoComplete="off" disabled={isSaving || isDirty} value={newCategory} onChange={(event) => setNewCategory(event.target.value)} placeholder={isDirty ? '변경사항을 먼저 저장하세요' : '카테고리 이름…'} />
                <button type="submit" disabled={isSaving || isDirty}>추가</button>
              </form>
            </div>
            <p className="table-scroll-hint">표를 좌우로 밀어 공개 설정과 작업을 확인하세요.</p>

            <div className="category-admin-table" role="table" aria-label="카테고리 관리">
              <div className="category-admin-row table-head" role="row"><span role="columnheader">순서</span><span role="columnheader">이름 / 주소</span><span role="columnheader">문제</span><span role="columnheader">공개</span><span role="columnheader">작업</span></div>
              {categories.map((category, index) => (
                <div className="category-admin-row" role="row" key={category.id}>
                  <div className="category-order" role="cell">
                    <strong>{String(index + 1).padStart(2, '0')}</strong>
                    <span><button type="button" onClick={() => moveCategory(category.id, -1)} disabled={index === 0} aria-label={`${category.name} 위로 이동`}>↑</button><button type="button" onClick={() => moveCategory(category.id, 1)} disabled={index === categories.length - 1} aria-label={`${category.name} 아래로 이동`}>↓</button></span>
                  </div>
                  <div className="category-edit-fields" role="cell"><input name={`category-${category.id}`} autoComplete="off" value={category.name} onChange={(event) => patchCategory(category.id, { name: event.target.value, shortName: event.target.value.slice(0, 8).toUpperCase() })} aria-label={`${category.name} 이름`} /><span>/{category.slug}</span></div>
                  <span className="category-count" role="cell">{challengeCountByCategory.get(category.slug) ?? 0}</span>
                  <div role="cell"><label className="visibility-toggle"><input type="checkbox" checked={category.visible} onChange={(event) => patchCategory(category.id, { visible: event.target.checked })} /><span aria-hidden="true" /><b>{category.visible ? '공개' : '숨김'}</b></label></div>
                  <div className="category-action-cell" role="cell"><button type="button" className="delete-category" onClick={() => void deleteCategory(category)} disabled={isSaving || isDirty}>삭제</button></div>
                </div>
              ))}
            </div>

            <div className="admin-panel-footer">
              <p className={`admin-notice ${noticeTone}`} aria-live="polite">{notice || (isDirty ? '저장되지 않은 변경사항이 있습니다.' : '변경사항 없음')}</p>
              <div className="admin-footer-actions"><button type="button" onClick={() => void resetCategories()} disabled={isSaving || isDirty}>기본값 복원</button><button type="button" className="button button-primary" onClick={() => void saveCategories()} disabled={!isDirty || isSaving}>{isSaving ? '저장 중…' : '변경사항 저장'}</button></div>
            </div>
          </section>
        )}

        {activeNav === 'users' && <AdminUsers users={initialUsers.users} teams={initialUsers.teams} currentAdminId={currentAdminId} />}

        {activeNav === 'challenges' && (
          <section ref={challengeEditorRef} className="admin-panel challenge-admin-panel">
            <div className="admin-panel-heading challenge-list-heading">
              <div><h3>문제 목록</h3><p>{challenges.length}개 문제</p></div>
              <button type="button" className="challenge-add-button" aria-expanded={isChallengeEditorOpen} aria-controls="challenge-editor" onClick={addChallenge}>
                <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3 8h10" /></svg>
                문제 추가하기
              </button>
            </div>
            {!isChallengeEditorOpen && notice && <p className={`challenge-list-notice ${noticeTone}`} aria-live="polite">{notice}</p>}

            {isChallengeEditorOpen && (
              <div id="challenge-editor" className="challenge-editor">
                <div className="challenge-editor-heading">
                  <div><h4>{editingChallengeId ? '문제 수정' : '문제 추가'}</h4><p>{editingChallengeId ? '문제 설정을 수정합니다.' : '새 문제의 설정을 입력합니다.'}</p></div>
                  <button type="button" className="challenge-editor-close" onClick={resetChallengeForm} aria-label={`${editingChallengeId ? '문제 수정' : '문제 추가'} 닫기`}>
                    <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 4 8 8m0-8-8 8" /></svg>
                  </button>
                </div>
                <form className="challenge-admin-form" onSubmit={(event) => void saveChallenge(event)}>
              <label>
                <span className="field-label-row"><strong>제목</strong></span>
                <input name="title" autoComplete="off" required maxLength={80} placeholder="문제 제목" value={challengeForm.title} onChange={(event) => setChallengeForm({ ...challengeForm, title: event.target.value })} />
              </label>
              <div className="form-field">
                <span className="field-label-row"><strong>카테고리</strong></span>
                <SelectControl ariaLabel="카테고리" value={challengeForm.categoryId} options={categories.map((category) => ({ value: category.id, label: category.name }))} onChange={(categoryId) => setChallengeForm({ ...challengeForm, categoryId })} />
              </div>
              <label>
                <span className="field-label-row"><strong>배점</strong></span>
                <input name="points" autoComplete="off" required type="number" min="1" max="10000" value={challengeForm.points} onChange={(event) => setChallengeForm({ ...challengeForm, points: event.target.value })} />
              </label>
              <label>
                <span className="field-label-row"><strong>출제자</strong></span>
                <input name="author" autoComplete="off" maxLength={80} placeholder="출제자 이름" value={challengeForm.author} onChange={(event) => setChallengeForm({ ...challengeForm, author: event.target.value })} />
              </label>

              <fieldset className="scoring-control wide">
                <div className="fieldset-header">
                  <legend>점수 방식</legend>
                </div>
                <div className="scoring-mode-options">
                  {([
                    ['STATIC', '고정'],
                    ['DYNAMIC', 'Dynamic'],
                    ['LINEAR', 'Logistic'],
                  ] as const).map(([value, label]) => (
                    <label key={value}>
                      <input type="radio" name="scoringMode" value={value} checked={challengeForm.scoringMode === value} onChange={() => setChallengeForm({ ...challengeForm, scoringMode: value })} />
                      <span><strong>{label}</strong></span>
                    </label>
                  ))}
                </div>
                {challengeForm.scoringMode !== 'STATIC' && (
                  <div className="scoring-parameters">
                    <label>최저 점수<input name="minimumPoints" required type="number" min="1" max="9999" value={challengeForm.minimumPoints} onChange={(event) => setChallengeForm({ ...challengeForm, minimumPoints: event.target.value })} /></label>
                    {challengeForm.scoringMode === 'DYNAMIC'
                      ? <label>최저점 도달 풀이 수<input name="decaySolves" required type="number" min="2" max="100000" value={challengeForm.decaySolves} onChange={(event) => setChallengeForm({ ...challengeForm, decaySolves: event.target.value })} /></label>
                      : <label>풀이당 감소 점수<input name="decrementPerSolve" required type="number" min="1" max="10000" value={challengeForm.decrementPerSolve} onChange={(event) => setChallengeForm({ ...challengeForm, decrementPerSolve: event.target.value })} /></label>}
                  </div>
                )}
              </fieldset>

              <fieldset className="challenge-access wide">
                <div className="fieldset-header">
                  <legend>접속 방식</legend>
                  <small>둘 다 설정하지 않으면 참가자에게 별도 접속 주소를 표시하지 않습니다.</small>
                </div>
                <div className="challenge-access-grid">
                  <div className="access-option-col">
                    <span className="access-sub-label">인스턴스 연동</span>
                    <label className={challengeForm.usesVm ? 'vm-choice is-checked' : 'vm-choice'}>
                      <input type="checkbox" checked={challengeForm.usesVm} onChange={(event) => setChallengeForm({ ...challengeForm, usesVm: event.target.checked, usesCompose: event.target.checked ? challengeForm.usesCompose : false, connectionUrl: event.target.checked ? '' : challengeForm.connectionUrl })} />
                      <span>
                        <strong>Instance 사용</strong>
                      </span>
                    </label>
                  </div>
                  <label className={challengeForm.usesVm ? 'direct-url is-disabled' : 'direct-url'}>
                    <span className="access-sub-label">주소로 접속</span>
                    <input
                      name="connectionUrl"
                      type="text"
                      inputMode={challengeForm.connectionType === 'HTTP' ? 'url' : 'text'}
                      autoComplete={challengeForm.connectionType === 'HTTP' ? 'url' : 'off'}
                      disabled={challengeForm.usesVm}
                      placeholder={challengeForm.connectionType === 'HTTP' ? 'https://challenge.example.com' : 'challenge.example.com:31337'}
                      value={challengeForm.connectionUrl}
                      onChange={(event) => setChallengeForm({ ...challengeForm, connectionUrl: event.target.value })}
                    />
                  </label>
                  <div className="access-type-col">
                    <span className="access-sub-label" id="connection-type-label">접속 유형</span>
                    <div className="connection-type-options" role="radiogroup" aria-labelledby="connection-type-label">
                      {([['HTTP', 'HTTP'], ['TCP', 'NC']] as const).map(([value, label]) => (
                        <label key={value}>
                          <input type="radio" name="connectionType" value={value} checked={challengeForm.connectionType === value} onChange={() => setChallengeForm({ ...challengeForm, connectionType: value })} />
                          <span><strong>{label}</strong></span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </fieldset>

              <div className="challenge-file-grid wide">
                <label className="admin-file-field">
                  <span className="field-label-row">
                    <strong>Public ZIP</strong>
                    <small>선택 사항 · 최대 10MB</small>
                  </span>
                  <span className="file-picker">
                    <input name="challengeFile" type="file" accept=".zip,application/zip" onChange={(event) => setChallengeFile(event.target.files?.[0] ?? null)} />
                    <span>{challengeFile?.name || editingChallenge?.attachmentName || '파일 선택'}</span>
                    <em>찾아보기</em>
                  </span>
                </label>

                <label className="admin-file-field deployment-file-field">
                    <span className="field-label-row">
                      <strong>Deploy ZIP</strong>
                      <small>최대 50MB</small>
                    </span>
                    <span className="file-picker">
                      <input name="deploymentFile" required={!editingChallenge?.deploymentName} type="file" accept=".zip,application/zip" onChange={(event) => setDeploymentFile(event.target.files?.[0] ?? null)} />
                      <span className={!deploymentFile && editingChallenge ? `deployment-file-status ${deploymentStatusCopy[editingChallenge.deploymentStatus].tone}` : undefined}>
                        {deploymentFile?.name || (editingChallenge?.usesVm && editingChallenge.deploymentStatus !== 'NONE'
                          ? deploymentStatusCopy[editingChallenge.deploymentStatus].label
                          : editingChallenge?.deploymentName || 'ZIP 파일 선택')}
                      </span>
                      <em>찾아보기</em>
                    </span>
                    {!deploymentFile && editingChallenge?.deploymentStatus === 'FAILED' && editingChallenge.deploymentError && <small className="deployment-field-error">{editingChallenge.deploymentError}</small>}
                </label>
              </div>

              <div className={`vm-runtime-reveal wide${challengeForm.usesVm ? ' is-visible' : ''}`} aria-hidden={!challengeForm.usesVm}>
                <div className="vm-runtime-grid">
                  <div className="vm-runtime-option">
                    <span className="field-label-row"><strong>빌드 방식</strong></span>
                    <label className={challengeForm.usesCompose ? 'vm-choice is-checked' : 'vm-choice'}>
                      <input type="checkbox" disabled={!challengeForm.usesVm} checked={challengeForm.usesCompose} onChange={(event) => setChallengeForm({ ...challengeForm, usesCompose: event.target.checked })} />
                      <span><strong>Docker Compose 사용</strong></span>
                    </label>
                  </div>
                  <label>
                    <span className="field-label-row"><strong>연결 포트</strong><small>외부에 연결할 컨테이너 내부 포트</small></span>
                    <input name="instancePort" disabled={!challengeForm.usesVm} required={challengeForm.usesVm} type="number" min="1" max="65535" inputMode="numeric" value={challengeForm.instancePort} onChange={(event) => setChallengeForm({ ...challengeForm, instancePort: event.target.value })} />
                  </label>
                </div>
              </div>

              <div className="wide">
                <span className="field-label-row">
                  <strong>플래그</strong>
                  <label className="inline-check"><input type="checkbox" checked={challengeForm.dynamicFlag} onChange={(event) => setChallengeForm({ ...challengeForm, dynamicFlag: event.target.checked })} /> 팀/개인별 Dynamic flag</label>
                  {!editingChallengeId
                    ? <small>{challengeForm.usesVm ? 'Deploy ZIP 원본 플래그' : '필수 입력'}</small>
                    : !editingChallenge?.flag && <small>기존 플래그 없음 · 입력 필요</small>}
                </span>
                <input name="flag" autoComplete="off" spellCheck={false} required={!editingChallengeId && !challengeForm.dynamicFlag} disabled={challengeForm.dynamicFlag} type="text" maxLength={256} placeholder={challengeForm.dynamicFlag ? '소유 토큰으로 자동 생성' : 'KCTF{…}'} value={challengeForm.flag} onChange={(event) => setChallengeForm({ ...challengeForm, flag: event.target.value })} />
              </div>

              <label className="wide">
                <span className="field-label-row">
                  <strong>문제 설명 · Markdown</strong>
                  <small id="description-help">이미지 <code>![설명](URL)</code> · 크기를 알면 <code>{'![설명](URL "800x600")'}</code> · 영상 <code>[제목](URL)</code></small>
                </span>
                <textarea name="description" autoComplete="off" required maxLength={10000} rows={8} placeholder="문제 배경, 접속 안내, 힌트 등을 Markdown 형식으로 작성하세요." value={challengeForm.description} onChange={(event) => setChallengeForm({ ...challengeForm, description: event.target.value })} aria-describedby="description-help" />
              </label>
                  {challengeForm.description && <details className="wide description-preview"><summary><span>문제 설명 미리보기</span><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg></summary><ChallengeDescription content={challengeForm.description} /></details>}
                  <div className="challenge-form-actions"><p className={`admin-notice ${noticeTone}`} aria-live="polite">{notice}</p><div><button type="button" className="button button-ghost" onClick={resetChallengeForm}>취소</button><button className="button button-primary" disabled={isSaving}>{isSaving ? '저장 중…' : editingChallengeId ? '문제 저장' : '문제 만들기'}</button></div></div>
                </form>
              </div>
            )}

            <div className="challenge-admin-table">
              {challenges.length === 0 && <p className="challenge-list-empty">등록된 문제가 없습니다.</p>}
              {challenges.map((challenge) => (
                <article key={challenge.id}>
                  <div className="challenge-list-copy">
                    <span>{challenge.category}</span>
                    <div className="challenge-list-title-line">
                      <strong>{challenge.title}</strong>
                      <div className="challenge-list-meta">
                        <small>{challenge.currentPoints} / {challenge.points} PTS</small>
                        <small>{challenge.solves} SOLVES</small>
                        <small>{challenge.scoringMode}</small>
                        {challenge.usesVm && <small className={`deployment-status ${deploymentStatusCopy[challenge.deploymentStatus].tone}`}>{deploymentStatusCopy[challenge.deploymentStatus].label}</small>}
                      </div>
                    </div>
                    {challenge.deploymentError && <small className="deployment-error">{challenge.deploymentError}</small>}
                  </div>
                  <div className="challenge-list-actions"><button type="button" onClick={() => editChallenge(challenge)}>수정</button><button type="button" className="danger" disabled={isSaving} onClick={() => void deleteChallenge(challenge)}>삭제</button></div>
                </article>
              ))}
            </div>
          </section>
        )}

        <AdminLogs initialLogs={initialLogs} active={activeNav === 'logs'} onError={(message) => setNotice(message, 'error')} />

      </div>
      {confirmation}
    </main>
  );
}
