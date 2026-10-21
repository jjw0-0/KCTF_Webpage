import { z } from 'zod';

const instanceSchema = z.object({
  token: z.string().min(1),
  url: z.string().url(),
  expires_at: z.string().datetime(),
});

export async function createRemoteInstance(slug: string, userId: number) {
  const response = await fetch(`${process.env.INSTANCER_URL}/api/instancer/create`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.INSTANCER_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ slug, user_id: userId }),
    signal: AbortSignal.timeout(15_000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body.error === 'string' ? body.error : '인스턴스 발급에 실패했습니다.');
  return instanceSchema.parse(body);
}

export async function destroyRemoteInstance(token: string) {
  const response = await fetch(`${process.env.INSTANCER_URL}/api/instancer/destroy/${encodeURIComponent(token)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${process.env.INSTANCER_TOKEN}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok && response.status !== 404) throw new Error('인스턴스 종료에 실패했습니다.');
}

