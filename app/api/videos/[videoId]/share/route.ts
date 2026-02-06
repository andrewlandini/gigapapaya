import { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { toggleVideoVisibility } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  const user = await getSession();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { videoId } = await params;
  const { visibility } = await request.json();

  if (visibility !== 'public' && visibility !== 'private') {
    return Response.json({ error: 'Invalid visibility' }, { status: 400 });
  }

  await toggleVideoVisibility(videoId, user.id, visibility);

  return Response.json({ ok: true, visibility });
}
