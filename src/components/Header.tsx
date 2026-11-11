import Image from 'next/image';
import Link from 'next/link';
import { auth } from '@/auth';
import AuthMenu from '@/components/AuthMenu';
import ThemeToggle from '@/components/ThemeToggle';

export default async function Header() {
  const session = await auth();

  return (
    <header className="site-header">
      <Link href="/" className="header-brand" aria-label="KCTF 홈으로">
        <Image
          src="/kknock_logo.png"
          alt="K.knock"
          width={1751}
          height={358}
          priority
          className="brand-logo"
        />
      </Link>
      <nav className="header-primary" aria-label="주요 메뉴">
        <Link href="/ctf" className="header-link">
          Challenges
        </Link>
        <Link href="/scoreboard" className="header-link">
          Scoreboard
        </Link>
      </nav>
      <nav className="header-actions" aria-label="계정 및 화면 설정">
        <ThemeToggle />
        <AuthMenu username={session?.user?.username} isAdmin={session?.user?.role === 'ADMIN'} />
      </nav>
    </header>
  );
}
