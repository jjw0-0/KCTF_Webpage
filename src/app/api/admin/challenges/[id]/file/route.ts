import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdminUser } from '@/lib/admin-auth';
import { formatActor, recordServerLog } from '@/lib/admin-logs';
import { ACTIVE_CTF_ID } from '@/lib/categories';
import { getAdminChallenges } from '@/lib/challenges';
import { prisma } from '@/lib/prisma';
import { MAX_CHALLENGE_FILE_BYTES, readBoundedFormData, safeDownloadName } from '@/lib/uploads';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteContext) {
  const admin = await getCurrentAdminUser();
  if (!admin) return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });

  const { id } = await params;
  const challenge = await prisma.challenge.findFirst({ where: { id, ctfId: ACTIVE_CTF_ID }, select: { id: true, title: true } });
  if (!challenge) return NextResponse.json({ error: '문제를 찾을 수 없습니다.' }, { status: 404 });

  const parsedForm = await readBoundedFormData(request, MAX_CHALLENGE_FILE_BYTES);
  if (parsedForm.status === 'too_large') {
    return NextResponse.json({ error: '문제 파일은 10MB 이하여야 합니다.' }, { status: 413 });
  }
  const file = parsedForm.status === 'ok' ? parsedForm.formData.get('file') : null;
  if (!(file instanceof File) || !file.size) return NextResponse.json({ error: '업로드할 파일을 선택해 주세요.' }, { status: 400 });
  if (file.size > MAX_CHALLENGE_FILE_BYTES) return NextResponse.json({ error: '문제 파일은 10MB 이하여야 합니다.' }, { status: 413 });

  const name = safeDownloadName(file.name);
  await prisma.challenge.update({
    where: { id },
    data: {
      fileUrl: `/api/challenges/${encodeURIComponent(id)}/file`,
      attachmentName: name,
      attachmentMimeType: file.type || 'application/octet-stream',
      attachmentSize: file.size,
      attachmentData: new Uint8Array(await file.arrayBuffer()),
    },
  });

  const actor = formatActor(admin);
  recordServerLog({
    level: 'INFO',
    source: 'ADMIN',
    action: 'ADMIN_ATTACHMENT_UPLOAD',
    actor,
    actorId: admin.id,
    request,
    statusCode: 200,
    message: `관리자 문제 첨부파일 업로드: ${actor} → [${challenge.title}] (${name})`,
    params: {
      challengeId: challenge.id,
      challengeTitle: challenge.title,
      fileName: name,
      mimeType: file.type || 'application/octet-stream',
      fileSize: file.size,
    },
  });

  revalidatePath('/ctf');
  revalidatePath('/admin');
  return NextResponse.json({ challenges: await getAdminChallenges() });
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const admin = await getCurrentAdminUser();
  if (!admin) return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
  const { id } = await params;
  const updated = await prisma.challenge.updateMany({
    where: { id, ctfId: ACTIVE_CTF_ID },
    data: { fileUrl: null, attachmentName: null, attachmentMimeType: null, attachmentSize: null, attachmentData: null },
  });
  if (!updated.count) return NextResponse.json({ error: '문제를 찾을 수 없습니다.' }, { status: 404 });

  const actor = formatActor(admin);
  recordServerLog({
    level: 'INFO',
    source: 'ADMIN',
    action: 'ADMIN_ATTACHMENT_DELETE',
    actor,
    actorId: admin.id,
    request,
    statusCode: 200,
    message: `관리자 문제 첨부파일 삭제: ${actor} (challengeId=${id})`,
    params: { challengeId: id },
  });

  revalidatePath('/ctf');
  revalidatePath('/admin');
  return NextResponse.json({ challenges: await getAdminChallenges() });
}
