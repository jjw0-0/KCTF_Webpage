/**
 * 페이지 레이아웃 컴포넌트
 * KCTF 브랜드 그라디언트 배경과 Header, Footer를 포함하는 공통 레이아웃
 */
import Header from '@/components/Header';
import Footer from '@/components/Footer';

interface PageLayoutProps {
  children: React.ReactNode;
}

export default function PageLayout({ children }: PageLayoutProps) {
  return (
    <>
      <Header />
      {children}
      <Footer />
    </>
  );
}
