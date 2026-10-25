import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import PageLayout from '@/components/PageLayout';
import { auth } from '@/auth';
import { getCurrentAdminUser } from '@/lib/admin-auth';
import {
  extractHeadersMeta,
  formatActor,
  getAdminLogs,
  recordServerLog,
} from '@/lib/admin-logs';
import { getCategories } from '@/lib/categories';
import { getAdminChallenges } from '@/lib/challenges';
import { getCtfSchedule } from '@/lib/ctf-schedule';
import AdminDashboard from './AdminDashboard';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const [session, adminUser, hdrs] = await Promise.all([auth(), getCurrentAdminUser(), headers()]);
  const meta = extractHeadersMeta(hdrs, 'GET', '/admin');

  if (!session?.user) {
    recordServerLog({
      level: 'WARN',
      source: 'HTTP',
      action: 'ADMIN_ACCESS_UNAUTHORIZED',
      actor: 'anonymous',
      ip: meta.ip,
      userAgent: meta.userAgent,
      method: 'GET',
      path: '/admin',
      statusCode: 307,
      message: '비로그인 사용자의 관리자 페이지(/admin) 접근 시도 차단 → /login 리다이렉트',
      params: {
        targetPath: '/admin',
        redirectedTo: '/login?callbackUrl=/admin',
        ...(meta.referer ? { referer: meta.referer } : {}),
      },
    });
    redirect('/login?callbackUrl=/admin');
  }

  const actor = formatActor({
    id: session.user.id,
    username: session.user.username,
    email: session.user.email,
  });

  if (!adminUser) {
    recordServerLog({
      level: 'ERROR',
      source: 'HTTP',
      action: 'ADMIN_ACCESS_FORBIDDEN',
      actor,
      actorId: session.user.id,
      ip: meta.ip,
      userAgent: meta.userAgent,
      method: 'GET',
      path: '/admin',
      statusCode: 403,
      message: `권한 없는 사용자의 관리자 페이지(/admin) 무단 접근 시도 차단: ${actor}`,
      params: {
        targetPath: '/admin',
        redirectedTo: '/access-denied',
        user: {
          id: session.user.id,
          username: session.user.username,
          email: session.user.email,
          role: session.user.role,
        },
        ...(meta.referer ? { referer: meta.referer } : {}),
      },
    });
    redirect('/access-denied');
  }

  const [categories, challenges, schedule, logs] = await Promise.all([
    getCategories(),
    getAdminChallenges(),
    getCtfSchedule(),
    getAdminLogs(),
  ]);

  return (
    <PageLayout>
      <AdminDashboard
        initialCategories={categories}
        initialChallenges={challenges}
        initialSchedule={schedule}
        initialLogs={logs}
      />
    </PageLayout>
  );
}
