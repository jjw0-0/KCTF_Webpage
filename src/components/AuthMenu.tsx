'use client';

import Link from 'next/link';
import { signOut } from 'next-auth/react';

type AuthMenuProps = {
  username?: string;
  isAdmin?: boolean;
};

export default function AuthMenu({ username, isAdmin = false }: AuthMenuProps) {
  if (!username) return <Link href="/login" className="header-login">Sign in</Link>;

  return (
    <>
      <span className="auth-desktop-actions">
        {isAdmin && <Link href="/admin" className="header-link">Admin</Link>}
        <Link href="/profile" className="header-link">{username}</Link>
        <button type="button" className="header-login" onClick={() => void signOut({ redirectTo: '/' })}>
          Sign out
        </button>
      </span>
      <details className="auth-mobile-menu">
        <summary aria-label={`${username} 계정 메뉴`}>계정</summary>
        <div>
          <Link href="/profile">프로필</Link>
          {isAdmin && <Link href="/admin">관리자</Link>}
          <button type="button" onClick={() => void signOut({ redirectTo: '/' })}>로그아웃</button>
        </div>
      </details>
    </>
  );
}

