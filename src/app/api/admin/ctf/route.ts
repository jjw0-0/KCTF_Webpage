import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdminUser } from '@/lib/admin-auth';
import { formatActor, recordServerLog } from '@/lib/admin-logs';
import { ACTIVE_CTF_ID } from '@/lib/categories';
import { ctfScheduleInputSchema, getCtfSchedule, parseKoreanLocalDateTime } from '@/lib/ctf-schedule';
import { removeAllOwnerInstances } from '@/lib/owner-instance';
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
      statusCode: 404,
      message: '권한 없는 사용자의 대회 일정 수정 시도 차단',
    });
    return NextResponse.json({ error: '페이지를 찾을 수 없습니다.' }, { status: 404 });
  }

  const parsed = ctfScheduleInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? '일정을 확인해 주세요.' }, { status: 400 });
  }

  const current = await prisma.cTF.findUnique({ where: { id: ACTIVE_CTF_ID }, select: { mode: true } });
  if (!current) return NextResponse.json({ error: '대회를 찾을 수 없습니다.' }, { status: 404 });
  if (current.mode !== parsed.data.mode) await removeAllOwnerInstances();

  await prisma.cTF.update({
    where: { id: ACTIVE_CTF_ID },
    data: {
      mode: parsed.data.mode,
      status: parsed.data.status,
      startTime: parseKoreanLocalDateTime(parsed.data.startTime),
      endTime: parseKoreanLocalDateTime(parsed.data.endTime),
    },
  });
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
      mode: parsed.data.mode,
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
