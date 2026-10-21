import PageLayout from '@/components/PageLayout';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getCategories } from '@/lib/categories';
import { getAdminChallenges } from '@/lib/challenges';
import AdminDashboard from './AdminDashboard';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user) redirect('/login?callbackUrl=/admin');
  if (session.user.role !== 'ADMIN') redirect('/access-denied');
  const [categories, challenges] = await Promise.all([getCategories(), getAdminChallenges()]);

  return (
    <PageLayout>
      <AdminDashboard initialCategories={categories} initialChallenges={challenges} />
    </PageLayout>
  );
}
