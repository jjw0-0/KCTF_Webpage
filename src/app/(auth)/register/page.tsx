import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import PageLayout from '@/components/PageLayout';
import RegisterForm from './RegisterForm';

export default async function RegisterPage() {
  if ((await auth())?.user) redirect('/ctf');

  return (
    <PageLayout>
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-2">회원가입</h1>
            <p className="text-white/60">KCTF에 참가하세요</p>
          </div>
          <RegisterForm />
        </div>
      </main>
    </PageLayout>
  );
}
