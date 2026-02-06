import { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { initDb, getVideoDetail, hasUserHearted } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  await initDb();

  const { videoId } = await params;
  const video = await getVideoDetail(videoId);

  if (!video) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  const user = await getSession();
  const hearted = user ? await hasUserHearted(user.id, videoId) : false;
  const isOwner = user ? user.id === video.user_id : false;
  const isAdmin = user?.isAdmin || false;

  return Response.json({ video, hearted, isOwner, isAdmin }, {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
  });
}
