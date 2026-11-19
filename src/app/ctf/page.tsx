import { redirect } from 'next/navigation';

type LegacyCtfPageProps = {
  searchParams: Promise<{ category?: string; challenge?: string; modalLayout?: string }>;
};

export default async function LegacyCtfPage({ searchParams }: LegacyCtfPageProps) {
  const { category, challenge, modalLayout } = await searchParams;
  const params = new URLSearchParams();
  if (category) params.set('category', category);
  if (challenge) params.set('challenge', challenge);
  if (modalLayout === 'single') params.set('modalLayout', modalLayout);
  redirect(params.size ? `/challenges?${params.toString()}` : '/challenges');
}
