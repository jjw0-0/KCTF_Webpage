import { redirect } from 'next/navigation';
import PageLayout from '@/components/PageLayout';
import { auth } from '@/auth';
import LoginForm from './LoginForm';

type LoginPageProps = { searchParams: Promise<{ callbackUrl?: string }> };

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await auth();
  const { callbackUrl } = await searchParams;
  const destination = callbackUrl?.startsWith('/') && !callbackUrl.startsWith('//') ? callbackUrl : '/ctf';
  if (session?.user) redirect(destination);

  return (
    <PageLayout>
      <main className="auth-main">
        <section className="auth-panel">
          <header className="auth-heading">
            <p className="eyebrow">SECURE ACCESS / KCTF 2026</p>
            <h1>로그인</h1>
            <p>계정으로 돌아와 문제 풀이를 이어가세요.</p>
          </header>
          <LoginForm callbackUrl={destination} />
        </section>
      </main>
    </PageLayout>
  );
}
