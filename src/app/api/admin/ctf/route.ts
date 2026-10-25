import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdminUser } from '@/lib/admin-auth';
import { formatActor, recordServerLog } from '@/lib/admin-logs';
import { ACTIVE_CTF_ID } from '@/lib/categories';
import { ctfScheduleInputSchema, getCtfSchedule, parseKoreanLocalDateTime } from '@/lib/ctf-schedule';
import { prisma } from '@/lib/prisma';

export async function PUT(request: NextRequest) {
  const admin = await getCurrentAdminUser();
  if (!admin) {
    recordServerLog({
      level: 'WARN',
      source: 'ADMIN',
      action: 'ADMIN_SCHEDULE_DENIED',
      actor: 'unauthorized',
      request,
      statusCode: 403,
      message: '권한 없는 사용자의 대회 일정 수정 시도 차단',
    });
    return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
  }

  const parsed = ctfScheduleInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? '일정을 확인해 주세요.' }, { status: 400 });
  }

  const updated = await prisma.cTF.updateMany({
    where: { id: ACTIVE_CTF_ID },
    data: {
      status: parsed.data.status,
      startTime: parseKoreanLocalDateTime(parsed.data.startTime),
      endTime: parseKoreanLocalDateTime(parsed.data.endTime),
    },
  });
  if (!updated.count) return NextResponse.json({ error: '대회를 찾을 수 없습니다.' }, { status: 404 });

  const actor = formatActor(admin);
  recordServerLog({
    level: 'INFO',
    source: 'ADMIN',
    action: 'ADMIN_SCHEDULE_UPDATE',
    actor,
    actorId: admin.id,
    request,
    statusCode: 200,
    message: `관리자 대회 일정/상태 변경: ${actor} → status=${parsed.data.status}`,
    params: {
      status: parsed.data.status,
      startTime: parsed.data.startTime,
      endTime: parsed.data.endTime,
    },
  });

  revalidatePath('/');
  revalidatePath('/ctf');
  revalidatePath('/admin');
  return NextResponse.json({ schedule: await getCtfSchedule() });
}
