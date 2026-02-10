import { NextRequest, NextResponse } from 'next/server';
import { geminiImage } from '@/lib/ai/agents';
import { getSession } from '@/lib/auth/session';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, style, mood, moodBoard } = body as {
      name: string;
      description: string;
      style: string;
      mood: string;
      moodBoard?: string[];
    };

    if (!name || !description || !style) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    console.log(`🧑 Regenerating portrait for ${name}...`);

    const primaryMoodRef = moodBoard?.length ? [moodBoard[0]] : undefined;
    const prompt = `${primaryMoodRef ? 'The attached image is the selected mood board reference for this production. This character portrait MUST match its visual style exactly — same color palette, same lighting quality, same color grade, same film stock texture, same overall aesthetic. The character should look like they belong in the world of that reference image. Keep the portrait on a black background.\n\n' : ''}Cinematic character portrait. ${style} visual style and color grade. Shallow depth of field, motivated lighting.

Subject: ${description}

Framing: Tight medium close-up from chest up. Subject fills the frame. Pure solid black background (#000000). The character is completely isolated against a clean black void — no environment, no set, no backdrop. The face is the focal point, lit with intention — key light with subtle fill, natural skin tones.

This is a definitive character reference photograph for a film production. Every detail of their appearance (face, hair, skin, build, clothing) must be precisely rendered as described. This exact person must be recognizable in every subsequent frame.

NO overlay graphics, captions, speech bubbles, subtitles, labels, or watermarks. Clean photographic image only. Output only the image.`;

    const imageUrl = await geminiImage(prompt, primaryMoodRef);

    if (!imageUrl) {
      return NextResponse.json({ error: 'Image generation failed' }, { status: 500 });
    }

    console.log(`✅ Portrait for ${name} regenerated`);
    return NextResponse.json({ imageUrl });
  } catch (error) {
    console.error('❌ Portrait regeneration failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
