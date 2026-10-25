import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function getCurrentAdminUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, username: true, email: true, role: true, isActive: true },
  });
  if (!user?.isActive || user.role !== 'ADMIN') return null;
  return user;
}

export async function isCurrentUserAdmin() {
  return (await getCurrentAdminUser()) !== null;
}
