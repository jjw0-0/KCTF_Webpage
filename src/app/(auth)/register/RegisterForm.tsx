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
      <form className="space-y-6" onSubmit={handleSubmit}>
        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-2">이메일</label>
          <input type="email" id="email" name="email" required autoComplete="email" className="w-full px-4 py-3 bg-[#111111] border border-white/10 rounded-lg focus:outline-none focus:border-[#34B27B] transition-colors" placeholder="your@email.com" />
        </div>
        <div>
          <label htmlFor="nickname" className="block text-sm font-medium mb-2">닉네임</label>
          <input type="text" id="nickname" name="username" required minLength={2} maxLength={24} autoComplete="username" className="w-full px-4 py-3 bg-[#111111] border border-white/10 rounded-lg focus:outline-none focus:border-[#34B27B] transition-colors" placeholder="닉네임을 입력하세요" />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium mb-2">비밀번호</label>
          <input type="password" id="password" name="password" required minLength={10} autoComplete="new-password" className="w-full px-4 py-3 bg-[#111111] border border-white/10 rounded-lg focus:outline-none focus:border-[#34B27B] transition-colors" placeholder="10자 이상" />
        </div>
        <div>
          <label htmlFor="password-confirm" className="block text-sm font-medium mb-2">비밀번호 확인</label>
          <input type="password" id="password-confirm" name="passwordConfirm" required minLength={10} autoComplete="new-password" className="w-full px-4 py-3 bg-[#111111] border border-white/10 rounded-lg focus:outline-none focus:border-[#34B27B] transition-colors" placeholder="비밀번호를 다시 입력하세요" />
        </div>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button type="submit" disabled={isSubmitting} className="w-full py-3 rounded-lg font-medium transition-all disabled:opacity-50" style={{ background: 'linear-gradient(90deg, #2A5034 0%, #34B27B 100%)' }}>
          {isSubmitting ? '계정 생성 중…' : '회원가입'}
        </button>
      </form>
      <div className="mt-8 text-center">
        <p className="text-white/60">이미 계정이 있으신가요?{' '}<Link href="/login" className="text-[#34B27B] hover:text-[#2A5034] transition-colors font-medium">로그인</Link></p>
      </div>
    </>
  );
}

