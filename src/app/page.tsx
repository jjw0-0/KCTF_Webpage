/**
 * 홈페이지 (랜딩 페이지)
 * 사용자가 처음 접속했을 때 보이는 메인 화면
 */
import Link from 'next/link';
import PageLayout from '@/components/PageLayout';

export default function HomePage() {
  return (
    <PageLayout>
      <main className="flex-1 flex flex-col items-center justify-between py-[15vh] px-[5vw]">
        {/* Split Section - KCTF Title and Category */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-32 w-full max-w-7xl">
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
              {/* <div className="flex items-center justify-center gap-4">
                <span className="text-base text-[#34B27B] font-kctf">2025 생존게임</span>
              </div> */}
              <div className="flex items-center justify-center gap-4 text-base text-[#34B27B] font-kctf">
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
        <div className="w-full max-w-7xl">
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
    </PageLayout>
  );
}
