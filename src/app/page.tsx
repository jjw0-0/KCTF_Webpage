/**
 * 홈페이지 (랜딩 페이지)
 * 사용자가 처음 접속했을 때 보이는 메인 화면
 */
import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-24">
      <main className="flex flex-col items-center gap-8">
        <h1 className="text-4xl font-bold">KCTF</h1>
        <p className="text-xl text-muted-foreground">
          공정하고 효율적인 대회 운영을 지원합니다.
        </p>
        <div className="flex gap-4">
          <Link
            href="/login"
            className="rounded-lg bg-primary px-6 py-3 text-primary-foreground hover:opacity-90"
          >
            로그인
          </Link>
          <Link
            href="/register"
            className="rounded-lg border border-border px-6 py-3 hover:bg-accent"
          >
            회원가입
          </Link>
        </div>
      </main>
    </div>
  );
}
