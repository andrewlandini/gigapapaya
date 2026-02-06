import { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { initDb, isUserAdmin, deleteVideo } from '@/lib/db';

let dbInitialized = false;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  if (!dbInitialized) { await initDb(); dbInitialized = true; }

  const user = await getSession();
  if (!user || !(await isUserAdmin(user.id))) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { videoId } = await params;
  await deleteVideo(videoId);

  return Response.json({ ok: true });
}
