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

export function deriveInstanceFlag(challengeId: string, userId: string | number, secret = process.env.INSTANCE_FLAG_SECRET || process.env.FLAG_SECRET) {
  if (!secret) throw new Error('INSTANCE_FLAG_SECRET or FLAG_SECRET is required.');
  const value = createHmac('sha256', secret).update(`${challengeId}\0${userId}`).digest('base64url').slice(0, 32);
  return `KCTF{${value}}`;
}

export function matchesInstanceFlag(
  flag: string,
  challengeId: string,
  userId: string | number,
  secret = process.env.INSTANCE_FLAG_SECRET || process.env.FLAG_SECRET,
) {
  const expected = deriveInstanceFlag(challengeId, userId, secret);
  const actualBytes = Buffer.from(flag.trim());
  const expectedBytes = Buffer.from(expected);
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}
