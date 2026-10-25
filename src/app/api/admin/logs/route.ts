import { NextResponse } from 'next/server';
import { isCurrentUserAdmin } from '@/lib/admin-auth';
import { getAdminLogs, recordServerLog } from '@/lib/admin-logs';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await isCurrentUserAdmin())) {
    recordServerLog({
      level: 'WARN',
      source: 'ADMIN',
      message: 'GET /api/admin/logs 403 — Unauthorized admin log access attempt',
    });
    return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
  }

  const logs = await getAdminLogs();
  return NextResponse.json(logs);
}
