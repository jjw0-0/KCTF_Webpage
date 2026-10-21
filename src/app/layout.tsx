/**
 * 루트 레이아웃
 * 모든 페이지에 공통으로 적용되는 HTML 구조와 메타데이터를 정의
 */
import type { Metadata } from 'next';
import { CategoryProvider } from '@/components/CategoryProvider';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'KCTF 2026 — K.knock',
    template: '%s — KCTF',
  },
  description: '경기대학교 정보보안 동아리 K.knock의 CTF 플랫폼',
  icons: {
    icon: '/kknock_favicon.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">
        <CategoryProvider>{children}</CategoryProvider>
      </body>
    </html>
  );
}
