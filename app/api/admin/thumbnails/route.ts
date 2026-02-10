import { getSession } from '@/lib/auth/session';
import { initDb, isUserAdmin, getVideosMissingThumbnails, updateVideoThumbnail, clearAllVideoThumbnails } from '@/lib/db';
import { put } from '@vercel/blob';
import sharp from 'sharp';
import crypto from 'crypto';

export async function GET() {
  await initDb();
  const user = await getSession();
  if (!user || !(await isUserAdmin(user.id))) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const videos = await getVideosMissingThumbnails();
  return Response.json(videos);
}

export async function POST(request: Request) {
  await initDb();
  const user = await getSession();
  if (!user || !(await isUserAdmin(user.id))) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { videoId, thumbnailDataUrl } = await request.json();
  if (!videoId || !thumbnailDataUrl) {
    return Response.json({ error: 'videoId and thumbnailDataUrl are required' }, { status: 400 });
  }

  // Decode base64 data URL to Buffer
  const base64Match = thumbnailDataUrl.match(/^data:image\/\w+;base64,(.+)$/);
  if (!base64Match) {
    return Response.json({ error: 'Invalid data URL format' }, { status: 400 });
  }
  const rawBuffer = Buffer.from(base64Match[1], 'base64');

  // Compress to JPEG via sharp
  const jpegBuffer = await sharp(rawBuffer).jpeg({ quality: 80 }).toBuffer();

  // Upload to Vercel Blob
  const blob = await put(`storyboard/${crypto.randomUUID()}.jpg`, jpegBuffer, {
    access: 'public',
    contentType: 'image/jpeg',
    cacheControlMaxAge: 31536000,
  });

  // Update DB
  await updateVideoThumbnail(videoId, blob.url);

  return Response.json({ success: true, thumbnailUrl: blob.url });
}

export async function DELETE() {
  await initDb();
  const user = await getSession();
  if (!user || !(await isUserAdmin(user.id))) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  await clearAllVideoThumbnails();
  return Response.json({ success: true });
}
