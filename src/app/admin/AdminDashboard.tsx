'use client';

import { FormEvent, useMemo, useState } from 'react';
import Link from 'next/link';
import { AdminChallenge } from '@/lib/challenges';
import { Category } from '@/lib/platform-data';

type NavItem = 'overview' | 'categories' | 'challenges' | 'operations';
type ChallengeForm = {
  title: string;
  summary: string;
  description: string;
  categoryId: string;
  points: string;
  difficulty: AdminChallenge['difficulty'];
  tags: string;
  flag: string;
  instanceSlug: string;
  visible: boolean;
};

const navItems: { id: NavItem; label: string; marker: string }[] = [
  { id: 'overview', label: 'Overview', marker: '01' },
  { id: 'categories', label: 'Categories', marker: '02' },
  { id: 'challenges', label: 'Challenges', marker: '03' },
  { id: 'operations', label: 'Operations', marker: '04' },
];

function emptyChallenge(categoryId = ''): ChallengeForm {
  return {
    title: '',
    summary: '',
    description: '',
    categoryId,
    points: '100',
    difficulty: 'INTERMEDIATE',
    tags: '',
    flag: '',
    instanceSlug: '',
    visible: false,
  };
}

const headings: Record<NavItem, [string, string]> = {
  overview: ['Operations overview', '현재 대회 구성과 공개 상태를 한눈에 확인합니다.'],
  categories: ['Category control', '랜딩과 문제 목록의 카테고리 및 노출 순서를 관리합니다.'],
  challenges: ['Challenge control', '문제, 정답 플래그, 배점과 전용 VM을 관리합니다.'],
  operations: ['Runtime operations', '참가자 경로와 인스턴서 연결 상태를 확인합니다.'],
};

