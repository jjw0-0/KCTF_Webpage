import PageLayout from '@/components/PageLayout';
import ChallengeBoard from './ChallengeBoard';

type CtfPageProps = {
  searchParams: Promise<{ category?: string }>;
};

export default async function CtfPage({ searchParams }: CtfPageProps) {
  const { category } = await searchParams;

  return (
    <PageLayout>
      <ChallengeBoard initialCategory={category ?? 'all'} />
    </PageLayout>
  );
}
