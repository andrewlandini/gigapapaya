import { getSession } from '@/lib/auth/session';
import { getUserById, getUserVideos, getUserStats, initDb } from '@/lib/db';

export async function GET() {
  await initDb();

  const session = await getSession();
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fetch fresh user data from DB (avatar may have changed since login)
  const [dbUser, videos, stats] = await Promise.all([
    getUserById(session.id),
    getUserVideos(session.id),
    getUserStats(session.id),
  ]);

  const user = {
    id: session.id,
    username: dbUser?.username || session.username,
    name: dbUser?.name || session.name,
    avatarUrl: dbUser?.avatar_url || null,
  };

  return Response.json({ user, videos, stats });
}
