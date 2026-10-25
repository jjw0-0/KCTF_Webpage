import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  getIpv6Prefix64,
  getRawConnectingIp,
  isValidIpv4,
  registerClientIpv4,
} from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const ipv4 = typeof body?.ipv4 === 'string' ? body.ipv4.trim() : '';
  if (!isValidIpv4(ipv4)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const rawIp = getRawConnectingIp(request.headers);
  registerClientIpv4(rawIp, ipv4);

  const prefix64 = getIpv6Prefix64(rawIp);

  // Retroactively update existing audit_logs rows that recorded the raw IPv6 address
  try {
    if (typeof prisma.$executeRawUnsafe === 'function') {
      if (prefix64) {
        await prisma.$executeRawUnsafe(
          `UPDATE "audit_logs" SET "ip" = $1 WHERE "ip" = $2 OR "ip" LIKE $3`,
          ipv4,
          rawIp,
          `${prefix64}:%`,
        );
      } else {
        await prisma.$executeRawUnsafe(
          `UPDATE "audit_logs" SET "ip" = $1 WHERE "ip" = $2`,
          ipv4,
          rawIp,
        );
      }
    }
  } catch {
    // Ignore DB update errors
  }

  const response = NextResponse.json({ ok: true, ipv4 });
  response.cookies.set('kctf_ipv4', ipv4, {
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
    sameSite: 'lax',
  });
  return response;
}
