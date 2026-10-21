import PageLayout from '@/components/PageLayout';
import { auth } from '@/auth';
import { getCategories } from '@/lib/categories';
import { getChallenges } from '@/lib/challenges';
import ChallengeBoard from './ChallengeBoard';

export const dynamic = 'force-dynamic';

type CtfPageProps = {
  searchParams: Promise<{ category?: string }>;
};

export default async function CtfPage({ searchParams }: CtfPageProps) {
  const { category } = await searchParams;
  const [session, categories] = await Promise.all([auth(), getCategories()]);
  const challenges = await getChallenges(session?.user?.id);

  return (
    <PageLayout>
      <ChallengeBoard initialCategory={category ?? 'all'} categories={categories} challenges={challenges} />
    </PageLayout>
  );
}
