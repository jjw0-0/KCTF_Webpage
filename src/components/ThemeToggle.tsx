'use client';

import { useEffect } from 'react';

const key = 'theme';

export default function ThemeToggle() {
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: light)');
    const followSystem = () => {
      if (!localStorage.getItem(key)) {
        document.documentElement.dataset.theme = media.matches ? 'light' : 'dark';
      }
    };

    media.addEventListener('change', followSystem);
    return () => media.removeEventListener('change', followSystem);
  }, []);

  const toggle = () => {
    const root = document.documentElement;
    const theme = root.dataset.theme === 'light' ? 'dark' : 'light';
    root.dataset.theme = theme;
    localStorage.setItem(key, theme);
  };

  return (
    <button type="button" className="theme-toggle" onClick={toggle} aria-label="화면 모드 전환" title="화면 모드 전환">
      <svg className="theme-icon theme-icon-sun" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="3.5" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
      <svg className="theme-icon theme-icon-moon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20 15.2A8.5 8.5 0 0 1 8.8 4 8.5 8.5 0 1 0 20 15.2Z" />
      </svg>
    </button>
  );
}
