/**
 * 공용 헤더 컴포넌트
 * 모든 페이지에서 사용되는 상단 네비게이션
 */
import Image from 'next/image';
import Link from 'next/link';

export default function Header() {
  return (
    <header className="h-20 flex items-center justify-between px-6">
      <div className="flex items-center">
        <Link href="/">
          <Image
            src="/kknock_logo.png"
            alt="KNOCK Logo"
            width={120}
            height={40}
            className="h-10 w-auto cursor-pointer"
          />
        </Link>
      </div>
      <nav className="flex items-center gap-6 text-base font-medium">
        <Link
          href="/admin"
          className="text-white hover:text-[#34B27B] transition-colors"
        >
          Admin
        </Link>
        <Link
          href="/profile"
          className="text-white hover:text-[#34B27B] transition-colors"
        >
          Profile
        </Link>
        <Link
          href="/logout"
          className="text-white hover:text-[#34B27B] transition-colors"
        >
          Logout
        </Link>
      </nav>
    </header>
  );
}
