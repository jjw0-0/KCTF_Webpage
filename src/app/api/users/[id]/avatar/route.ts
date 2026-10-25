import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { decodeAvatarDataUrl } from '@/lib/uploads';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const user = await prisma.user.findFirst({
    where: { id, role: 'USER', isActive: true },
    select: { avatarData: true },
  });
  const avatar = user?.avatarData ? decodeAvatarDataUrl(user.avatarData) : null;
  if (!avatar) return NextResponse.json({ error: '이미지를 찾을 수 없습니다.' }, { status: 404 });

  return new Response(avatar.bytes, {
    headers: {
      'Content-Type': avatar.contentType,
      'Content-Length': String(avatar.bytes.byteLength),
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
