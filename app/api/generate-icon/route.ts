import { NextRequest } from 'next/server';
import { generateText } from 'ai';
import { put, del } from '@vercel/blob';
import { getSession } from '@/lib/auth/session';
import { getTextModel } from '@/lib/ai/provider';
import { initDb, updateUserAvatar, getUserById } from '@/lib/db';

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
    const { prompt, action } = await request.json();

    // Delete avatar
    if (action === 'delete') {
      const dbUser = await getUserById(user.id);
      if (dbUser?.avatar_url) {
        try { await del(dbUser.avatar_url); } catch {}
      }
      await updateUserAvatar(user.id, '');
      return Response.json({ ok: true });
    }

    if (!prompt?.trim()) {
      return Response.json({ error: 'Prompt is required' }, { status: 400 });
    }

    console.log(`🎨 Generating icon for @${user.username}: "${prompt}"`);

    // Use Gemini with multimodal output via AI Gateway
    const result = await generateText({
      model: getTextModel('google/gemini-2.5-flash-preview-04-17'),
      providerOptions: {
        google: { responseModalities: ['TEXT', 'IMAGE'] },
      },
      prompt: `Generate a single square profile avatar/icon image: ${prompt}. The image should be clean, centered, with a simple background. Make it suitable as a social media profile picture. Output only the image, no text.`,
    });

    // Find the image in response files
    const imageFile = result.files?.find(f => f.mediaType.startsWith('image/'));

    if (!imageFile) {
      console.error('❌ No image in response. Files:', result.files?.length || 0);
      return Response.json({ error: 'Image generation failed — no image returned' }, { status: 500 });
    }

    const buffer = Buffer.from(imageFile.uint8Array);

    // Delete old avatar if exists
    const dbUser = await getUserById(user.id);
    if (dbUser?.avatar_url) {
      try { await del(dbUser.avatar_url); } catch {}
    }

    // Upload to Blob Storage
    const blob = await put(`avatars/${user.id}-${Date.now()}.png`, buffer, {
      access: 'public',
      contentType: 'image/png',
    });

    console.log(`✅ Icon uploaded: ${blob.url}`);
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
