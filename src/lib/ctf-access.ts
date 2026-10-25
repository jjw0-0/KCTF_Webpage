import { prisma } from '@/lib/prisma';

export type CtfAccess = { open: true } | { open: false; reason: string };

export async function getCtfAccess(ctfId: string): Promise<CtfAccess> {
  const ctf = await prisma.cTF.findUnique({
    where: { id: ctfId },
    select: { status: true, startTime: true, endTime: true },
  });
  if (!ctf) return { open: false, reason: '대회를 찾을 수 없습니다.' };

  const now = new Date();
  if (ctf.status === 'ENDED' || (ctf.endTime && now >= ctf.endTime)) {
    return { open: false, reason: '대회가 종료되었습니다.' };
  }
  if (ctf.status === 'PAUSED') return { open: false, reason: '대회가 일시 중지되었습니다.' };
  if (!['SCHEDULED', 'ONGOING'].includes(ctf.status) || (ctf.startTime && now < ctf.startTime)) {
    return { open: false, reason: '대회가 아직 시작되지 않았습니다.' };
  }
  return { open: true };
}
