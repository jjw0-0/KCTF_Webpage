import { createHmac, timingSafeEqual } from 'node:crypto';

export function digestFlag(flag: string, secret = process.env.FLAG_SECRET): string {
  if (!secret) throw new Error('FLAG_SECRET is required.');
  return createHmac('sha256', secret).update(flag.trim()).digest('hex');
}

export function matchesFlag(flag: string, expectedDigest: string, secret = process.env.FLAG_SECRET): boolean {
  const actual = Buffer.from(digestFlag(flag, secret), 'hex');
  const expected = Buffer.from(expectedDigest, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
