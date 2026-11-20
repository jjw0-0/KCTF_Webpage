import UserPage from '../../[id]/page';

export const dynamic = 'force-dynamic';

export default async function NamedUserPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  return UserPage({ params: Promise.resolve({ id: `@${username}` }) });
}
