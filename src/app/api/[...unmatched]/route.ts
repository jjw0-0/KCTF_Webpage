import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  formatActor,
  isSensitivePathProbe,
  recordServerLog,
} from '@/lib/admin-logs';

type RouteContext = { params: Promise<{ unmatched?: string[] }> };

async function handleUnmatchedApi(request: NextRequest, { params }: RouteContext) {
  const [{ unmatched = [] }, session] = await Promise.all([params, auth()]);
  const rawPath = '/api/' + unmatched.join('/');
  const actor = session?.user
    ? formatActor({
        id: session.user.id,
        username: session.user.username,
        email: session.user.email,
      })
    : 'anonymous';
  const sensitive = isSensitivePathProbe(rawPath);

  recordServerLog({
    level: sensitive ? 'ERROR' : 'WARN',
    source: 'HTTP',
    action: 'API_NOT_FOUND_PROBE',
    actor,
    actorId: session?.user?.id,
    request,
    statusCode: 404,
    message: `존재하지 않는 API 엔드포인트 접근 시도 (404): ${actor} → ${request.method} ${rawPath}`,
    params: {
      targetPath: rawPath,
      method: request.method,
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

  return NextResponse.json({ error: 'Not Found' }, { status: 404 });
}

export const GET = handleUnmatchedApi;
export const POST = handleUnmatchedApi;
export const PUT = handleUnmatchedApi;
export const DELETE = handleUnmatchedApi;
export const PATCH = handleUnmatchedApi;
