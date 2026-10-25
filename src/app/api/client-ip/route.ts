import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  consumeRateLimit,
  getRateLimitAddress,
  getRawConnectingIp,
  isPublicIpv4,
  registerClientIpv4,
} from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  const limitKey = getRateLimitAddress(request.headers);
  const limit = consumeRateLimit(`client-ip:${limitKey}`, 10, 60_000);
  if (!limit.allowed) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const ipv4 = typeof body?.ipv4 === 'string' ? body.ipv4.trim() : '';
  if (!isPublicIpv4(ipv4)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const rawIp = getRawConnectingIp(request.headers);
  registerClientIpv4(rawIp, ipv4);

  // Only backfill recent audit_logs rows that recorded this exact IPv6 address within the last 5 minutes
  if (rawIp.includes(':')) {
    try {
      if (typeof prisma.$executeRawUnsafe === 'function') {
        await prisma.$executeRawUnsafe(
          `UPDATE "audit_logs" SET "ip" = $1 WHERE "ip" = $2 AND "timestamp" >= NOW() - INTERVAL '5 minutes'`,
          ipv4,
          rawIp,
        );
      }
    } catch {
      // Ignore DB update errors
    }
  }

  const response = NextResponse.json({ ok: true, ipv4 });
  response.cookies.set('kctf_ipv4', ipv4, {
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
    sameSite: 'lax',
  });
  return response;
}
