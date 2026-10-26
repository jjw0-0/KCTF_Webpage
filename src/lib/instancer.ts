import { z } from 'zod';

const instanceSchema = z.object({
  token: z.string().min(1),
  url: z.string().url(),
  expires_at: z.string().datetime(),
});

const deploymentSchema = z.object({
  slug: z.string(),
  mode: z.enum(['compose', 'dockerfile']),
  status: z.enum(['QUEUED', 'BUILDING', 'READY', 'FAILED']),
  sourceHash: z.string(),
  error: z.string().nullable().optional(),
  log: z.string().optional(),
  updatedAt: z.string().datetime(),
});

export type RemoteDeployment = z.infer<typeof deploymentSchema>;

function instancerHeaders() {
  return { Authorization: `Bearer ${process.env.INSTANCER_TOKEN}` };
}

async function parseError(response: Response, fallback: string) {
  const body = await response.json().catch(() => ({})) as { error?: unknown };
  return typeof body.error === 'string' ? body.error : fallback;
}

export async function uploadRemoteDeployment(slug: string, file: File, entryPort: number, usesCompose: boolean) {
  const form = new FormData();
  form.set('bundle', file, file.name);
  form.set('entryPort', String(entryPort));
  form.set('mode', usesCompose ? 'compose' : 'dockerfile');
  const response = await fetch(`${process.env.INSTANCER_URL}/api/instancer/deployments/${encodeURIComponent(slug)}`, {
    method: 'POST',
    headers: instancerHeaders(),
    body: form,
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(await parseError(response, '배포 ZIP을 등록하지 못했습니다.'));
  const body = await response.json();
  return deploymentSchema.parse(body.deployment);
}

export async function getRemoteDeployment(slug: string) {
  const response = await fetch(`${process.env.INSTANCER_URL}/api/instancer/deployments/${encodeURIComponent(slug)}`, {
    headers: instancerHeaders(),
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(await parseError(response, '배포 상태를 확인하지 못했습니다.'));
  const body = await response.json();
  return deploymentSchema.parse(body.deployment);
}

export async function deleteRemoteDeployment(slug: string) {
  const response = await fetch(`${process.env.INSTANCER_URL}/api/instancer/deployments/${encodeURIComponent(slug)}`, {
    method: 'DELETE',
    headers: instancerHeaders(),
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok && response.status !== 404) throw new Error(await parseError(response, '배포를 삭제하지 못했습니다.'));
}

export async function createRemoteInstance(slug: string, userId: number, flag?: string) {
  const response = await fetch(`${process.env.INSTANCER_URL}/api/instancer/create`, {
    method: 'POST',
    headers: {
      ...instancerHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ slug, user_id: userId, ...(flag ? { flag } : {}) }),
    signal: AbortSignal.timeout(15_000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body.error === 'string' ? body.error : '인스턴스 발급에 실패했습니다.');
  return instanceSchema.parse(body);
}

export async function destroyRemoteInstance(token: string) {
  const response = await fetch(`${process.env.INSTANCER_URL}/api/instancer/destroy/${encodeURIComponent(token)}`, {
    method: 'DELETE',
    headers: instancerHeaders(),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok && response.status !== 404) throw new Error('인스턴스 종료에 실패했습니다.');
}

