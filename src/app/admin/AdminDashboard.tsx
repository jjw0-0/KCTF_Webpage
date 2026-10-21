'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Category, challenges } from '@/lib/platform-data';

type NavItem = 'overview' | 'categories' | 'challenges' | 'operations';

const navItems: { id: NavItem; label: string; marker: string }[] = [
  { id: 'overview', label: 'Overview', marker: '01' },
  { id: 'categories', label: 'Categories', marker: '02' },
  { id: 'challenges', label: 'Challenges', marker: '03' },
  { id: 'operations', label: 'Operations', marker: '04' },
];

export default function AdminDashboard({ initialCategories }: { initialCategories: Category[] }) {
  const [categories, setCategories] = useState(initialCategories);
  const [activeNav, setActiveNav] = useState<NavItem>('categories');
  const [newCategory, setNewCategory] = useState('');
  const [notice, setNotice] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const visibleCount = categories.filter((category) => category.visible).length;
  const challengeCountByCategory = useMemo(() => new Map(categories.map((category) => [
    category.slug,
    challenges.filter((challenge) => challenge.category === category.slug).length,
  ])), [categories]);

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

  return (
    <main className="admin-main">
      <aside className="admin-sidebar">
        <div>
          <p className="eyebrow">CONTROL CENTER</p>
          <h1>KCTF<span>/admin</span></h1>
        </div>
        <nav aria-label="관리자 메뉴">
          {navItems.map((item) => (
            <button
              type="button"
              key={item.id}
              className={activeNav === item.id ? 'active' : ''}
              onClick={() => setActiveNav(item.id)}
            >
              <span>{item.marker}</span>{item.label}
            </button>
          ))}
        </nav>
        <div className="admin-system-state">
          <span className="status-dot" />
          <div><strong>ALL SYSTEMS NORMAL</strong><small>Last checked just now</small></div>
        </div>
      </aside>

      <div className="admin-content">
        <header className="admin-heading">
          <div>
            <p className="eyebrow">ADMIN VIEW / {activeNav.toUpperCase()}</p>
            <h2>{activeNav === 'categories' ? 'Category control' : 'Operations overview'}</h2>
            <p>대회 노출 구조를 조정하고 참가자 화면에 즉시 반영합니다.</p>
          </div>
          <Link href="/ctf" className="button button-ghost">PLAYER VIEW ↗</Link>
        </header>

        <section className="admin-stats" aria-label="대회 현황">
          <article><span>LIVE USERS</span><strong>128</strong><small className="positive">+18.2%</small></article>
          <article><span>SUBMISSIONS / MIN</span><strong>42</strong><small>p95 84ms</small></article>
          <article><span>CHALLENGES</span><strong>{challenges.length}</strong><small>{challenges.filter((challenge) => challenge.solved).length} solved by you</small></article>
          <article><span>VISIBLE CATEGORIES</span><strong>{visibleCount}</strong><small>{categories.length} total</small></article>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-heading">
            <div>
              <span className="admin-kicker">LANDING + CHALLENGE TAXONOMY</span>
              <h3>Categories</h3>
            </div>
            <form onSubmit={(event) => { event.preventDefault(); void addCategory(); }} className="add-category-form">
              <label htmlFor="new-category" className="sr-only">새 카테고리명</label>
              <input id="new-category" value={newCategory} onChange={(event) => setNewCategory(event.target.value)} placeholder="New category" />
              <button type="submit" disabled={isSaving}>+ ADD</button>
            </form>
          </div>

          <div className="category-admin-table" role="table" aria-label="카테고리 관리">
            <div className="category-admin-row table-head" role="row">
              <span>ORDER</span><span>NAME / SLUG</span><span>CHALLENGES</span><span>LANDING</span><span>ACTIONS</span>
            </div>
            {categories.map((category, index) => (
              <div className="category-admin-row" role="row" key={category.id}>
                <div className="category-order">
                  <strong>{String(index + 1).padStart(2, '0')}</strong>
                  <span>
                    <button type="button" onClick={() => moveCategory(category.id, -1)} disabled={index === 0} aria-label={`${category.name} 위로 이동`}>↑</button>
                    <button type="button" onClick={() => moveCategory(category.id, 1)} disabled={index === categories.length - 1} aria-label={`${category.name} 아래로 이동`}>↓</button>
                  </span>
                </div>
                <div className="category-edit-fields">
                  <input value={category.name} onChange={(event) => patchCategory(category.id, { name: event.target.value, shortName: event.target.value.slice(0, 8).toUpperCase() })} aria-label={`${category.name} 이름`} />
                  <span>/{category.slug}</span>
                </div>
                <span className="category-count">{challengeCountByCategory.get(category.slug) ?? 0}</span>
                <label className="visibility-toggle">
                  <input type="checkbox" checked={category.visible} onChange={(event) => patchCategory(category.id, { visible: event.target.checked })} />
                  <span aria-hidden="true" />
                  <b>{category.visible ? 'VISIBLE' : 'HIDDEN'}</b>
                </label>
                <button type="button" className="delete-category" onClick={() => void deleteCategory(category)} disabled={isSaving}>DELETE</button>
              </div>
            ))}
          </div>

          <div className="admin-panel-footer">
            <p aria-live="polite">{notice || (isDirty ? '저장되지 않은 변경사항이 있습니다.' : 'PostgreSQL과 동기화되어 있습니다.')}</p>
            <div className="admin-footer-actions">
              <button type="button" onClick={() => void resetCategories()} disabled={isSaving}>RESET DEFAULTS</button>
              <button type="button" className="button button-primary" onClick={() => void saveCategories()} disabled={!isDirty || isSaving}>
                {isSaving ? 'SAVING…' : 'SAVE CHANGES'}
              </button>
            </div>
          </div>
        </section>

        <section className="load-panel">
          <div>
            <span className="admin-kicker">TRAFFIC / LAST 30 MIN</span>
            <h3>Request load</h3>
          </div>
          <div className="load-chart" aria-label="요청 부하 그래프">
            {[24,32,30,46,39,64,58,72,51,88,69,76,55,92,68,81,73,95,79,66,86,74,91,82].map((height, index) => (
              <i key={index} style={{ height: `${height}%` }} />
            ))}
          </div>
          <div className="load-legend"><span><b />HUMAN</span><span><b />AUTOMATION</span><strong>2,481 req/min</strong></div>
        </section>
      </div>
    </main>
  );
}
