import { NextRequest, NextResponse } from 'next/server';
import { geminiImage } from '@/lib/ai/agents';
import { getSession } from '@/lib/auth/session';
import type { VideoIdea } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Each modifier is a specific DI/colorist note — the kind of thing you'd say
// in a DaVinci Resolve session or on set to a gaffer. Not adjectives, actions.
const MODIFIER_PROMPTS: Record<string, string> = {
  'More Cinematic': `Relight the scene. Kill the fill — let one hard key do the work. Shadows go to true black, not milky gray. Rack the depth of field way down so the background falls off. Add a subtle halation bloom around any practical light source in frame. Grade it like you're printing Kodak Vision3 500T — rich in the mids, dense in the blacks, skin tones that glow. If there's a window or doorway, let it blow out a full stop. This should look like a frame you'd freeze from a Fincher or Villeneuve film — controlled, composed, every light source motivated.`,

  'Home Video': `Degrade everything. This was shot on a 2003 Sony Handycam. Soften the entire image — no sharp edges anywhere. Blow the highlights out 1.5 stops, especially any window or overhead light. Flatten the contrast curve hard — blacks never go below 15 IRE. Add visible interlace-style softness and a warm magenta-green color shift in the shadows. The white balance is wrong — too warm, slightly green. Framing is off-center and slightly tilted. Visible compression artifacts in dark areas. The autofocus is hunting slightly so nothing is tack sharp. This is someone's memory, not a production.`,

  'Darker': `Pull exposure down a full stop. Let the shadows eat the frame — only 30-40% of the image should be readable. Whatever the key light source is, narrow its throw so it only hits the subject. Everything outside that pool goes to black. Crush the blacks in the grade — lift the toe of the curve so shadow detail disappears. If there are practicals in frame (lamps, screens, signs), they become the only light sources. This is a scene lit by what's actually in the room, nothing else. The mood is isolation — the darkness isn't empty, it's pressing in.`,

  'Brighter': `Open it up. Add two stops of ambient fill — like the scene is near a large window on an overcast day, or the overhead fluorescents are actually working. Shadows lift to a soft gray, never black. The overall feeling is that light is everywhere, coming from above and bouncing off every surface. Skin glows. White surfaces read as true white. Keep the contrast gentle — this is a low-ratio lighting setup where fill nearly matches key. The image should feel like a bright morning, like clean air, like the room itself is breathing.`,

  'Warmer': `Push the entire image toward 3200K tungsten. Shadows go amber-brown, not blue. Highlights shift toward pale gold. Skin tones go rich and ruddy — cheeks, ears, and noses catch the warm light. Any practical light source in frame (lamp, candle, overhead) reads as the source of the warmth. The grade sits in the orange-amber channel — think golden hour pushed 20 minutes past sunset. Blacks have a chocolate tone to them. The whole image feels like it's lit by firelight or a low-wattage bulb in a room with wood paneling.`,

  'Cooler': `Shift the whole image toward 6500K daylight-plus. Shadows go steel blue. Highlights go pale, almost clinical white. Skin tones lose their warmth — they go slightly ashen, neutral, like someone under fluorescent office lighting. Any practical light source reads as cold — LED panels, overcast sky, blue screen glow. The grade lives in the teal-blue channel. Blacks are navy, not warm. This is the color of 4am, of hospitals, of a parking garage at night. The emotional temperature of the image drops — it should feel distant, observed, unsentimental.`,

  'More Gritty': `Shoot this on pushed Tri-X. Heavy visible grain that sits in the midtones and shadows — not digital noise, actual photochemical grain with clumps and texture. Boost the contrast hard — slam the S-curve so highlights clip and shadows crush, with a narrow band of mids doing all the work. Desaturate 30-40% so color becomes suggestion, not statement. Every surface texture becomes visible — pores, scratches, fabric weave, concrete aggregate, the grain of wood. Add subtle lens aberration at the edges — this wasn't shot on a $50K Zeiss, it was a beat-up Cooke or a rehoused still lens. The image should feel like it cost nothing and is worth everything.`,

  'More Polished': `Clean this up for the client. Smooth the grain out entirely — this is a RED Monstro at native ISO, no noise. Lighting is precise — soft key through a 4x4 frame of diffusion, gentle fill from a bounce, subtle hair light separating the subject from the background. Every shadow is controlled, deliberate, readable. Colors are rich but not oversaturated — the grade is restrained, sitting in a tight palette. Skin is even-toned and clean. The image has the effortless production value of a Super Bowl spot or a prestige HBO opening — nothing feels accidental, every pixel is considered.`,
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

    const modifierPrompt = MODIFIER_PROMPTS[modifier];
    if (!modifierPrompt) {
      return NextResponse.json({ error: 'Unknown modifier' }, { status: 400 });
    }

    console.log(`🎨 Refining mood board: "${modifier}" for "${idea.title}"`);

    const prompt = `You are a cinematographer and colorist. The attached image is a frame from a production. The director has given you a note. Rebuild this frame with the adjustment below — same scene, same subjects, same composition, same moment in the story. You are not changing what happens in the frame. You are changing how it was shot and graded.

Director's note: "${modifier}"

${modifierPrompt}

The production is: ${idea.title} — ${idea.description}

Regenerate this exact frame with the adjustment applied. Output only the image.`;

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
