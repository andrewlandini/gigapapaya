import { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getGenerationWithVideos, updateVideoSceneIndex, removeVideoFromGeneration, initDb } from '@/lib/db';

let dbInitialized = false;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ generationId: string }> }
) {
  if (!dbInitialized) { await initDb(); dbInitialized = true; }

  const { generationId } = await params;
  const user = await getSession();
  const data = await getGenerationWithVideos(generationId);

  if (!data) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  const isOwner = user?.id === data.generation.user_id;

  // Non-owners can only see public videos
  const videos = isOwner
    ? data.videos
    : data.videos.filter((v: any) => v.visibility === 'public');

  if (videos.length === 0 && !isOwner) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  return Response.json({
    generation: {
      id: data.generation.id,
      userInput: data.generation.user_input,
      idea: data.generation.idea,
      status: data.generation.status,
      createdAt: data.generation.created_at,
    },
    videos,
    isOwner,
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ generationId: string }> }
) {
  if (!dbInitialized) { await initDb(); dbInitialized = true; }

  const { generationId } = await params;
  const user = await getSession();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { action, videoId, newIndex } = body;

  if (action === 'reorder' && videoId && typeof newIndex === 'number') {
    await updateVideoSceneIndex(videoId, user.id, newIndex);
    return Response.json({ ok: true });
  }

  if (action === 'remove' && videoId) {
    await removeVideoFromGeneration(videoId, user.id);
    return Response.json({ ok: true });
  }

  return Response.json({ error: 'Invalid action' }, { status: 400 });
}
