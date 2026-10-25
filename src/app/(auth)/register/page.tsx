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
            <p className="eyebrow">KCTF 2026 / REGISTER</p>
            <h1>회원가입</h1>
          </header>
          <RegisterForm />
        </section>
      </main>
    </PageLayout>
  );
}
