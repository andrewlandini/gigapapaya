import { NextRequest, NextResponse } from 'next/server';
import { geminiImage } from '@/lib/ai/agents';
import { getSession } from '@/lib/auth/session';
import type { VideoIdea } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MODIFIER_DESCRIPTIONS: Record<string, string> = {
  'More Cinematic': 'more cinematic with dramatic lighting contrasts, wider aspect framing feel, lens flares from practical sources, deeper shadows, richer blacks, and a more intentional color grade — like a frame from a Deakins or Lubezki film',
  'Home Video': 'a home video or camcorder aesthetic — slightly overexposed highlights, softer focus, warmer color cast, visible video noise/grain, lower contrast, casual framing as if shot handheld by a non-professional, slight motion blur, VHS or early digital camcorder texture',
  'Darker': 'darker and more moody — crush the shadows deeper, reduce fill light, add more contrast between light and dark areas, let darkness consume more of the frame, create pools of light surrounded by shadow, more chiaroscuro',
  'Brighter': 'brighter and more luminous — open up the shadows, add more fill light, increase overall exposure slightly, make highlights bloom gently, create an airy and well-lit feeling, softer shadows with more ambient light',
  'Warmer': 'warmer in color temperature — shift toward amber, gold, and warm tones, as if lit by tungsten bulbs or golden hour sunlight, add warmth to skin tones, make shadows lean toward warm brown rather than cool blue',
  'Cooler': 'cooler in color temperature — shift toward blue, teal, and steel tones, as if lit by moonlight or overcast sky, add a cool cast to shadows, make highlights lean toward pale blue-white, create a clinical or melancholic color palette',
  'More Gritty': 'grittier and more textured — add visible film grain, increase contrast, add subtle lens imperfections, make the image feel rough and tactile like it was shot on high-ISO film stock, emphasize texture in surfaces (skin pores, fabric weave, concrete grain), desaturate slightly',
  'More Polished': 'more polished and refined — smooth out grain, clean up the image, make lighting more even and controlled, add subtle skin smoothing, make colors more saturated and precisely graded, create a high-production-value commercial or prestige TV look with careful color harmony',
};

export async function POST(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { imageUrl, modifier, idea, aspectRatio } = body as {
      imageUrl: string;
      modifier: string;
      idea: VideoIdea;
      aspectRatio?: string;
    };

    if (!imageUrl || !modifier || !idea) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const description = MODIFIER_DESCRIPTIONS[modifier];
    if (!description) {
      return NextResponse.json({ error: 'Unknown modifier' }, { status: 400 });
    }

    console.log(`🎨 Refining mood board: "${modifier}" for "${idea.title}"`);

    const prompt = `Take this reference image and regenerate it making it ${description}.

Keep the same composition, subject matter, framing, and overall scene — but shift the visual style and mood as described. The result should feel like the same frame from the same film, but with the cinematographer making different choices about lighting, color, and texture.

This is for a video concept:
Title: ${idea.title}
Style: ${idea.style}
Mood: ${idea.mood}

Output only the image.`;

    const newImageUrl = await geminiImage(prompt, [imageUrl], aspectRatio);

    if (!newImageUrl) {
      return NextResponse.json({ error: 'Image generation failed' }, { status: 500 });
    }

    console.log(`✅ Mood board refined with "${modifier}"`);
    return NextResponse.json({ imageUrl: newImageUrl });
  } catch (error) {
    console.error('❌ Mood board refinement failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
