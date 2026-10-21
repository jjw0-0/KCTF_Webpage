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
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-2">로그인</h1>
            <p className="text-white/60">KCTF에 오신 것을 환영합니다</p>
          </div>
          <LoginForm callbackUrl={destination} />
        </div>
      </main>
    </PageLayout>
  );
}
