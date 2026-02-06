import { NextRequest } from 'next/server';
import { generateText } from 'ai';
import { put } from '@vercel/blob';
import { getSession } from '@/lib/auth/session';
import { getTextModel } from '@/lib/ai/provider';
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

    const result = await generateText({
      model: getTextModel('google/gemini-2.5-flash-preview-04-17'),
      providerOptions: {
        google: { responseModalities: ['TEXT', 'IMAGE'] },
      },
      prompt: `Generate a square profile avatar/icon: ${prompt}. Clean, centered composition on a simple background. Output only the image.`,
    });

    // Find the first image in the response files
    const imageFile = result.files?.find(f => f.mediaType.startsWith('image/'));

    if (!imageFile) {
      console.error('❌ No image in response. Files:', result.files?.map(f => f.mediaType));
      return Response.json({ error: 'No image generated' }, { status: 500 });
    }

    const buffer = Buffer.from(imageFile.uint8Array);

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
