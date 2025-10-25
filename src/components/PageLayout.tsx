/**
 * 페이지 레이아웃 컴포넌트
 * KCTF 브랜드 그라디언트 배경과 Header, Footer를 포함하는 공통 레이아웃
 */
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import NetworkBackground from '@/components/NetworkBackground';

interface PageLayoutProps {
  children: React.ReactNode;
}

export default function PageLayout({ children }: PageLayoutProps) {
  return (
    <div
      className="min-h-screen text-white flex flex-col relative"
      style={{
        background: 'linear-gradient(180deg, #030303 50%, #1F1F1F 100%)',
      }}
    >
      <NetworkBackground />
      <div className="relative z-10 flex flex-col flex-1">
        <Header />
        {children}
        <Footer />
      </div>
    </div>
  );
}
