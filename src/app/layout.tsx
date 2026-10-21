/**
 * 루트 레이아웃
 * 모든 페이지에 공통으로 적용되는 HTML 구조와 메타데이터를 정의
 */
import type { Metadata } from 'next';
import { Black_Ops_One, IBM_Plex_Mono, IBM_Plex_Sans_KR } from 'next/font/google';
import './globals.css';

const sans = IBM_Plex_Sans_KR({
  weight: ['400', '500', '600', '700'],
  style: 'normal',
  display: 'swap',
  variable: '--font-sans',
  preload: false,
});

const mono = IBM_Plex_Mono({
  weight: ['400', '500', '600'],
  style: 'normal',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mono',
});

const display = Black_Ops_One({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display',
});

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
      <body className={`${sans.variable} ${mono.variable} ${display.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
