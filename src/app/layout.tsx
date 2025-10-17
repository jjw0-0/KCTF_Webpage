/**
 * 루트 레이아웃
 * 모든 페이지에 공통으로 적용되는 HTML 구조와 메타데이터를 정의
 */
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'KCTF',
  description: 'KCTF 플랫폼으로, 공정하고 효율적인 대회 운영을 지원합니다.',
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
      <body className="antialiased">{children}</body>
    </html>
  );
}
