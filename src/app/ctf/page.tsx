import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import PageLayout from '@/components/PageLayout';
import { auth } from '@/auth';
import { extractHeadersMeta, recordServerLog } from '@/lib/admin-logs';
import { getCategories } from '@/lib/categories';
import { getChallenges } from '@/lib/challenges';
import { getCtfSchedule } from '@/lib/ctf-schedule';
import ChallengeBoard from './ChallengeBoard';

export const dynamic = 'force-dynamic';

type CtfPageProps = {
  searchParams: Promise<{ category?: string; challenge?: string }>;
};

export default async function CtfPage({ searchParams }: CtfPageProps) {
  const { category, challenge } = await searchParams;
  const [session, categories, schedule, hdrs] = await Promise.all([
    auth(),
    getCategories(),
    getCtfSchedule(),
    headers(),
  ]);
  if (!session?.user?.id) {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (challenge) params.set('challenge', challenge);
    const callbackUrl = params.size ? `/ctf?${params.toString()}` : '/ctf';
    const meta = extractHeadersMeta(hdrs, 'GET', callbackUrl);
    recordServerLog({
      level: 'WARN',
      source: 'HTTP',
      action: 'CTF_ACCESS_UNAUTHORIZED',
      actor: 'anonymous',
      ip: meta.ip,
      userAgent: meta.userAgent,
      method: 'GET',
      path: callbackUrl,
      statusCode: 307,
      message: `비로그인 사용자의 문제 페이지(${callbackUrl}) 접근 시도 차단 → /login 리다이렉트`,
      params: {
        targetPath: callbackUrl,
        redirectedTo: `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`,
        ...(meta.referer ? { referer: meta.referer } : {}),
      },
    });
    redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }

  const challenges = await getChallenges(session.user.id);

  return (
    <PageLayout>
      <ChallengeBoard
        initialCategory={category ?? 'all'}
        initialChallengeId={challenge}
        schedule={schedule}
        isAuthenticated
        categories={categories}
        challenges={challenges}
      />
    </PageLayout>
  );
}
