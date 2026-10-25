import { z } from 'zod';
import { ACTIVE_CTF_ID } from '@/lib/categories';
import { prisma } from '@/lib/prisma';

export const CTF_TIME_ZONE = 'Asia/Seoul';
export const CTF_STATUS_VALUES = ['DRAFT', 'SCHEDULED', 'ONGOING', 'PAUSED', 'ENDED'] as const;

const localDateTime = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, '날짜와 시간을 확인해 주세요.')
  .refine((value) => !Number.isNaN(parseKoreanLocalDateTime(value).getTime()), '유효한 날짜와 시간을 입력해 주세요.');

export const ctfScheduleInputSchema = z.object({
  status: z.enum(CTF_STATUS_VALUES),
  startTime: localDateTime,
  endTime: localDateTime,
}).superRefine((value, context) => {
  if (parseKoreanLocalDateTime(value.endTime) <= parseKoreanLocalDateTime(value.startTime)) {
    context.addIssue({ code: 'custom', path: ['endTime'], message: '종료 시각은 시작 시각보다 늦어야 합니다.' });
  }
});

export type CtfSchedule = {
  status: typeof CTF_STATUS_VALUES[number];
  startTime: string;
  endTime: string;
  startLabel: string;
  endLabel: string;
};

export function parseKoreanLocalDateTime(value: string) {
  return new Date(`${value}:00+09:00`);
}

function dateParts(date: Date) {
  return Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: CTF_TIME_ZONE,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
}

export function toKoreanLocalDateTime(date: Date) {
  const parts = dateParts(date);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function formatEventDate(date: Date) {
  const parts = dateParts(date);
  return `${parts.year}.${parts.month}.${parts.day}`;
}

export async function getCtfSchedule(): Promise<CtfSchedule> {
  const ctf = await prisma.cTF.findUnique({
    where: { id: ACTIVE_CTF_ID },
    select: { status: true, startTime: true, endTime: true },
  });
  const start = ctf?.startTime ?? new Date('2026-12-10T01:00:00.000Z');
  const end = ctf?.endTime ?? new Date('2026-12-13T13:00:00.000Z');
  return {
    status: ctf?.status ?? 'SCHEDULED',
    startTime: toKoreanLocalDateTime(start),
    endTime: toKoreanLocalDateTime(end),
    startLabel: formatEventDate(start),
    endLabel: formatEventDate(end),
  };
}
