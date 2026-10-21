'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { signIn } from 'next-auth/react';

export default function RegisterForm() {
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    const form = new FormData(event.currentTarget);
    const password = String(form.get('password') ?? '');
    if (password !== String(form.get('passwordConfirm') ?? '')) {
      setError('비밀번호 확인이 일치하지 않습니다.');
      return;
    }

    setIsSubmitting(true);
    try {
      const email = String(form.get('email') ?? '');
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, username: form.get('username'), password }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? '회원가입에 실패했습니다.');
      const result = await signIn('credentials', { email, password, redirect: false });
      window.location.assign(result?.error ? '/login?registered=1' : '/ctf');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '회원가입에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <form className="auth-form" onSubmit={handleSubmit} aria-busy={isSubmitting}>
        <div className="auth-field">
          <label htmlFor="email">이메일</label>
          <input type="email" id="email" name="email" required autoComplete="email" placeholder="your@email.com" />
        </div>
        <div className="auth-field">
          <label htmlFor="nickname">닉네임</label>
          <input type="text" id="nickname" name="username" required minLength={2} maxLength={24} autoComplete="username" placeholder="닉네임을 입력하세요" />
        </div>
        <div className="auth-field">
          <label htmlFor="password">비밀번호</label>
          <input type="password" id="password" name="password" required minLength={10} autoComplete="new-password" placeholder="10자 이상" />
        </div>
        <div className="auth-field">
          <label htmlFor="password-confirm">비밀번호 확인</label>
          <input type="password" id="password-confirm" name="passwordConfirm" required minLength={10} autoComplete="new-password" placeholder="비밀번호를 다시 입력하세요" />
        </div>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button type="submit" disabled={isSubmitting} className="auth-submit">
          {isSubmitting ? '계정 생성 중…' : '회원가입'}
        </button>
      </form>
      <p className="auth-switch">이미 계정이 있으신가요? <Link href="/login">로그인</Link></p>
    </>
  );
}

