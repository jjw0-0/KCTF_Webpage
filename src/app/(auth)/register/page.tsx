/**
 * 회원가입 페이지
 * 이메일, 닉네임, 비밀번호로 회원가입
 */
'use client';

import Link from 'next/link';
import PageLayout from '@/components/PageLayout';

export default function RegisterPage() {
  return (
    <PageLayout>
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-2">회원가입</h1>
            <p className="text-white/60">KCTF에 참가하세요</p>
          </div>

          <form className="space-y-6">
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-2">
                이메일
              </label>
              <input
                type="email"
                id="email"
                className="w-full px-4 py-3 bg-[#111111] border border-white/10 rounded-lg focus:outline-none focus:border-[#34B27B] transition-colors"
                placeholder="your@email.com"
              />
            </div>

            {/* Nickname Field */}
            <div>
              <label htmlFor="nickname" className="block text-sm font-medium mb-2">
                닉네임
              </label>
              <input
                type="text"
                id="nickname"
                className="w-full px-4 py-3 bg-[#111111] border border-white/10 rounded-lg focus:outline-none focus:border-[#34B27B] transition-colors"
                placeholder="닉네임을 입력하세요"
              />
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-2">
                비밀번호
              </label>
              <input
                type="password"
                id="password"
                className="w-full px-4 py-3 bg-[#111111] border border-white/10 rounded-lg focus:outline-none focus:border-[#34B27B] transition-colors"
                placeholder="••••••••"
              />
            </div>

            {/* Password Confirmation Field */}
            <div>
              <label htmlFor="password-confirm" className="block text-sm font-medium mb-2">
                비밀번호 확인
              </label>
              <input
                type="password"
                id="password-confirm"
                className="w-full px-4 py-3 bg-[#111111] border border-white/10 rounded-lg focus:outline-none focus:border-[#34B27B] transition-colors"
                placeholder="••••••••"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full py-3 rounded-lg font-medium transition-all"
              style={{
                background: 'linear-gradient(90deg, #2A5034 0%, #34B27B 100%)',
              }}
            >
              회원가입
            </button>
          </form>

          {/* Login Link */}
          <div className="mt-8 text-center">
            <p className="text-white/60">
              이미 계정이 있으신가요?{' '}
              <Link
                href="/login"
                className="text-[#34B27B] hover:text-[#2A5034] transition-colors font-medium"
              >
                로그인
              </Link>
            </p>
          </div>
        </div>
      </main>
    </PageLayout>
  );
}
