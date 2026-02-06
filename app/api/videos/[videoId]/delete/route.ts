import { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { initDb, isUserAdmin, deleteVideo, getVideoById } from '@/lib/db';
import { deleteVideo as deleteBlobVideo } from '@/lib/ai/video-storage';

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
  const video = await getVideoById(videoId);
  if (!video) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  const admin = await isUserAdmin(user.id);
  const isOwner = video.user_id === user.id;

  if (!admin && !isOwner) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Delete from blob storage
  try {
    await deleteBlobVideo(video.blob_url);
  } catch (e) {
    console.error('Failed to delete blob:', e);
  }

  // Delete from database
  await deleteVideo(videoId);

  return Response.json({ ok: true });
}
