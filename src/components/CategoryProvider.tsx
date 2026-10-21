'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Category, defaultCategories } from '@/lib/platform-data';

type CategoryContextValue = {
  categories: Category[];
  hasLocalChanges: boolean;
  updateCategories: (categories: Category[]) => void;
  resetCategories: () => void;
};

const CategoryContext = createContext<CategoryContextValue | null>(null);
const STORAGE_KEY = 'kctf:categories:v1';

export function CategoryProvider({ children }: { children: React.ReactNode }) {
  const [categories, setCategories] = useState(defaultCategories);
  const [hasLocalChanges, setHasLocalChanges] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved) as Category[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        setCategories(parsed);
        setHasLocalChanges(true);
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const updateCategories = useCallback((nextCategories: Category[]) => {
    const ordered = [...nextCategories].sort((a, b) => a.order - b.order)
      .map((category, index) => ({ ...category, order: index + 1 }));
    setCategories(ordered);
    setHasLocalChanges(true);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ordered));
  }, []);

  const resetCategories = useCallback(() => {
    setCategories(defaultCategories);
    setHasLocalChanges(false);
    window.localStorage.removeItem(STORAGE_KEY);
  }, []);

  const value = useMemo(() => ({ categories, hasLocalChanges, updateCategories, resetCategories }), [categories, hasLocalChanges, resetCategories, updateCategories]);

  return <CategoryContext.Provider value={value}>{children}</CategoryContext.Provider>;
}

export function useCategories() {
  const context = useContext(CategoryContext);
  if (!context) throw new Error('useCategories must be used inside CategoryProvider');
  return context;
}
