import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { formatActor, recordServerLog } from '@/lib/admin-logs';
import { ACTIVE_CTF_ID } from '@/lib/categories';
import { getCtfAccess } from '@/lib/ctf-access';
import { prisma } from '@/lib/prisma';
import { safeDownloadName } from '@/lib/uploads';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  const session = await auth();
  const actor = session?.user
    ? formatActor({ id: session.user.id, username: session.user.username, email: session.user.email })
    : 'anonymous';
  const { id } = await params;

  if (!session?.user?.id) {
    recordServerLog({
      level: 'WARN',
      source: 'FILE',
      action: 'FILE_DOWNLOAD_UNAUTHORIZED',
      actor: 'anonymous',
      request,
      statusCode: 401,
      message: `비로그인 사용자의 문제 첨부파일 다운로드 차단 (challengeId=${id})`,
      params: { challengeId: id },
    });
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const access = await getCtfAccess(ACTIVE_CTF_ID);
  if (!access.open && session.user.role !== 'ADMIN') {
    recordServerLog({
      level: 'WARN',
      source: 'FILE',
      action: 'FILE_DOWNLOAD_DENIED',
      actor,
      actorId: session.user.id,
      request,
      statusCode: 403,
      message: `대회 비활성 중 문제 첨부파일 다운로드 차단: ${actor} (challengeId=${id})`,
      params: { challengeId: id, reason: access.reason },
    });
    return NextResponse.json({ error: access.reason }, { status: 403 });
  }

  const challenge = await prisma.challenge.findFirst({
    where:
      session.user.role === 'ADMIN'
        ? { id, ctfId: ACTIVE_CTF_ID }
        : { id, ctfId: ACTIVE_CTF_ID, isVisible: true, category: { isVisible: true } },
    select: {
      id: true,
      title: true,
      attachmentName: true,
      attachmentMimeType: true,
      attachmentSize: true,
      attachmentData: true,
    },
  });
  if (!challenge?.attachmentData) {
    recordServerLog({
      level: 'WARN',
      source: 'FILE',
      action: 'FILE_DOWNLOAD_NOT_FOUND',
      actor,
      actorId: session?.user?.id,
      request,
      statusCode: 404,
      message: `존재하지 않는 문제 첨부파일 다운로드 요청: ${actor} (challengeId=${id})`,
      params: { challengeId: id },
    });
    return NextResponse.json({ error: '문제 파일을 찾을 수 없습니다.' }, { status: 404 });
  }

  const filename = safeDownloadName(challenge.attachmentName ?? `${id}.bin`);
  const body = Uint8Array.from(challenge.attachmentData).buffer;

  recordServerLog({
    level: 'INFO',
    source: 'FILE',
    action: 'FILE_DOWNLOAD',
    actor,
    actorId: session?.user?.id,
    request,
    statusCode: 200,
    message: `문제 첨부파일 다운로드: ${actor} → [${challenge.title}] (${filename})`,
    params: {
      challengeId: challenge.id,
      challengeTitle: challenge.title,
      fileName: filename,
      mimeType: challenge.attachmentMimeType || 'application/octet-stream',
      fileSize: challenge.attachmentSize ?? body.byteLength,
    },
  });

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Length': String(challenge.attachmentSize ?? body.byteLength),
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, max-age=60',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
