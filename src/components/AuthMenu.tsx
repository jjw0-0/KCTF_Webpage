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
      {isAdmin && <Link href="/admin" className="header-link">Admin</Link>}
      <Link href="/profile" className="header-link">{username}</Link>
      <button type="button" className="header-login" onClick={() => void signOut({ redirectTo: '/' })}>
        Sign out
      </button>
    </>
  );
}

