import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { formatActor, recordServerLog } from '@/lib/admin-logs';
import { prisma } from '@/lib/prisma';
import { consumeRateLimit, rateLimitHeaders } from '@/lib/rate-limit';
import { isValidAvatar, MAX_AVATAR_BYTES, readBoundedFormData } from '@/lib/uploads';

async function currentUserId() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, username: true, email: true, isActive: true },
  });
  return user?.isActive ? user : null;
}

export async function POST(request: NextRequest) {
  const user = await currentUserId();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const actor = formatActor(user);
  const limit = consumeRateLimit(`avatar:${user.id}`, 10, 10 * 60_000);
  if (!limit.allowed) {
    return NextResponse.json({ error: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' }, { status: 429, headers: rateLimitHeaders(limit) });
  }

  const parsedForm = await readBoundedFormData(request, MAX_AVATAR_BYTES);
  if (parsedForm.status === 'too_large') {
    return NextResponse.json({ error: '프로필 이미지는 10MB 이하여야 합니다.' }, { status: 413, headers: rateLimitHeaders(limit) });
  }

  const file = parsedForm.status === 'ok' ? parsedForm.formData.get('file') : null;
  if (!(file instanceof File) || !file.size) {
    return NextResponse.json({ error: '업로드할 이미지를 선택해 주세요.' }, { status: 400, headers: rateLimitHeaders(limit) });
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return NextResponse.json({ error: '프로필 이미지는 10MB 이하여야 합니다.' }, { status: 413, headers: rateLimitHeaders(limit) });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!isValidAvatar(bytes, file.type)) {
    recordServerLog({
      level: 'WARN',
      source: 'USER',
      action: 'AVATAR_INVALID_MIME',
      actor,
      actorId: user.id,
      request,
      statusCode: 400,
      message: `허용되지 않은 프로필 이미지 매직바이트 업로드 차단: ${actor} (${file.name})`,
      params: {
        fileName: file.name,
        claimedMime: file.type,
        fileSize: file.size,
      },
    });
    return NextResponse.json({ error: 'PNG, JPG, WEBP 이미지만 사용할 수 있습니다.' }, { status: 400, headers: rateLimitHeaders(limit) });
  }

  const avatarData = `data:${file.type};base64,${Buffer.from(bytes).toString('base64')}`;
  await prisma.user.update({ where: { id: user.id }, data: { avatarData } });
  revalidatePath('/profile');

  recordServerLog({
    level: 'INFO',
    source: 'USER',
    action: 'AVATAR_UPDATE',
    actor,
    actorId: user.id,
    request,
    statusCode: 200,
    message: `프로필 이미지 변경: ${actor} (${file.name}, ${file.type}, ${file.size} bytes)`,
    params: {
      fileName: file.name,
      mimeType: file.type,
      fileSize: file.size,
    },
  });

  return NextResponse.json({ avatarData }, { headers: rateLimitHeaders(limit) });
}

export async function DELETE(request: NextRequest) {
  const user = await currentUserId();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  await prisma.user.update({ where: { id: user.id }, data: { avatarData: null } });
  revalidatePath('/profile');

  recordServerLog({
    level: 'INFO',
    source: 'USER',
    action: 'AVATAR_DELETE',
    actor: formatActor(user),
    actorId: user.id,
    request,
    statusCode: 200,
    message: `프로필 이미지 삭제: ${formatActor(user)}`,
  });

  return NextResponse.json({ avatarData: null });
}
