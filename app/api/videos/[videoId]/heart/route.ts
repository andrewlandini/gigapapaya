import { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { initDb, toggleHeart, getHeartCount } from '@/lib/db';

let dbInitialized = false;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  if (!dbInitialized) { await initDb(); dbInitialized = true; }

  const user = await getSession();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { videoId } = await params;
  const hearted = await toggleHeart(user.id, videoId);
  const heartCount = await getHeartCount(videoId);

  return Response.json({ hearted, heartCount });
}
