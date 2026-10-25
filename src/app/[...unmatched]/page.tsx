import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { auth } from '@/auth';
import {
  extractHeadersMeta,
  formatActor,
  isSensitivePathProbe,
  recordServerLog,
} from '@/lib/admin-logs';

export const dynamic = 'force-dynamic';

type UnmatchedPageProps = {
  params: Promise<{ unmatched?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function UnmatchedRoutePage({
  params,
  searchParams,
}: UnmatchedPageProps) {
  const [{ unmatched = [] }, queryObj, session, hdrs] = await Promise.all([
    params,
    searchParams,
    auth(),
    headers(),
  ]);

  const rawPath = '/' + unmatched.map((seg) => decodeURIComponent(seg)).join('/');
  const queryEntries = Object.entries(queryObj).filter(([, v]) => v !== undefined);
  const queryString =
    queryEntries.length > 0
      ? '?' +
        queryEntries
          .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(Array.isArray(v) ? v.join(',') : String(v))}`)
          .join('&')
      : '';
  const fullPath = `${rawPath}${queryString}`;

  const actor = session?.user
    ? formatActor({
        id: session.user.id,
        username: session.user.username,
        email: session.user.email,
      })
    : 'anonymous';

  const meta = extractHeadersMeta(hdrs, 'GET', fullPath);
  const sensitive = isSensitivePathProbe(rawPath);

  recordServerLog({
    level: sensitive ? 'ERROR' : 'WARN',
    source: 'HTTP',
    action: sensitive ? 'SECURITY_PATH_PROBE' : 'HTTP_NOT_FOUND',
    actor,
    actorId: session?.user?.id,
    ip: meta.ip,
    userAgent: meta.userAgent,
    method: 'GET',
    path: fullPath,
    statusCode: 404,
    message: sensitive
      ? `민감 경로/스캐닝 접근 시도 탐지 (404 차단): ${actor} → ${fullPath}`
      : `존재하지 않는 경로(404) 접근 시도: ${actor} → ${fullPath}`,
    params: {
      targetPath: rawPath,
       ...(queryEntries.length > 0 ? { query: queryObj } : {}),
      ...(meta.referer ? { referer: meta.referer } : {}),
      sensitiveProbe: sensitive,
      user: session?.user
        ? {
            id: session.user.id,
            username: session.user.username,
            email: session.user.email,
            role: session.user.role,
          }
        : 'anonymous',
    },
  });

  notFound();
}
