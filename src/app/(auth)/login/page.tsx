/**
 * 로그인 페이지
 * 이메일과 비밀번호로 로그인
 */
'use client';

import Link from 'next/link';
import PageLayout from '@/components/PageLayout';

export default function LoginPage() {
  return (
    <PageLayout>
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-2">로그인</h1>
            <p className="text-white/60">KCTF에 오신 것을 환영합니다</p>
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

            {/* Forgot Password Link */}
            <div className="text-right">
              <Link
                href="#"
                className="text-sm text-[#34B27B] hover:text-[#2A5034] transition-colors"
              >
                비밀번호를 잊으셨나요?
              </Link>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full py-3 rounded-lg font-medium transition-all"
              style={{
                background: 'linear-gradient(90deg, #2A5034 0%, #34B27B 100%)',
              }}
            >
              로그인
            </button>
          </form>

          {/* Register Link */}
          <div className="mt-8 text-center">
            <p className="text-white/60">
              계정이 없으신가요?{' '}
              <Link
                href="/register"
                className="text-[#34B27B] hover:text-[#2A5034] transition-colors font-medium"
              >
                회원가입
              </Link>
            </p>
          </div>
        </div>
      </main>
    </PageLayout>
  );
}
