/**
 * 홈페이지 (랜딩 페이지)
 * 사용자가 처음 접속했을 때 보이는 메인 화면
 */
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function HomePage() {
  return (
    <div
      className="min-h-screen text-white font-inter flex flex-col"
      style={{
        background: 'linear-gradient(180deg, #030303 50%, #3D3D3D 100%)',
      }}
    >
      <Header />

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-start pt-48">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-32 mb-40">
          {/* Left Section - KCTF Title and Date */}
          <div className="flex flex-col items-center justify-center px-8">
            <div className="text-center">
              <h1
                className="text-[150px] leading-none mb-2 font-kctf"
                style={{
                  background: 'var(--kctf-primary-gradient)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                KCTF
              </h1>
              <div className="flex items-center justify-center gap-4 text-base text-[#34B27B]">
              <span>2025.12.10</span>
              <span>~</span>
              <span>2025.12.13</span>
              </div>
            </div>
          </div>

          {/* Right Section - Category */}
          <div className="flex flex-col items-center justify-center px-8">
            <div className="w-full max-w-md">
            <h2 className="text-left mb-6 text-base">
                <span className="inline-block pb-2 border-b border-[#34B27B]">
                  category
                </span>
              </h2>
              <div className="grid grid-cols-4 gap-y-4 text-left text-base">
                <button className="p-0 m-0 bg-transparent border-0 text-left hover:text-[#34B27B] hover:scale-[1.15] transition-all origin-left">web</button>
                <button className="p-0 m-0 bg-transparent border-0 text-left hover:text-[#34B27B] hover:scale-[1.15] transition-all origin-left">pwn</button>
                <button className="p-0 m-0 bg-transparent border-0 text-left hover:text-[#34B27B] hover:scale-[1.15] transition-all origin-left">rev</button>
                <button className="p-0 m-0 bg-transparent border-0 text-left hover:text-[#34B27B] hover:scale-[1.15] transition-all origin-left">crypto</button>
                <button className="p-0 m-0 bg-transparent border-0 text-left hover:text-[#34B27B] hover:scale-[1.15] transition-all origin-left">AI</button>
                <button className="p-0 m-0 bg-transparent border-0 text-left hover:text-[#34B27B] hover:scale-[1.15] transition-all origin-left">web3</button>
                <button className="p-0 m-0 bg-transparent border-0 text-left hover:text-[#34B27B] hover:scale-[1.15] transition-all origin-left">misc</button>
              </div>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="mt-32">
          <div className="flex items-center justify-center gap-4">
            <Link
              href="/login"
              className="text-white text-lg rounded-lg cta-button-hover"
            >
              로그인
            </Link>
            <Link
              href="/ctf"
              className="text-white text-lg rounded-lg cta-button-hover"
            >
              참가하기 →
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
