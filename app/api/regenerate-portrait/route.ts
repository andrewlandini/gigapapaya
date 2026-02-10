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
    const prompt = primaryMoodRef
      ? `You are lighting a character reference portrait for a film production. The attached image is a frame from this film — study its color grade, the quality of light (hard vs soft, warm vs cool, high-key vs low-key), the contrast ratio, and the film stock texture (grain, halation, color rendition).

Now generate a portrait of this character lit with THAT SAME quality of light. The face should look like it belongs in that film. Same color temperature hitting the skin. Same contrast ratio between key and fill. Same shadow density. Same highlight rolloff. Same grain structure.

Subject: ${description}

Framing: Tight medium close-up, chest up. Pure black background (#000000) — the character is isolated against black, like a casting reference photo. But the LIGHT on their face must match the reference frame exactly. If the reference is warm tungsten, the key light is warm tungsten. If it's cool overcast, the key is cool overcast. The grade on the skin, hair, and clothing matches the reference film's grade.

This is a definitive character reference for continuity. Every physical detail (face, hair, skin, build, clothing) must be precisely rendered. This person must be recognizable in every subsequent frame.

NO graphics, captions, text, labels. Output only the image.`
      : `Cinematic character portrait. ${style} visual style and color grade. Shallow depth of field, motivated lighting.

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
