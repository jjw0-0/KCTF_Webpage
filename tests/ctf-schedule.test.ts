import assert from 'node:assert/strict';
import test from 'node:test';
import { ctfScheduleInputSchema, formatEventDate, parseKoreanLocalDateTime, toKoreanLocalDateTime } from '../src/lib/ctf-schedule.ts';

test('Korean event times round-trip without browser timezone ambiguity', () => {
  const date = parseKoreanLocalDateTime('2026-12-10T10:30');
  assert.equal(date.toISOString(), '2026-12-10T01:30:00.000Z');
  assert.equal(toKoreanLocalDateTime(date), '2026-12-10T10:30');
  assert.equal(formatEventDate(date), '2026.12.10');
});

test('schedule validation rejects an end before the start', () => {
  assert.equal(ctfScheduleInputSchema.safeParse({ status: 'SCHEDULED', startTime: '2026-12-10T10:00', endTime: '2026-12-13T22:00' }).success, true);
  assert.equal(ctfScheduleInputSchema.safeParse({ status: 'SCHEDULED', startTime: '2026-12-13T22:00', endTime: '2026-12-10T10:00' }).success, false);
});

test('schedule validation rejects impossible calendar values', () => {
  assert.equal(ctfScheduleInputSchema.safeParse({ status: 'SCHEDULED', startTime: '2026-13-40T27:90', endTime: '2026-12-13T22:00' }).success, false);
});
