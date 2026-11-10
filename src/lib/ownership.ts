import { createHash, createHmac, randomBytes } from 'node:crypto';
import { ACTIVE_CTF_ID } from '@/lib/categories';
import { prisma } from '@/lib/prisma';

export function issueToken(kind: 'personal' | 'team') {
  const token = `kctf_${kind === 'team' ? 't' : 'p'}_${randomBytes(24).toString('base64url')}`;
  return {
    token,
    hash: createHash('sha256').update(token).digest('hex'),
    prefix: token.slice(0, 14),
  };
}

export type Owner = {
  key: string;
  userId: string;
  teamId: string | null;
  label: string;
  tokenHash: string;
  tokenPrefix: string;
};

export async function resolveOwner(userId: string): Promise<Owner> {
  const ctf = await prisma.cTF.findUnique({ where: { id: ACTIVE_CTF_ID }, select: { mode: true } });
  let user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, accessTokenHash: true, accessTokenPrefix: true },
  });
  if (!user) throw new Error('사용자를 찾을 수 없습니다.');
  if (!user.accessTokenHash || !user.accessTokenPrefix) {
    const issued = issueToken('personal');
    await prisma.user.updateMany({
      where: { id: user.id, accessTokenHash: null },
      data: { accessTokenHash: issued.hash, accessTokenPrefix: issued.prefix },
    });
    user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, username: true, accessTokenHash: true, accessTokenPrefix: true },
    });
  }

  if (ctf?.mode === 'TEAM') {
    const memberships = await prisma.teamMember.findMany({
      where: { userId, team: { ctfId: ACTIVE_CTF_ID } },
      select: { team: { select: { id: true, name: true, accessTokenHash: true, accessTokenPrefix: true } } },
      take: 2,
    });
    if (!memberships.length) throw new Error('팀에 가입한 뒤 이용해 주세요.');
    if (memberships.length > 1) throw new Error('여러 팀에 중복 가입되어 있습니다. 관리자에게 문의해 주세요.');
    let team = memberships[0].team;
    if (!team.accessTokenHash || !team.accessTokenPrefix) {
      const issued = issueToken('team');
      await prisma.team.updateMany({
        where: { id: team.id, accessTokenHash: null },
        data: { accessTokenHash: issued.hash, accessTokenPrefix: issued.prefix },
      });
      team = await prisma.team.findUniqueOrThrow({
        where: { id: team.id },
        select: { id: true, name: true, accessTokenHash: true, accessTokenPrefix: true },
      });
    }
    if (!team.accessTokenHash || !team.accessTokenPrefix) throw new Error('팀 토큰을 발급하지 못했습니다.');
    return { key: `team:${team.id}`, userId, teamId: team.id, label: team.name, tokenHash: team.accessTokenHash, tokenPrefix: team.accessTokenPrefix };
  }

  if (!user.accessTokenHash || !user.accessTokenPrefix) throw new Error('개인 토큰을 발급하지 못했습니다.');
  return { key: `user:${user.id}`, userId, teamId: null, label: user.username, tokenHash: user.accessTokenHash, tokenPrefix: user.accessTokenPrefix };
}

export function dynamicFlag(challengeId: string, owner: Owner) {
  const secret = process.env.DYNAMIC_FLAG_SECRET;
  if (!secret) throw new Error('DYNAMIC_FLAG_SECRET is required for dynamic flags.');
  const digest = createHmac('sha256', secret).update(`${challengeId}:${owner.tokenHash}`).digest('hex').slice(0, 32);
  return `KCTF{${digest}}`;
}
