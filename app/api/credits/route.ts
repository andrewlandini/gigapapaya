import { getSession } from '@/lib/auth/session';
import { initDb, getUserCredits } from '@/lib/db';

export async function GET() {
  await initDb();
  const user = await getSession();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const data = await getUserCredits(user.id);
  return Response.json(data);
}
