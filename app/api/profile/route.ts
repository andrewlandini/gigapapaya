import { getSession } from '@/lib/auth/session';
import { getUserVideos, getUserStats, initDb } from '@/lib/db';

let dbInitialized = false;

export async function GET() {
  if (!dbInitialized) { await initDb(); dbInitialized = true; }

  const user = await getSession();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [videos, stats] = await Promise.all([
    getUserVideos(user.id),
    getUserStats(user.id),
  ]);

  return Response.json({ user, videos, stats });
}