export default function AdminDashboard({ initialCategories, initialChallenges }: { initialCategories: Category[]; initialChallenges: AdminChallenge[] }) {
  const [categories, setCategories] = useState(initialCategories);
  const [challenges, setChallenges] = useState(initialChallenges);
  const [activeNav, setActiveNav] = useState<NavItem>('categories');
  const [newCategory, setNewCategory] = useState('');
  const [notice, setNotice] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingChallengeId, setEditingChallengeId] = useState<string | null>(null);
  const [challengeForm, setChallengeForm] = useState<ChallengeForm>(() => emptyChallenge(initialCategories[0]?.id));

  const visibleCount = categories.filter((category) => category.visible).length;
  const publicChallenges = challenges.filter((challenge) => challenge.visible).length;
  const totalSolves = challenges.reduce((total, challenge) => total + challenge.solves, 0);
  const challengeCountByCategory = useMemo(() => new Map(categories.map((category) => [
    category.slug,
    challenges.filter((challenge) => challenge.categoryId === category.id).length,
  ])), [categories, challenges]);

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
      setNotice(error instanceof Error ? error.message : '카테고리를 추가하지 못했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteCategory = async (category: Category) => {
    if ((challengeCountByCategory.get(category.slug) ?? 0) > 0) {
      setNotice('문제가 연결된 카테고리는 삭제할 수 없습니다. 먼저 문제를 이동해 주세요.');
      return;
    }
    setIsSaving(true);
    try {
      const response = await fetch(`/api/categories/${encodeURIComponent(category.id)}`, { method: 'DELETE' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? '카테고리를 삭제하지 못했습니다.');
      setCategories(payload.categories);
      setIsDirty(false);
      setNotice('카테고리가 삭제되었습니다.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '카테고리를 삭제하지 못했습니다.');
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
      setNotice(error instanceof Error ? error.message : '변경사항을 저장하지 못했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const resetCategories = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/categories/reset', { method: 'POST' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? '기본 구성을 복원하지 못했습니다.');
      setCategories(payload.categories);
      setIsDirty(false);
      setNotice('기본 구성을 복원하고 참가자 화면에 반영했습니다.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '기본 구성을 복원하지 못했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const editChallenge = (challenge: AdminChallenge) => {
    setEditingChallengeId(challenge.id);
    setChallengeForm({
      title: challenge.title,
      summary: challenge.summary,
      description: challenge.description,
      categoryId: challenge.categoryId,
      points: String(challenge.points),
      difficulty: challenge.difficulty,
      tags: challenge.tags.join(', '),
      flag: '',
      instanceSlug: challenge.instanceSlug,
      visible: challenge.visible,
    });
    setNotice('플래그를 비워두면 기존 값이 유지됩니다.');
  };

  const resetChallengeForm = () => {
    setEditingChallengeId(null);
    setChallengeForm(emptyChallenge(categories[0]?.id));
  };

  const saveChallenge = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    try {
      const response = await fetch(editingChallengeId
        ? `/api/admin/challenges/${encodeURIComponent(editingChallengeId)}`
        : '/api/admin/challenges', {
        method: editingChallengeId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...challengeForm,
          points: Number(challengeForm.points),
          tags: [...new Set(challengeForm.tags.split(',').map((tag) => tag.trim()).filter(Boolean))],
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? '문제를 저장하지 못했습니다.');
      setChallenges(payload.challenges);
      setNotice(editingChallengeId ? '문제 변경사항을 반영했습니다.' : '새 문제를 생성했습니다.');
      resetChallengeForm();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '문제를 저장하지 못했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteChallenge = async (challenge: AdminChallenge) => {
    if (!window.confirm(`“${challenge.title}” 문제를 삭제할까요?`)) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/admin/challenges/${encodeURIComponent(challenge.id)}`, { method: 'DELETE' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? '문제를 삭제하지 못했습니다.');
      setChallenges(payload.challenges);
      if (editingChallengeId === challenge.id) resetChallengeForm();
      setNotice('문제를 삭제했습니다.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '문제를 삭제하지 못했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const [heading, description] = headings[activeNav];

  return (
    <main className="admin-main">
      <aside className="admin-sidebar">
        <div><p className="eyebrow">CONTROL CENTER</p><h1>KCTF<span>/admin</span></h1></div>
        <nav aria-label="관리자 메뉴">
          {navItems.map((item) => (
            <button type="button" key={item.id} className={activeNav === item.id ? 'active' : ''} onClick={() => setActiveNav(item.id)}>
              <span>{item.marker}</span>{item.label}
            </button>
          ))}
        </nav>
        <div className="admin-system-state"><span className="status-dot" /><div><strong>CONTROL PLANE ONLINE</strong><small>PostgreSQL connected</small></div></div>
      </aside>

      <div className="admin-content">
        <header className="admin-heading">
          <div><p className="eyebrow">ADMIN VIEW / {activeNav.toUpperCase()}</p><h2>{heading}</h2><p>{description}</p></div>
          <Link href="/ctf" className="button button-ghost">PLAYER VIEW ↗</Link>
        </header>

        <section className="admin-stats" aria-label="대회 현황">
          <article><span>CHALLENGES</span><strong>{challenges.length}</strong><small>{publicChallenges} public</small></article>
          <article><span>TOTAL SOLVES</span><strong>{totalSolves}</strong><small>individual scoring</small></article>
          <article><span>CATEGORIES</span><strong>{categories.length}</strong><small>{visibleCount} public</small></article>
          <article><span>VM BACKEND</span><strong>ON</strong><small>one instance / user</small></article>
        </section>

        {activeNav === 'categories' && (
          <section className="admin-panel">
            <div className="admin-panel-heading">
              <div><span className="admin-kicker">LANDING + CHALLENGE TAXONOMY</span><h3>Categories</h3></div>
              <form onSubmit={(event) => { event.preventDefault(); void addCategory(); }} className="add-category-form">
                <label htmlFor="new-category" className="sr-only">새 카테고리명</label>
                <input id="new-category" value={newCategory} onChange={(event) => setNewCategory(event.target.value)} placeholder="New category" />
                <button type="submit" disabled={isSaving}>+ ADD</button>
              </form>
            </div>

            <div className="category-admin-table" role="table" aria-label="카테고리 관리">
              <div className="category-admin-row table-head" role="row"><span>ORDER</span><span>NAME / SLUG</span><span>CHALLENGES</span><span>LANDING</span><span>ACTIONS</span></div>
              {categories.map((category, index) => (
                <div className="category-admin-row" role="row" key={category.id}>
                  <div className="category-order">
                    <strong>{String(index + 1).padStart(2, '0')}</strong>
                    <span><button type="button" onClick={() => moveCategory(category.id, -1)} disabled={index === 0} aria-label={`${category.name} 위로 이동`}>↑</button><button type="button" onClick={() => moveCategory(category.id, 1)} disabled={index === categories.length - 1} aria-label={`${category.name} 아래로 이동`}>↓</button></span>
                  </div>
                  <div className="category-edit-fields"><input value={category.name} onChange={(event) => patchCategory(category.id, { name: event.target.value, shortName: event.target.value.slice(0, 8).toUpperCase() })} aria-label={`${category.name} 이름`} /><span>/{category.slug}</span></div>
                  <span className="category-count">{challengeCountByCategory.get(category.slug) ?? 0}</span>
                  <label className="visibility-toggle"><input type="checkbox" checked={category.visible} onChange={(event) => patchCategory(category.id, { visible: event.target.checked })} /><span aria-hidden="true" /><b>{category.visible ? 'VISIBLE' : 'HIDDEN'}</b></label>
                  <button type="button" className="delete-category" onClick={() => void deleteCategory(category)} disabled={isSaving}>DELETE</button>
                </div>
              ))}
            </div>

            <div className="admin-panel-footer">
              <p aria-live="polite">{notice || (isDirty ? '저장되지 않은 변경사항이 있습니다.' : 'PostgreSQL과 동기화되어 있습니다.')}</p>
              <div className="admin-footer-actions"><button type="button" onClick={() => void resetCategories()} disabled={isSaving}>RESET DEFAULTS</button><button type="button" className="button button-primary" onClick={() => void saveCategories()} disabled={!isDirty || isSaving}>{isSaving ? 'SAVING…' : 'SAVE CHANGES'}</button></div>
            </div>
          </section>
        )}

        {activeNav === 'challenges' && (
          <section className="admin-panel challenge-admin-panel">
            <div className="admin-panel-heading">
              <div><span className="admin-kicker">CONTENT + SCORING + INSTANCER</span><h3>{editingChallengeId ? 'Edit challenge' : 'New challenge'}</h3></div>
              {editingChallengeId && <button type="button" className="button button-ghost" onClick={resetChallengeForm}>CANCEL EDIT</button>}
            </div>
            <form className="challenge-admin-form" onSubmit={(event) => void saveChallenge(event)}>
              <label>Title<input required maxLength={80} value={challengeForm.title} onChange={(event) => setChallengeForm({ ...challengeForm, title: event.target.value })} /></label>
              <label>Category<select required value={challengeForm.categoryId} onChange={(event) => setChallengeForm({ ...challengeForm, categoryId: event.target.value })}>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label>
              <label>Points<input required type="number" min="1" max="10000" value={challengeForm.points} onChange={(event) => setChallengeForm({ ...challengeForm, points: event.target.value })} /></label>
              <label>Difficulty<select value={challengeForm.difficulty} onChange={(event) => setChallengeForm({ ...challengeForm, difficulty: event.target.value as ChallengeForm['difficulty'] })}><option value="BEGINNER">Beginner</option><option value="INTERMEDIATE">Intermediate</option><option value="ADVANCED">Advanced</option></select></label>
              <label className="wide">Card summary<input required maxLength={300} value={challengeForm.summary} onChange={(event) => setChallengeForm({ ...challengeForm, summary: event.target.value })} /></label>
              <label className="wide">Description<textarea required rows={4} value={challengeForm.description} onChange={(event) => setChallengeForm({ ...challengeForm, description: event.target.value })} /></label>
              <label>Tags<input placeholder="HTTP, SSRF" value={challengeForm.tags} onChange={(event) => setChallengeForm({ ...challengeForm, tags: event.target.value })} /></label>
              <label>VM slug<input placeholder="optional" value={challengeForm.instanceSlug} onChange={(event) => setChallengeForm({ ...challengeForm, instanceSlug: event.target.value })} /></label>
              <label className="wide">Flag<input required={!editingChallengeId} type="password" maxLength={256} placeholder={editingChallengeId ? '비워두면 기존 플래그 유지' : 'KCTF{...}'} value={challengeForm.flag} onChange={(event) => setChallengeForm({ ...challengeForm, flag: event.target.value })} /></label>
              <label className="challenge-visible"><input type="checkbox" checked={challengeForm.visible} onChange={(event) => setChallengeForm({ ...challengeForm, visible: event.target.checked })} /> 참가자에게 공개</label>
              <div className="challenge-form-actions"><p aria-live="polite">{notice}</p><button className="button button-primary" disabled={isSaving}>{isSaving ? 'SAVING…' : editingChallengeId ? 'SAVE CHALLENGE' : 'CREATE CHALLENGE'}</button></div>
            </form>

            <div className="challenge-admin-table">
              {challenges.map((challenge) => (
                <article key={challenge.id}>
                  <div><span>{challenge.category} · {challenge.difficulty}</span><strong>{challenge.title}</strong><small>{challenge.points} PTS · {challenge.solves} SOLVES · {challenge.visible ? 'PUBLIC' : 'HIDDEN'}</small></div>
                  <div><button type="button" onClick={() => editChallenge(challenge)}>EDIT</button><button type="button" className="danger" disabled={isSaving} onClick={() => void deleteChallenge(challenge)}>DELETE</button></div>
                </article>
              ))}
            </div>
          </section>
        )}

        {(activeNav === 'overview' || activeNav === 'operations') && (
          <section className="admin-panel admin-summary-panel">
            <span className="admin-kicker">{activeNav === 'operations' ? 'RUNTIME' : 'EVENT'}</span>
            <h3>{activeNav === 'operations' ? 'Participant services are connected' : 'KCTF 2026 is ready'}</h3>
            <p>{activeNav === 'operations' ? 'PostgreSQL 영속화, 정답 채점, 개인별 VM 발급 경로가 활성화되어 있습니다.' : '카테고리와 문제 공개 상태를 확인한 뒤 참가자 화면에서 최종 검수하세요.'}</p>
            <div><button type="button" className="button button-ghost" onClick={() => setActiveNav('categories')}>CATEGORIES</button><button type="button" className="button button-primary" onClick={() => setActiveNav('challenges')}>CHALLENGES</button></div>
          </section>
        )}
      </div>
    </main>
  );
}
