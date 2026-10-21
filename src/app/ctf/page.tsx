import PageLayout from '@/components/PageLayout';
import { getCategories } from '@/lib/categories';
import ChallengeBoard from './ChallengeBoard';

export const dynamic = 'force-dynamic';

type CtfPageProps = {
  searchParams: Promise<{ category?: string }>;
};

export default async function CtfPage({ searchParams }: CtfPageProps) {
  const { category } = await searchParams;
  const categories = await getCategories();

  return (
    <PageLayout>
      <ChallengeBoard initialCategory={category ?? 'all'} categories={categories} />
    </PageLayout>
  );
}
