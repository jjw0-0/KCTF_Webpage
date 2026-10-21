import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import PageLayout from '@/components/PageLayout';
import RegisterForm from './RegisterForm';

export default async function RegisterPage() {
  if ((await auth())?.user) redirect('/ctf');

  return (
    <PageLayout>
      <main className="auth-main">
        <section className="auth-panel">
          <header className="auth-heading">
            <p className="eyebrow">PLAYER REGISTRATION / KCTF 2026</p>
            <h1>회원가입</h1>
            <p>개인 계정을 만들고 KCTF에 참가하세요.</p>
          </header>
          <RegisterForm />
        </section>
      </main>
    </PageLayout>
  );
}
