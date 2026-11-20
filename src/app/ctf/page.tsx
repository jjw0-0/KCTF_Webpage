import { redirect } from 'next/navigation';

type LegacyCtfPageProps = {
  searchParams: Promise<{ category?: string; challenge?: string }>;
};

export default async function LegacyCtfPage({ searchParams }: LegacyCtfPageProps) {
  const { category, challenge } = await searchParams;
  const params = new URLSearchParams();
  if (category) params.set('category', category);
  if (challenge) params.set('challenge', challenge);
  redirect(params.size ? `/challenges?${params.toString()}` : '/challenges');
}
