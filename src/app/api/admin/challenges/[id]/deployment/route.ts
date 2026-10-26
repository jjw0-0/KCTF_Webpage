import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdminUser } from '@/lib/admin-auth';
import { formatActor, recordServerLog } from '@/lib/admin-logs';
import { ACTIVE_CTF_ID } from '@/lib/categories';
import { getAdminChallenges } from '@/lib/challenges';
import {
  deleteRemoteDeployment,
  getRemoteDeployment,
  uploadRemoteDeployment,
} from '@/lib/instancer';
import { prisma } from '@/lib/prisma';
import {
  isZipArchive,
  MAX_DEPLOYMENT_FILE_BYTES,
  readBoundedFormData,
} from '@/lib/uploads';

type RouteContext = { params: Promise<{ id: string }> };

async function challengeForDeployment(id: string) {
  return prisma.challenge.findFirst({
    where: { id, ctfId: ACTIVE_CTF_ID },
    select: { id: true, title: true, usesVm: true, usesCompose: true, instanceSlug: true, instancePort: true },
  });
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const admin = await getCurrentAdminUser();
  if (!admin) return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
  const { id } = await params;
  const challenge = await challengeForDeployment(id);
  if (!challenge) return NextResponse.json({ error: '문제를 찾을 수 없습니다.' }, { status: 404 });
  const slug = challenge.instanceSlug ?? challenge.id;
  const deployment = await getRemoteDeployment(slug);
  await prisma.challenge.update({
    where: { id: challenge.id },
    data: {
      deploymentStatus: deployment?.status ?? 'NONE',
      deploymentError: deployment?.error ?? null,
      deploymentUpdatedAt: deployment ? new Date(deployment.updatedAt) : null,
      instanceSlug: challenge.usesVm ? slug : null,
    },
  });
  return NextResponse.json({ deployment, challenges: await getAdminChallenges() });
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const admin = await getCurrentAdminUser();
  if (!admin) return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
  const { id } = await params;
  const challenge = await challengeForDeployment(id);
  if (!challenge) return NextResponse.json({ error: '문제를 찾을 수 없습니다.' }, { status: 404 });
  if (!challenge.usesVm) return NextResponse.json({ error: 'VM 사용을 먼저 활성화해 주세요.' }, { status: 409 });
  if (!challenge.instancePort) return NextResponse.json({ error: 'VM 연결 포트를 먼저 입력해 주세요.' }, { status: 409 });

  const parsed = await readBoundedFormData(request, MAX_DEPLOYMENT_FILE_BYTES);
  if (parsed.status === 'too_large') return NextResponse.json({ error: '배포 ZIP은 50MB 이하여야 합니다.' }, { status: 413 });
  const file = parsed.status === 'ok' ? parsed.formData.get('file') : null;
  if (!(file instanceof File) || !file.size) return NextResponse.json({ error: '배포 ZIP을 선택해 주세요.' }, { status: 400 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!isZipArchive(bytes, file.name)) return NextResponse.json({ error: '유효한 ZIP 파일만 업로드할 수 있습니다.' }, { status: 400 });

  const slug = challenge.instanceSlug ?? challenge.id;
  try {
    const deployment = await uploadRemoteDeployment(
      slug,
      new File([bytes], file.name, { type: 'application/zip' }),
      challenge.instancePort,
      challenge.usesCompose,
    );
    await prisma.challenge.update({
      where: { id: challenge.id },
      data: {
        instanceSlug: slug,
        deploymentStatus: deployment.status,
        deploymentError: deployment.error ?? null,
        deploymentUpdatedAt: new Date(deployment.updatedAt),
      },
    });
    recordServerLog({
      level: 'INFO',
      source: 'ADMIN',
      action: 'ADMIN_DEPLOYMENT_UPLOAD',
      actor: formatActor(admin),
      actorId: admin.id,
      request,
      statusCode: 202,
      message: `관리자 배포 ZIP 등록: ${formatActor(admin)} → [${challenge.title}]`,
      params: { challengeId: challenge.id, instanceSlug: slug, mode: deployment.mode, fileName: file.name, fileSize: file.size },
    });
    revalidatePath('/ctf');
    revalidatePath('/admin');
    return NextResponse.json({ deployment, challenges: await getAdminChallenges() }, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '배포 ZIP을 등록하지 못했습니다.';
    await prisma.challenge.update({
      where: { id: challenge.id },
      data: { deploymentStatus: 'FAILED', deploymentError: message, deploymentUpdatedAt: new Date() },
    });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const admin = await getCurrentAdminUser();
  if (!admin) return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
  const { id } = await params;
  const challenge = await challengeForDeployment(id);
  if (!challenge) return NextResponse.json({ error: '문제를 찾을 수 없습니다.' }, { status: 404 });
  const slug = challenge.instanceSlug ?? challenge.id;
  await deleteRemoteDeployment(slug);
  await prisma.challenge.update({
    where: { id: challenge.id },
    data: { deploymentStatus: 'NONE', deploymentError: null, deploymentUpdatedAt: null },
  });
  recordServerLog({
    level: 'WARN',
    source: 'ADMIN',
    action: 'ADMIN_DEPLOYMENT_DELETE',
    actor: formatActor(admin),
    actorId: admin.id,
    request,
    statusCode: 200,
    message: `관리자 배포 삭제: ${formatActor(admin)} → [${challenge.title}]`,
    params: { challengeId: challenge.id, instanceSlug: slug },
  });
  revalidatePath('/ctf');
  revalidatePath('/admin');
  return NextResponse.json({ challenges: await getAdminChallenges() });
}
