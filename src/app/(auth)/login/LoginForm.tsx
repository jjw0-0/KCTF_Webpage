'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { signIn } from 'next-auth/react';

export default function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    const form = new FormData(event.currentTarget);

    try {
      const result = await signIn('credentials', {
        email: String(form.get('email') ?? ''),
        password: String(form.get('password') ?? ''),
        redirect: false,
      });
      if (result?.error) {
        setError('이메일 또는 비밀번호가 올바르지 않습니다.');
        return;
      }
      window.location.assign(callbackUrl);
    } catch {
      setError('로그인 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <form className="auth-form" onSubmit={handleSubmit} aria-busy={isSubmitting}>
        <div className="auth-field">
          <label htmlFor="email">이메일</label>
          <input name="email" type="email" id="email" required autoComplete="email" placeholder="your@email.com" />
        </div>
        <div className="auth-field">
          <label htmlFor="password">비밀번호</label>
          <input name="password" type="password" id="password" required minLength={8} autoComplete="current-password" placeholder="••••••••" />
        </div>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button type="submit" disabled={isSubmitting} className="auth-submit">
          {isSubmitting ? '로그인 중…' : '로그인'}
        </button>
      </form>
      <p className="auth-switch">계정이 없으신가요? <Link href="/register">회원가입</Link></p>
    </>
  );
}

