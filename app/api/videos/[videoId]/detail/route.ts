import { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { initDb, getVideoDetail, hasUserHearted } from '@/lib/db';

let dbInitialized = false;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  if (!dbInitialized) { await initDb(); dbInitialized = true; }

  const { videoId } = await params;
  const video = await getVideoDetail(videoId);

  if (!video) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  const user = await getSession();
  const hearted = user ? await hasUserHearted(user.id, videoId) : false;
  const isOwner = user ? user.id === video.user_id : false;

  return Response.json({ video, hearted, isOwner });
}
