import { destroyRemoteInstance } from '@/lib/instancer';
import { prisma } from '@/lib/prisma';

export async function removeOwnerInstance(ownerKey: string) {
  const instance = await prisma.challengeInstance.findUnique({ where: { ownerKey } });
  if (!instance) return;
  await destroyRemoteInstance(instance.token);
  await prisma.challengeInstance.delete({ where: { id: instance.id } });
}

export async function removeAllOwnerInstances() {
  const instances = await prisma.challengeInstance.findMany({ select: { id: true, token: true } });
  for (const instance of instances) {
    await destroyRemoteInstance(instance.token);
    await prisma.challengeInstance.delete({ where: { id: instance.id } });
  }
}
