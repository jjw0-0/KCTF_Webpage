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
      <form className="space-y-6" onSubmit={handleSubmit}>
        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-2">이메일</label>
          <input name="email" type="email" id="email" required autoComplete="email" className="w-full px-4 py-3 bg-[#111111] border border-white/10 rounded-lg focus:outline-none focus:border-[#34B27B] transition-colors" placeholder="your@email.com" />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium mb-2">비밀번호</label>
          <input name="password" type="password" id="password" required minLength={8} autoComplete="current-password" className="w-full px-4 py-3 bg-[#111111] border border-white/10 rounded-lg focus:outline-none focus:border-[#34B27B] transition-colors" placeholder="••••••••" />
        </div>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button type="submit" disabled={isSubmitting} className="w-full py-3 rounded-lg font-medium transition-all disabled:opacity-50" style={{ background: 'linear-gradient(90deg, #2A5034 0%, #34B27B 100%)' }}>
          {isSubmitting ? '로그인 중…' : '로그인'}
        </button>
      </form>
      <div className="mt-8 text-center">
        <p className="text-white/60">계정이 없으신가요?{' '}<Link href="/register" className="text-[#34B27B] hover:text-[#2A5034] transition-colors font-medium">회원가입</Link></p>
      </div>
    </>
  );
}

