import { redirect } from 'next/navigation';
import PageLayout from '@/components/PageLayout';
import { auth } from '@/auth';
import LoginForm from './LoginForm';

type LoginPageProps = { searchParams: Promise<{ callbackUrl?: string }> };

function safeCallbackUrl(value?: string) {
  if (!value) return '/ctf';
  try {
    const base = 'https://kctf.invalid';
    const parsed = new URL(value, base);
    if (parsed.origin !== base) return '/ctf';
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return '/ctf';
  }
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await auth();
  const { callbackUrl } = await searchParams;
  const destination = safeCallbackUrl(callbackUrl);
  if (session?.user) redirect(destination);

  return (
    <PageLayout>
      <main className="auth-main">
        <section className="auth-panel">
          <header className="auth-heading">
            <p className="eyebrow">KCTF 2026 / LOGIN</p>
            <h1>로그인</h1>
          </header>
          <LoginForm callbackUrl={destination} />
        </section>
      </main>
    </PageLayout>
  );
}
