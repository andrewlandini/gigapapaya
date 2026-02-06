import { NextRequest } from 'next/server';
import { generateImage } from 'ai';
import { put } from '@vercel/blob';
import { getSession } from '@/lib/auth/session';
import { getImageModel } from '@/lib/ai/provider';
import { initDb, updateUserAvatar } from '@/lib/db';

export const runtime = 'nodejs';
export const maxDuration = 60;

let dbInitialized = false;

export async function POST(request: NextRequest) {
  if (!dbInitialized) { await initDb(); dbInitialized = true; }

  const user = await getSession();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { prompt } = await request.json();

    if (!prompt?.trim()) {
      return Response.json({ error: 'Prompt is required' }, { status: 400 });
    }

    console.log(`🎨 Generating icon for @${user.username}: "${prompt}"`);

    const { images } = await generateImage({
      model: getImageModel('google/gemini-3-pro-image'),
      prompt,
      n: 1,
      size: '1024x1024',
    });

    if (!images || images.length === 0) {
      return Response.json({ error: 'No image generated' }, { status: 500 });
    }

    const imageData = images[0];
    const buffer = Buffer.from(imageData.uint8Array);

    // Upload to Blob Storage
    const blob = await put(`avatars/${user.id}.png`, buffer, {
      access: 'public',
      contentType: 'image/png',
    });

    console.log(`✅ Icon uploaded: ${blob.url}`);

    // Update user avatar in database
    await updateUserAvatar(user.id, blob.url);

    return Response.json({ url: blob.url });
  } catch (error) {
    console.error('❌ Icon generation failed:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to generate icon' },
      { status: 500 }
    );
  }
}
