import { timingSafeEqual } from 'node:crypto';

export function matchesPlainFlag(flag: string, expectedFlag: string): boolean {
  const actual = Buffer.from(flag.trim());
  const expected = Buffer.from(expectedFlag);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
