/**
 * 공용 헤더 컴포넌트
 * 모든 페이지에서 사용되는 상단 네비게이션
 */
import Image from 'next/image';
import Link from 'next/link';
import { auth } from '@/auth';
import AuthMenu from '@/components/AuthMenu';

export default async function Header() {
  const session = await auth();

  return (
    <header className="site-header">
      <div className="flex items-center gap-10">
        <Link href="/" aria-label="KCTF 홈으로">
          <Image
            src="/kknock_logo.png"
            alt="K.knock"
            width={1751}
            height={358}
            priority
            className="brand-logo"
          />
        </Link>
        <span className="hidden lg:block h-5 w-px bg-white/15" />
        <Link href="/ctf" className="hidden lg:block text-xs tracking-[0.24em] text-white/55 hover:text-white">
          KCTF / 2026
        </Link>
      </div>
      <nav className="header-nav" aria-label="주요 메뉴">
        <Link href="/ctf" className="header-link">
          Challenges
        </Link>
        <Link href="/scoreboard" className="header-link">
          Scoreboard
        </Link>
        <AuthMenu username={session?.user?.username} isAdmin={session?.user?.role === 'ADMIN'} />
      </nav>
    </header>
  );
}
