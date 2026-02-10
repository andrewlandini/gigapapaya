import {
  generateObject,
  generateText,
  experimental_generateVideo as generateVideo,
} from 'ai';
import { z } from 'zod';
import { getTextModel, getVideoModel } from './provider';
import { IDEA_AGENT_PROMPT, SCENES_AGENT_PROMPT, STORYBOARD_TONE_OVERRIDES, SCENE_AGENT_BASE } from '../prompts';
import { saveVideo } from './video-storage';
import { put } from '@vercel/blob';
import crypto from 'crypto';
import type { VideoIdea, ScenesResult, Video, GenerationOptions, Character, VeoOptions } from '../types';
import { inspectError, formatErrorReport } from './error-inspector';
import sharp from 'sharp';

// Zod schemas for structured output validation
const videoIdeaSchema = z.object({
  title: z.string().describe('A concise, descriptive title for the video concept'),
  description: z.string().describe('A detailed 2-3 sentence description of the video'),
  style: z.string().describe('The visual style (e.g., cinematic, documentary, animated)'),
  mood: z.string().describe('The emotional tone (e.g., uplifting, suspenseful, peaceful)'),
  keyElements: z.array(z.string()).describe('3-5 specific visual elements that should appear'),
});

const sceneSchema = z.object({
  index: z.number().describe('Shot number'),
  prompt: z.string().describe('Veo 3.1-ready VISUAL prompt: [SHOT TYPE] + [SUBJECT with full description] + [ACTION] + [STYLE/CAMERA/LENS] + [CAMERA MOVEMENT] + [AUDIO]. Do NOT include dialogue here — dialogue goes in the separate dialogue field. Must be fully self-contained — Veo 3.1 has zero context between shots.'),
  dialogue: z.array(z.object({
    character: z.string().describe('The name of the character speaking this line (must match a name in the characters array)'),
    line: z.string().describe('The exact spoken words — short, punchy, conversational. NOT a description. THE ACTUAL WORDS.'),
  })).describe('REQUIRED: Array of dialogue lines in speaking order. Each entry is one character utterance. Example: [{ character: "Mike", line: "Hey." }, { character: "Sarah", line: "What?" }]. Almost every shot with people should have dialogue. Empty array ONLY for pure environment shots.'),
  characters: z.array(z.string()).describe('Short consistent names of characters appearing in this scene (e.g. ["Mike", "Sarah"]). Use the same name across all scenes for the same character. Empty array if no characters.'),
  duration: z.number().describe('Duration in seconds (2, 4, 6, or 8)'),
  notes: z.string().describe('What happens narratively in this shot and how it connects to the next'),
});

const characterSchema = z.object({
  name: z.string().describe('Short consistent name used in scene character arrays'),
  description: z.string().describe('Full physical description: age, gender, ethnicity, build, hair, clothing, skin tone, distinguishing features'),
  sceneIndices: z.array(z.number()).describe('Which scene indices (1-based) this character appears in'),
});

const scenesResultSchema = z.object({
  scenes: z.array(sceneSchema).describe('Array of shots with Veo 3.1-ready prompts'),
  characters: z.array(characterSchema).describe('All characters in the video with full physical descriptions and which scenes they appear in'),
  consistencyNotes: z.string().describe('Camera/style setup to maintain across all shots'),
});

/**
 * Agent 1: Generate creative video idea from user input
 */
export async function executeIdeaAgent(
  userInput: string,
  config?: { model?: string; prompt?: string },
  referenceImages?: string[],
): Promise<VideoIdea> {
  const modelId = config?.model || 'anthropic/claude-sonnet-4.5';
  const systemPrompt = config?.prompt || IDEA_AGENT_PROMPT;

  console.log('\n🎨 IDEA AGENT: Starting...');
  console.log(`📝 User Input: "${userInput}"`);
  console.log(`🤖 Model: ${modelId}`);
  if (referenceImages?.length) console.log(`📎 ${referenceImages.length} reference image(s) provided`);
  console.log('');

  const textPrompt = `${systemPrompt}\n\nUser Input: ${userInput}`;

  const result = referenceImages && referenceImages.length > 0
    ? await generateObject({
        model: getTextModel(modelId),
        temperature: 1,
        schema: videoIdeaSchema,
        messages: [
          {
            role: 'user' as const,
            content: [
              ...referenceImages.map(img => ({ type: 'image' as const, image: img })),
              { type: 'text' as const, text: textPrompt },
            ],
          },
        ],
      })
    : await generateObject({
        model: getTextModel(modelId),
        temperature: 1,
        schema: videoIdeaSchema,
        prompt: textPrompt,
      });

  console.log('✅ IDEA AGENT: Complete');
  console.log('📋 Generated Idea:', JSON.stringify(result.object, null, 2));
  console.log('');

  return result.object as VideoIdea;
}

/**
 * Agent 2: Generate scene breakdown from video idea
 */
export async function executeScenesAgent(
  idea: VideoIdea,
  numScenes?: number,
  config?: { model?: string; prompt?: string },
  duration: number | 'auto' = 8,
  noMusic: boolean = false,
  totalLength?: number,
  referenceImages?: string[],
): Promise<ScenesResult> {
  const modelId = config?.model || 'anthropic/claude-sonnet-4.5';
  const systemPrompt = config?.prompt || SCENES_AGENT_PROMPT;
  const autoShotCount = !numScenes;

  console.log('\n🎬 SCENES AGENT: Starting...');
  console.log(`📋 Idea: ${idea.title}`);
  console.log(`🎯 Target: ${autoShotCount ? 'auto' : numScenes} shots, ${duration}${typeof duration === 'number' ? 's' : ''} each`);
  console.log(`🤖 Model: ${modelId}`);
  if (referenceImages?.length) console.log(`📎 ${referenceImages.length} reference image(s) provided`);
  console.log('');

  const ideaSummary = `
Title: ${idea.title}
Description: ${idea.description}
Visual Style: ${idea.style}
Mood: ${idea.mood}
Key Elements: ${idea.keyElements.join(', ')}
`;

  const isAuto = duration === 'auto';
  const fixedDuration = typeof duration === 'number' ? duration : 8;

  let durationGuidance: string;
  if (isAuto) {
    const totalLenNote = totalLength ? `TARGET TOTAL LENGTH: ~${totalLength} seconds across all shots.` : `You decide the total length based on what the story needs. A tight concept might need 10-15 seconds. A full narrative might need 30-60 seconds. Don't pad — only as long as the story requires.`;
    const shotCountNote = autoShotCount ? `You decide how many shots this story needs. Could be 2 for a simple before/after. Could be 6+ for an epic. Match the shot count to the story — don't force a structure.` : `Generate exactly ${numScenes} shots.`;
    durationGuidance = `

FULL AUTO MODE — YOU ARE THE DIRECTOR:
${shotCountNote}
${totalLenNote}
You decide the duration of each shot based on what it needs. Available durations: 2, 4, 6, or 8 seconds.
- Quick reactions, reveals, cutaways: 2-4 seconds
- Action beats, medium dialogue: 4-6 seconds
- Establishing shots, longer dialogue, emotional moments: 6-8 seconds
- Vary the durations — not all the same. Set the "duration" field on each shot.

DIALOGUE WORD LIMITS (based on per-shot duration):
- 2s = MAX 4 words. 4s = MAX 8 words. 6s = MAX 12 words. 8s = MAX 18 words.
- COUNT the words for EACH shot based on its individual duration. If dialogue exceeds the limit, the video WILL cut off mid-sentence.

PACING: Use duration variety to create rhythm. A quick 2s cut followed by an 8s hold creates tension. An 8s establishing shot into 4s rapid cuts creates momentum.`;
  } else {
    const maxWords = fixedDuration <= 4 ? 8 : fixedDuration <= 6 ? 12 : 18;
    durationGuidance = `

SHOT DURATION: Each shot is EXACTLY ${fixedDuration} seconds long. This is a HARD constraint:

DIALOGUE WORD LIMIT (NON-NEGOTIABLE):
- People speak ~2.5 words per second
- ${fixedDuration}s = MAXIMUM ${maxWords} words of dialogue per shot
- COUNT EVERY WORD. If dialogue exceeds ${maxWords} words, the video WILL cut off mid-sentence
- When in doubt, SHORTER. A 10-word line that lands is better than an 18-word line that gets cut off

PHYSICAL PACING:
- Walking: ~${Math.round(fixedDuration * 1.4)}m in ${fixedDuration}s. Running: ~${Math.round(fixedDuration * 3)}m
- Slow camera push: ~${Math.round(fixedDuration * 0.3)}m in ${fixedDuration}s
- Specify movement speed explicitly (slow walk, brisk pace, sprinting)
- Everything described must be PHYSICALLY ACHIEVABLE in ${fixedDuration} real seconds`;
  }

  const musicNote = noMusic ? `\n\nNO MUSIC: The user has disabled music. Do NOT include any background music, soundtrack, or musical score in audio cues. Only include diegetic sounds — ambient noise, dialogue, footsteps, environmental sounds, etc. The user will add music in post-production.` : '';

  const sceneCountGuidance: Record<number, string> = {
    2: `NARRATIVE STRUCTURE (2 SCENES):
This is a BEFORE/AFTER or SETUP/PAYOFF. Two shots that create meaning through contrast.
- Scene 1: Establish the situation, character, and tension
- Scene 2: The punchline, reveal, consequence, or transformation
Think: cause → effect. Question → answer. Calm → chaos. The cut between them IS the story.`,
    3: `NARRATIVE STRUCTURE (3 SCENES):
Classic three-act structure compressed into 3 shots. Beginning, middle, end.
- Scene 1: ESTABLISH — set the world, introduce the character, show the status quo. Wide or medium shot.
- Scene 2: ESCALATE — something changes, goes wrong, or intensifies. Move closer (close-up or over-shoulder).
- Scene 3: RESOLVE — the payoff, punchline, consequence, or emotional landing. Different angle that recontextualizes what we saw.
Each scene must ADVANCE the story. No two scenes should show the same beat.`,
    4: `NARRATIVE STRUCTURE (4 SCENES):
Four shots gives you room for a proper dramatic arc with a twist or complication.
- Scene 1: ESTABLISH — world, character, context. Set the tone.
- Scene 2: DEVELOP — deepen the situation, reveal a detail, build tension or comedy.
- Scene 3: COMPLICATE — the twist, the interruption, the thing that changes everything.
- Scene 4: LAND — the payoff, the reaction, the consequence. End on the strongest image.
Think of it as: situation → deepening → disruption → aftermath.`,
    5: `NARRATIVE STRUCTURE (5 SCENES):
Five shots is a short film. You have room to BREATHE — use it for rhythm and pacing.
- Scene 1: OPEN — establishing shot, set the world. Give context.
- Scene 2: INTRODUCE — show who we're following and what they're doing.
- Scene 3: DEVELOP — build, complicate, or deepen. Add a new element or tension.
- Scene 4: CLIMAX — the peak moment, the biggest reaction, the turning point.
- Scene 5: RESOLVE — aftermath, consequence, punchline, or quiet denouement.
Vary the energy: don't make every scene intense. Use contrast — quiet/loud, wide/close, fast/slow.`,
  };

  let sceneNarrative: string;
  if (autoShotCount) {
    sceneNarrative = `NARRATIVE STRUCTURE — YOU DECIDE:
You choose the number of shots based on what the story needs. Think like a director:
- 2 shots: Before/after. Setup/payoff. Cause/effect.
- 3 shots: Three-act structure. Beginning, middle, end.
- 4 shots: Dramatic arc with a twist or complication.
- 5+ shots: A proper short film with sequences.
Match the structure to the concept. A simple joke needs 2-3 shots. An emotional story might need 4-5. An epic concept could need 6+.
Every shot must ADVANCE the story — no filler, no repeated beats.`;
  } else {
    sceneNarrative = sceneCountGuidance[numScenes!] || (numScenes! >= 6 ? `NARRATIVE STRUCTURE (${numScenes} SCENES):
With ${numScenes} shots you're making a proper short film. Think in SEQUENCES, not individual shots.
- Opening sequence (scenes 1-2): Establish world, character, tone
- Development (scenes 3-${Math.floor(numScenes! * 0.6)}): Build the story, add complications, deepen characters
- Climax (scene ${Math.floor(numScenes! * 0.7)}-${Math.floor(numScenes! * 0.8)}): Peak tension or comedy
- Resolution (final ${numScenes! - Math.floor(numScenes! * 0.8)} scenes): Payoff, consequence, ending
Vary pacing — not every scene should be the same intensity. Use quiet moments to make loud ones hit harder. Think about rhythm like music: verse, chorus, bridge, chorus.` : sceneCountGuidance[3]);
  }

  const shotCountInstruction = autoShotCount
    ? `Generate the optimal number of shots for this story.`
    : `Generate exactly ${numScenes} shots.`;
  const durationInstruction = isAuto
    ? `Choose the best duration (2/4/6/8s) for each shot.${totalLength ? ` Target ~${totalLength}s total.` : ' You decide the total length.'}`
    : `Each shot is ${fixedDuration} seconds long. Everything described must fit within ${fixedDuration} seconds of real time.`;

  const scenesTextPrompt = `${systemPrompt}${SCENE_AGENT_BASE}${durationGuidance}\n\n${sceneNarrative}${musicNote}\n\nVideo Idea:\n${ideaSummary}\n\n${shotCountInstruction} ${durationInstruction} Do not self-censor or water down the creative concept — commit fully to the idea.${referenceImages?.length ? '\n\nThe user has provided reference images — use them as visual guidance for the style, environment, characters, and mood of each shot. Match the look and feel closely.' : ''}`;

  const result = referenceImages && referenceImages.length > 0
    ? await generateObject({
        model: getTextModel(modelId),
        temperature: 1,
        schema: scenesResultSchema,
        messages: [
          {
            role: 'user' as const,
            content: [
              ...referenceImages.map(img => ({ type: 'image' as const, image: img })),
              { type: 'text' as const, text: scenesTextPrompt },
            ],
          },
        ],
      })
    : await generateObject({
        model: getTextModel(modelId),
        temperature: 1,
        schema: scenesResultSchema,
        prompt: scenesTextPrompt,
      });

  console.log('✅ SCENES AGENT: Complete');
  console.log(`📹 Generated ${result.object.scenes.length} scenes:`);
  result.object.scenes.forEach((scene, i) => {
    console.log(`\n  Scene ${i + 1}:`);
    console.log(`  Prompt: ${scene.prompt.substring(0, 100)}...`);
    console.log(`  Duration: ${scene.duration}s`);
  });
  console.log(`\n🎨 Consistency Notes: ${result.object.consistencyNotes}`);
  console.log('');

  return result.object as ScenesResult;
}

// Veo3 prompter agent removed — shot agent now writes Veo3-ready prompts directly

/**
 * Mood Board Agent: Generate reference images from concept using Gemini
 */
export async function executeMoodBoardAgent(
  idea: VideoIdea,
  referenceImages?: string[],
  onImage?: (index: number, url: string) => void,
  aspectRatio?: string,
): Promise<string[]> {
  console.log('\n🖼️  MOOD BOARD AGENT: Starting...');
  console.log(`📋 Concept: ${idea.title}`);
  console.log(`🎨 Style: ${idea.style}, Mood: ${idea.mood}`);

  const hasRefs = referenceImages && referenceImages.length > 0;

  const moodBoardPrompt = `Generate a single frame grab from a real film for this video concept:

Title: ${idea.title}
Description: ${idea.description}
Visual Style: ${idea.style}
Mood: ${idea.mood}
Key Elements: ${idea.keyElements.join(', ')}

This must look like a FRAME GRAB pulled from a real movie — NOT a stock photo, NOT a posed portrait, NOT a clean render. Think: a single frame from a film by the Coen Brothers, Denis Villeneuve, or Greta Gerwig. The kind of frame that if you paused the movie, it would look like this.

Requirements for realism:
- If people are present: they are MID-ACTION, caught in a moment. Asymmetric posture, hands doing something, weight shifted, eyes looking at something specific (never at camera). They look like they've been in this scene for 20 minutes, not like they just arrived.
- Environment must be LIVED IN: clutter, wear, practical light sources (lamps, screens, neon, windows casting specific shadows). Objects that suggest human activity — a half-finished drink, a crumpled receipt, shoes by a door.
- Lighting from PRACTICAL SOURCES in the scene, not generic studio lighting. The light should have a visible origin — a window, a streetlight, a desk lamp, a phone screen.
- Depth in the frame: foreground elements (slightly out of focus), subject in the midground, background detail. Not flat.
- Imperfection: a stray hair, a wrinkle in fabric, dust in a light beam, condensation on glass. Perfect = fake.${hasRefs ? '\n\nThe user has provided reference images — use them as strong visual guidance for style, color palette, composition, and subject matter. Match the look and feel of the reference images closely.' : ''}`;

  const results: string[] = [];

  if (hasRefs) {
    console.log(`📎 ${referenceImages.length} user reference image(s) provided — passing to Gemini`);
  }

  // Generate 3 mood board images using Gemini multimodal
  for (let i = 0; i < 3; i++) {
    try {
      console.log(`🖼️  Generating mood board image ${i + 1}/3...`);
      const url = await geminiImage(moodBoardPrompt + ' Output only the image.', referenceImages, aspectRatio);
      if (url) {
        results.push(url);
        console.log(`✅ Mood board image ${i + 1} generated`);
        onImage?.(i, url);
      } else {
        console.error(`❌ No image returned for mood board ${i + 1}`);
      }
    } catch (error) {
      console.error(`❌ Failed to generate mood board image ${i + 1}:`, error instanceof Error ? error.message : error);
    }
  }

  console.log(`✅ MOOD BOARD AGENT: Complete — ${results.length}/3 images generated\n`);
  return results;
}

// ── Storyboard Pipeline: Character Portraits → Group Refs → Scene Frames ──
// Uses generateText with Gemini multimodal output (same approach as avatar generation)

export async function geminiImage(prompt: string, referenceImages?: string[], aspectRatio?: string, rawPrompt?: boolean): Promise<string> {
  // Build Google provider options with aspect ratio if provided
  const googleOptions: Record<string, any> = { responseModalities: ['TEXT', 'IMAGE'] };
  if (aspectRatio) {
    googleOptions.imageConfig = { aspectRatio };
  }

  let result;
  if (referenceImages && referenceImages.length > 0) {
    console.log(`  📎 geminiImage: passing ${referenceImages.length} reference image(s) (sizes: ${referenceImages.map(r => `${Math.round(r.length / 1024)}KB`).join(', ')})${rawPrompt ? ' [raw prompt mode]' : ''}`);
    // Multimodal: pass reference images + text prompt
    // When rawPrompt is true, skip the generic wrapper — the caller's prompt already handles the reference context
    const refPrompt = rawPrompt
      ? prompt
      : `You are given ${referenceImages.length} reference image(s). These are the user's visual references — you MUST use them as the primary basis for the generated image. Match their visual style, color palette, lighting, composition, subject matter, and overall aesthetic as closely as possible. The output should look like it belongs in the same film or photo series as the reference images.\n\n${prompt}`;
    const content: any[] = referenceImages.map(img => ({ type: 'image' as const, image: img }));
    content.push({ type: 'text' as const, text: refPrompt });
    result = await generateText({
      model: getTextModel('google/gemini-2.5-flash-image'),
      providerOptions: {
        google: googleOptions,
      },
      messages: [{ role: 'user' as const, content }],
    });
  } else {
    result = await generateText({
      model: getTextModel('google/gemini-2.5-flash-image'),
      providerOptions: {
        google: googleOptions,
      },
      prompt,
    });
  }
  const imageFile = result.files?.find(f => f.mediaType.startsWith('image/'));
  if (!imageFile) return '';

  // Compress to JPEG before uploading — Gemini PNGs can be 2-5MB, JPEG ~100-300KB
  const rawBuffer = Buffer.from(imageFile.uint8Array);
  const jpegBuffer = await sharp(rawBuffer).jpeg({ quality: 80 }).toBuffer();
  const blob = await put(`storyboard/${crypto.randomUUID()}.jpg`, jpegBuffer, {
    access: 'public',
    contentType: 'image/jpeg',
    cacheControlMaxAge: 31536000,
  });
  return blob.url;
}

/**
 * Step 1: Generate individual character portraits
 */
export async function generateCharacterPortraits(
  characters: Character[],
  style: string,
  mood: string,
  modeId?: string,
  onPortrait?: (name: string, url: string) => void,
  moodBoard?: string[],
): Promise<Record<string, string>> {
  console.log(`\n🧑 PORTRAITS: Generating ${characters.length} character portraits...`);
  if (moodBoard?.length) console.log(`🧑 Mood board: ${moodBoard.length} image(s) will be used as style references`);
  const portraits: Record<string, string> = {};

  const promises = characters.map(async (char) => {
    try {
      console.log(`🧑 Generating portrait for ${char.name}...`);
      // Pass only the primary (user-selected) mood board image as reference
      const primaryMoodRef = moodBoard?.length ? [moodBoard[0]] : undefined;
      const portraitPrompt = primaryMoodRef
        ? `You are lighting a character reference portrait for a film production. The attached image is a frame from this film — study its color grade, the quality of light (hard vs soft, warm vs cool, high-key vs low-key), the contrast ratio, and the film stock texture (grain, halation, color rendition).

Now generate a portrait of this character lit with THAT SAME quality of light. The face should look like it belongs in that film. Same color temperature hitting the skin. Same contrast ratio between key and fill. Same shadow density. Same highlight rolloff. Same grain structure.

Subject: ${char.description}

Framing: Tight medium close-up, chest up. Pure black background (#000000) — the character is isolated against black, like a casting reference photo. But the LIGHT on their face must match the reference frame exactly. If the reference is warm tungsten, the key light is warm tungsten. If it's cool overcast, the key is cool overcast. The grade on the skin, hair, and clothing matches the reference film's grade.

This is a definitive character reference for continuity. Every physical detail (face, hair, skin, build, clothing) must be precisely rendered. This person must be recognizable in every subsequent frame.

NO graphics, captions, text, labels. Output only the image.`
        : `Cinematic character portrait. ${style} visual style and color grade. Shallow depth of field, motivated lighting.

Subject: ${char.description}

Framing: Tight medium close-up from chest up. Subject fills the frame. Pure solid black background (#000000). The character is completely isolated against a clean black void — no environment, no set, no backdrop. The face is the focal point, lit with intention — key light with subtle fill, natural skin tones.

This is a definitive character reference photograph for a film production. Every detail of their appearance (face, hair, skin, build, clothing) must be precisely rendered as described. This exact person must be recognizable in every subsequent frame.

NO overlay graphics, captions, speech bubbles, subtitles, labels, or watermarks. Clean photographic image only. Output only the image.`;
      const url = await geminiImage(portraitPrompt, primaryMoodRef, undefined, !!primaryMoodRef);
      if (url) {
        portraits[char.name] = url;
        console.log(`✅ Portrait for ${char.name} generated`);
        onPortrait?.(char.name, url);
      } else {
        console.error(`❌ No image returned for ${char.name}`);
      }
    } catch (error) {
      console.error(`❌ Failed to generate portrait for ${char.name}:`, error instanceof Error ? error.message : error);
    }
  });

  await Promise.allSettled(promises);
  console.log(`✅ PORTRAITS: ${Object.keys(portraits).length}/${characters.length} generated\n`);
  return portraits;
}

/**
 * Step 2: Generate group references for scenes with 2+ characters
 */
export async function generateGroupReferences(
  scenes: { characters: string[] }[],
  characters: Character[],
  portraits: Record<string, string>,
  style: string,
  mood: string,
  aspectRatio?: string,
): Promise<Record<string, string>> {
  console.log('\n👥 GROUP REFS: Finding multi-character scenes...');
  const groupRefs: Record<string, string> = {};

  // Find unique character combos
  const combos = new Map<string, string[]>();
  for (const scene of scenes) {
    if (scene.characters.length >= 2) {
      const key = [...scene.characters].sort().join('+');
      if (!combos.has(key)) combos.set(key, scene.characters);
    }
  }

  if (combos.size === 0) {
    console.log('👥 No multi-character scenes — skipping group refs\n');
    return groupRefs;
  }

  console.log(`👥 Generating ${combos.size} group reference(s)...`);

  const promises = Array.from(combos.entries()).map(async ([key, names]) => {
    try {
      const charDescs = names.map(n => {
        const c = characters.find(ch => ch.name === n);
        return c ? `${c.name}: ${c.description}` : n;
      }).join('. ');

      // Collect portrait images as visual references
      const refImages = names.map(n => portraits[n]).filter(Boolean);

      console.log(`👥 Generating group ref for ${key} (with ${refImages.length} portrait ref(s))...`);
      const url = await geminiImage(
        `The attached images are character reference portraits. Generate a NEW image placing these EXACT same people together in one cinematic frame.

Cinematic two-shot. ${style} visual style and color grade. Wide aperture, motivated lighting.

Characters: ${charDescs}

Framing: Medium shot, both characters clearly visible with natural spatial relationship. Cinematic composition — rule of thirds, depth in frame. Each character must look IDENTICAL to their reference portrait — same face, same hair, same skin tone, same build, same clothing.

NO overlay graphics, captions, speech bubbles, subtitles, labels, or watermarks. Clean photographic image only. Output only the image.`,
        refImages,
        aspectRatio
      );
      if (url) {
        groupRefs[key] = url;
        console.log(`✅ Group ref for ${key} generated`);
      } else {
        console.error(`❌ No image returned for group ${key}`);
      }
    } catch (error) {
      console.error(`❌ Failed to generate group ref for ${key}:`, error instanceof Error ? error.message : error);
    }
  });

  await Promise.allSettled(promises);
  console.log(`✅ GROUP REFS: ${Object.keys(groupRefs).length}/${combos.size} generated\n`);
  return groupRefs;
}

/**
 * Step 2.5: Generate environment/background images for each scene (no characters)
 */
export async function generateEnvironmentImages(
  scenes: { prompt: string; characters: string[] }[],
  style: string,
  mood: string,
  modeId?: string,
  onFrame?: (index: number, url: string) => void,
  aspectRatio?: string,
  moodBoard?: string[],
): Promise<string[]> {
  console.log(`\n🏞️  ENVIRONMENTS: Generating ${scenes.length} environment image(s)...`);
  if (moodBoard?.length) console.log(`🏞️  Mood board: ${moodBoard.length} image(s) will be used as style references`);
  const results = new Array<string>(scenes.length).fill('');

  // Step 1: LLM location clustering — scenes in the same physical space get the same group ID
  let locationGroups: number[];
  try {
    const { object } = await generateObject({
      model: getTextModel('google/gemini-3-flash'),
      schema: z.object({
        groups: z.array(z.number()).describe('Location group ID (0-indexed) per scene. Same physical location = same ID.')
      }),
      prompt: `Analyze these scene descriptions and assign location group IDs. Scenes that take place in the SAME physical location (e.g. both in "a locker room" or both in "a kitchen") should share the same group ID. Different locations get different IDs. Return exactly ${scenes.length} IDs (one per scene).\n\n${scenes.map((s, i) => `Scene ${i + 1}: ${s.prompt}`).join('\n')}`
    });
    locationGroups = object.groups;
    // Validate length
    if (locationGroups.length !== scenes.length) {
      console.warn(`⚠️  Location grouping returned ${locationGroups.length} IDs for ${scenes.length} scenes — falling back to one-per-scene`);
      locationGroups = scenes.map((_, i) => i);
    }
  } catch (error) {
    console.warn('⚠️  Location grouping failed — falling back to one-per-scene:', error instanceof Error ? error.message : error);
    locationGroups = scenes.map((_, i) => i);
  }

  const uniqueGroups = new Set(locationGroups);
  console.log(`🏞️  Location grouping: ${uniqueGroups.size} unique location(s) across ${scenes.length} scenes`);
  console.log(`🏞️  Groups: [${locationGroups.join(', ')}]`);

  // Find the first (primary) scene index for each location group
  const primaryIndexByGroup = new Map<number, number>();
  locationGroups.forEach((groupId, sceneIdx) => {
    if (!primaryIndexByGroup.has(groupId)) {
      primaryIndexByGroup.set(groupId, sceneIdx);
    }
  });

  const toneOverride = modeId && STORYBOARD_TONE_OVERRIDES[modeId]
    ? STORYBOARD_TONE_OVERRIDES[modeId]
    : `${style} visual style, ${mood} mood`;

  // Step 2: Generate primary environments (one per unique location) in parallel
  const primaryPromises = Array.from(primaryIndexByGroup.entries()).map(async ([groupId, sceneIdx]) => {
    const scene = scenes[sceneIdx];
    try {
      console.log(`🏞️  Generating PRIMARY environment for group ${groupId} (scene ${sceneIdx + 1})...`);
      const refImages = moodBoard?.length ? moodBoard : undefined;
      const hasMoodRef = !!refImages;
      const url = await geminiImage(
        `${hasMoodRef ? 'The attached image is the visual style reference for this production. Study its color grade, lighting quality, and film stock texture. The environment you generate must look like it was shot in the same film — same color temperature, same contrast, same grain, same production value.\n\n' : ''}Cinematic empty set / location scout photograph. ${toneOverride}. Generate ONLY the physical environment described below — the location, lighting, set dressing, props, atmosphere. ABSOLUTELY NO PEOPLE or characters. The set is empty, waiting for actors.

Shot description: ${scene.prompt}

This is a LOCATION SCOUT photograph — an empty set photographed before the actors arrive. Practical light sources, lived-in details, depth in the frame. Every physical detail matters because this exact location will appear in multiple shots from different angles.

NO overlay graphics, captions, labels, or watermarks. Clean photographic image only. Output only the image.`,
        refImages,
        aspectRatio,
        hasMoodRef,
      );
      if (url) {
        results[sceneIdx] = url;
        console.log(`✅ Primary environment for group ${groupId} (scene ${sceneIdx + 1}) generated`);
        onFrame?.(sceneIdx, url);
      } else {
        console.error(`❌ No image returned for primary environment group ${groupId}`);
      }
    } catch (error) {
      console.error(`❌ Failed to generate primary environment for group ${groupId}:`, error instanceof Error ? error.message : error);
    }
  });

  await Promise.allSettled(primaryPromises);

  // Step 3: Generate secondary environments (other scenes at same location) using primary as reference
  const secondaryScenes = scenes
    .map((scene, i) => ({ scene, i, groupId: locationGroups[i] }))
    .filter(({ i, groupId }) => primaryIndexByGroup.get(groupId) !== i);

  if (secondaryScenes.length > 0) {
    console.log(`🏞️  Generating ${secondaryScenes.length} secondary environment(s) SEQUENTIALLY using accumulated references...`);
    for (const { scene, i, groupId } of secondaryScenes) {
      try {
        const primaryIdx = primaryIndexByGroup.get(groupId)!;
        const primaryUrl = results[primaryIdx];
        // Use the primary environment as reference — it carries the mood board's style DNA
        // Also include any previously generated environments for this same location group
        const refImages: string[] = [];
        if (primaryUrl) refImages.push(primaryUrl);
        // Add other already-generated angles for this location (not the hero, not the current scene)
        for (let idx = 0; idx < results.length; idx++) {
          if (results[idx] && locationGroups[idx] === groupId && idx !== primaryIdx && idx !== i) {
            refImages.push(results[idx]);
          }
        }

        console.log(`🏞️  Generating SECONDARY environment for scene ${i + 1} (group ${groupId}, ref from scene ${primaryIdx + 1}, ${refImages.length} ref(s))...`);
        const url = await geminiImage(
          `${primaryUrl ? 'The attached image is the HERO SHOT of this location. You are generating a DIFFERENT CAMERA ANGLE of the EXACT SAME physical space.\n\nThis is NOT a similar location. This is the SAME room / vehicle / space. Every physical detail must be consistent:\n- Same make/model of vehicle or same room dimensions\n- Same color of walls, upholstery, surfaces\n- Same furniture, fixtures, objects in their same positions\n- Same practical light sources (lamps, windows, dashboard lights)\n- Same time of day, same ambient lighting quality\n- Same level of wear, clutter, and lived-in detail\n\nThe ONLY thing that changes is where the camera is positioned and what lens is used.\n\n' : ''}Cinematic empty set — a different camera angle of the same location. ${toneOverride}. Generate ONLY the physical environment. ABSOLUTELY NO PEOPLE or characters.

Shot description (this tells you the new camera position): ${scene.prompt}

Move the camera to the position described above, but keep everything else physically identical to the reference. If the reference shows a car interior, this is the SAME car — same steering wheel, same dashboard, same seats, same everything. Only the camera moved.

NO overlay graphics, captions, labels, or watermarks. Output only the image.`,
          refImages.length > 0 ? refImages : undefined,
          aspectRatio,
          !!primaryUrl,
        );
        if (url) {
          results[i] = url;
          console.log(`✅ Secondary environment for scene ${i + 1} generated`);
          onFrame?.(i, url);
        } else {
          console.error(`❌ No image returned for secondary environment scene ${i + 1}`);
        }
      } catch (error) {
        console.error(`❌ Failed to generate secondary environment for scene ${i + 1}:`, error instanceof Error ? error.message : error);
      }
    }
  }

  console.log(`✅ ENVIRONMENTS: ${results.filter(Boolean).length}/${scenes.length} generated\n`);
  return results;
}

/**
 * Continuity check: compare two consecutive frames and flag breaks
 */
async function continuityCheck(
  prevFrameUrl: string,
  newFrameUrl: string,
  shotDescription: string,
): Promise<{ needsRegen: boolean; feedback: string; scores: Record<string, number> }> {
  try {
    const { object } = await generateObject({
      model: getTextModel('google/gemini-3-flash'),
      schema: z.object({
        colorGrade: z.number().min(1).max(10).describe('Color grade consistency between frames'),
        lighting: z.number().min(1).max(10).describe('Lighting quality and direction match'),
        characterMatch: z.number().min(1).max(10).describe('Character appearance consistency'),
        environmentMatch: z.number().min(1).max(10).describe('Physical environment continuity'),
        issue: z.string().describe('If any score is below 6, describe the specific continuity break. Empty string if all good.'),
      }),
      messages: [{
        role: 'user',
        content: [
          { type: 'image', image: prevFrameUrl },
          { type: 'image', image: newFrameUrl },
          { type: 'text', text: `These are two consecutive shots from the same film scene. The second shot is: "${shotDescription}".\n\nRate continuity 1-10 for each category. These should look like they were shot on the same set, with the same camera department, in the same lighting setup, minutes apart. A 10 means perfect match. Below 6 means a visible break that would be caught by a script supervisor.\n\nIf any score is below 6, describe the specific break (e.g. "color grade shifted from warm amber to cool blue" or "the car interior changed from leather to fabric seats").` },
        ],
      }],
    });

    const scores = {
      colorGrade: object.colorGrade,
      lighting: object.lighting,
      characterMatch: object.characterMatch,
      environmentMatch: object.environmentMatch,
    };
    const minScore = Math.min(...Object.values(scores));
    return {
      needsRegen: minScore < 6,
      feedback: object.issue || '',
      scores,
    };
  } catch (error) {
    console.warn('⚠️ Continuity check failed:', error instanceof Error ? error.message : error);
    return { needsRegen: false, feedback: '', scores: {} };
  }
}

/**
 * Step 3: Generate scene storyboard frames using character references
 */
export async function generateSceneStoryboards(
  scenes: { prompt: string; characters: string[]; duration: number }[],
  characters: Character[],
  portraits: Record<string, string>,
  groupRefs: Record<string, string>,
  style: string,
  mood: string,
  modeId?: string,
  onFrame?: (index: number, url: string) => void,
  aspectRatio?: string,
  environmentImages?: string[],
  moodBoard?: string[],
): Promise<string[]> {
  console.log(`\n🎬 STORYBOARD: Generating ${scenes.length} scene frames SEQUENTIALLY...`);
  const results = new Array<string>(scenes.length).fill('');

  // Sequential generation — each frame sees the previous frame for continuity
  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    try {
      // Build character context and collect reference images
      let charContext = '';
      const refImages: string[] = [];
      const sceneChars = scene.characters.map(n => characters.find(c => c.name === n)).filter(Boolean);

      if (sceneChars.length > 0) {
        charContext = sceneChars.map(c => `${c!.name}: ${c!.description}`).join('. ') + '. ';
      }

      // Always include individual character portraits
      const portraitNames: string[] = [];
      scene.characters.forEach(n => {
        if (portraits[n]) {
          refImages.push(portraits[n]);
          portraitNames.push(n);
        }
      });

      // Also include group ref if available for multi-character scenes
      let hasGroupRef = false;
      if (scene.characters.length >= 2) {
        const key = [...scene.characters].sort().join('+');
        if (groupRefs[key]) {
          refImages.push(groupRefs[key]);
          hasGroupRef = true;
        }
      }

      // Add environment image FIRST — this is the background the characters are placed into
      const hasEnvironment = !!environmentImages?.[i];
      if (hasEnvironment) {
        refImages.unshift(environmentImages![i]);
      }

      // Add previous frame for continuity threading
      const prevFrame = i > 0 ? results[i - 1] : null;
      const hasPrevFrame = !!prevFrame;
      if (hasPrevFrame) {
        refImages.push(prevFrame);
      }

      // Build prompt prefix describing each reference image
      let refDescription = '';
      if (refImages.length > 0) {
        let idx = 1;
        const parts: string[] = [];
        if (hasEnvironment) {
          parts.push(`Image ${idx}: THE BACKGROUND. This is the environment/set for this shot. Place the characters INTO this exact location. Do not invent a new location.`);
          idx++;
        }
        if (portraitNames.length > 0) {
          const endIdx = idx + portraitNames.length - 1;
          parts.push(`Image${portraitNames.length > 1 ? `s ${idx}-${endIdx}` : ` ${idx}`}: Character reference portrait(s) (${portraitNames.join(', ')}). Each character must look IDENTICAL to their portrait.`);
          idx = endIdx + 1;
        }
        if (hasGroupRef) {
          parts.push(`Image ${idx}: Group reference showing these characters together.`);
          idx++;
        }
        if (hasPrevFrame) {
          parts.push(`Image ${idx}: THE PREVIOUS SHOT. This frame comes IMMEDIATELY AFTER this image in the film. Maintain visual continuity — same color grade, same lighting quality, same production value, same physical space. Characters who appear in both frames must look identical. This is the same scene, moments later.`);
          idx++;
        }
        refDescription = parts.join('\n') + '\n\n';
      }

      const buildPrompt = (continuityNote?: string) =>
        `${refDescription}${hasEnvironment ? 'CRITICAL: The FIRST reference image is the LOCKED BACKGROUND. You are compositing characters into this exact physical space. Every surface, object, and light source must match the reference.\n\n' : ''}${hasPrevFrame ? 'CONTINUITY: The LAST reference image is the previous shot in the sequence. Your frame must look like it comes from the same film, shot on the same day, with the same camera department. Match the color grade, contrast, grain, and overall feel.\n\n' : ''}${continuityNote ? `CONTINUITY FIX: ${continuityNote}\n\n` : ''}Cinematic production still — frame grab from a film. ${modeId && STORYBOARD_TONE_OVERRIDES[modeId] ? STORYBOARD_TONE_OVERRIDES[modeId] + '.' : `${style} visual style, ${mood} mood.`}

Shot description: ${scene.prompt}

${charContext ? `Characters in this frame: ${charContext}\n` : ''}${hasEnvironment ? 'Place these characters INTO the environment from the reference image. The background is locked.\n\n' : ''}Requirements:
- ${hasEnvironment ? 'BACKGROUND IS LOCKED — same physical space as environment reference.\n- ' : ''}Characters must be lit to match the environment — same color temperature, same direction.
- Characters are MID-ACTION, not posing. Asymmetric positions, weight shifted.
- Characters NEVER look at the camera.
${hasPrevFrame ? '- MATCH the color grade and overall look of the previous shot exactly.\n' : ''}
Match the camera position, lens, and framing from the shot description.

NO overlay graphics, captions, speech bubbles, dialogue text, subtitles, labels, or watermarks. Output only the image.`;

      console.log(`🎬 Generating frame ${i + 1}/${scenes.length} (${refImages.length} refs: ${hasEnvironment ? 1 : 0} env, ${portraitNames.length} portrait(s), ${hasGroupRef ? 1 : 0} group, ${hasPrevFrame ? 1 : 0} prev)...`);

      let url = await geminiImage(
        buildPrompt(),
        refImages.length > 0 ? refImages : undefined,
        aspectRatio,
        hasEnvironment || hasPrevFrame,
      );

      if (url) {
        results[i] = url;
        console.log(`✅ Frame ${i + 1} generated`);
        onFrame?.(i, url);

        // Continuity check against previous frame (skip for first frame)
        if (hasPrevFrame) {
          console.log(`🔍 Continuity check: frame ${i} → frame ${i + 1}...`);
          const check = await continuityCheck(prevFrame, url, scene.prompt);
          console.log(`🔍 Scores: color=${check.scores.colorGrade} light=${check.scores.lighting} char=${check.scores.characterMatch} env=${check.scores.environmentMatch}${check.feedback ? ` | Issue: ${check.feedback}` : ''}`);

          if (check.needsRegen && check.feedback) {
            console.log(`⚠️ Continuity break on frame ${i + 1} — regenerating with feedback...`);
            const regenUrl = await geminiImage(
              buildPrompt(check.feedback),
              refImages.length > 0 ? refImages : undefined,
              aspectRatio,
              hasEnvironment || hasPrevFrame,
            );
            if (regenUrl) {
              results[i] = regenUrl;
              console.log(`✅ Frame ${i + 1} regenerated with continuity fix`);
              onFrame?.(i, regenUrl);
            }
          }
        }
      } else {
        console.error(`❌ No image returned for frame ${i + 1}`);
      }
    } catch (error) {
      console.error(`❌ Failed to generate frame ${i + 1}:`, error instanceof Error ? error.message : error);
    }
  }

  console.log(`✅ STORYBOARD: ${results.filter(Boolean).length}/${scenes.length} frames generated\n`);
  return results;
}

/**
 * Agent 3: Generate video from scene prompt using AI Gateway + Veo 3.1
 */
export async function executeVideoAgent(
  scenePrompt: string,
  style: string,
  mood: string,
  options: GenerationOptions,
  sceneIndex: number,
  referenceImage?: string,
  portraitUrls?: string[],
): Promise<Video> {
  console.log(`\n🎥 VIDEO AGENT: Starting for scene ${sceneIndex + 1}...`);
  console.log(`📝 Scene Prompt: ${scenePrompt.substring(0, 150)}...`);
  console.log(`🎨 Style: ${style}, Mood: ${mood}`);
  console.log(`⚙️  Options: ${options.aspectRatio}, ${options.duration}s`);
  if (portraitUrls?.length) console.log(`🧑 Portrait refs: ${portraitUrls.length}`);
  console.log('⏳ Generating video (this may take 2-5 minutes)...\n');

  const veoOptions = options.veoOptions;

  // Prompt is already optimized by the Veo3 Prompter agent (or passed directly in direct mode)
  const enhancedPrompt = scenePrompt;
  console.log(`🎬 Final Prompt: ${enhancedPrompt.substring(0, 200)}...\n`);

  const startTime = Date.now();

  try {
    // Generate video via AI Gateway
    const selectedModel = options.videoModel || 'google/veo-3.1-generate-001';
    const isI2V = selectedModel.includes('i2v');
    const isKling = selectedModel.includes('klingai');

    // Kling supports 5s and 10s durations — snap to nearest valid value
    const rawDuration = typeof options.duration === 'number' ? options.duration : 8;
    let videoDuration = isKling ? (rawDuration <= 7 ? 5 : 10) : rawDuration;
    if (isKling && rawDuration !== videoDuration) {
      console.log(`⚠️  Kling duration adjusted: ${rawDuration}s → ${videoDuration}s`);
    }

    console.log(`🎬 Using video model: ${selectedModel}${isI2V ? ' (image-to-video)' : ''}${referenceImage ? ' with reference image' : ''}`);

    // For i2v models, we need a reference image
    if (isI2V && !referenceImage) {
      // Fall back to the t2v variant
      const t2vModel = selectedModel.replace('-i2v', '-t2v');
      console.log(`⚠️  I2V model selected but no reference image — falling back to ${t2vModel}`);
      const model = getVideoModel(t2vModel);
      const generateOptions: any = {
        model,
        prompt: enhancedPrompt,
        aspectRatio: options.aspectRatio,
        duration: videoDuration,
      };
      if (isKling) {
        generateOptions.providerOptions = { klingai: { mode: 'std' } };
      }
      const { videos } = await generateVideo(generateOptions);
      const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`✅ VIDEO AGENT: Video generated in ${elapsedTime}s (fallback t2v)`);
      if (videos.length === 0) throw new Error('No video was generated');
      const videoFile = videos[0];
      const video = await saveVideo(videoFile, { prompt: enhancedPrompt, duration: videoDuration, aspectRatio: options.aspectRatio });
      return video;
    }

    const model = getVideoModel(selectedModel);

    // Always pass starting frame as image when a reference image is available
    const prompt = referenceImage
      ? { image: referenceImage, text: enhancedPrompt }
      : enhancedPrompt;

    const generateOptions: any = {
      model,
      prompt,
      aspectRatio: options.aspectRatio,
      duration: videoDuration,
    };

    if (isKling) {
      // Kling-specific provider options
      generateOptions.providerOptions = { klingai: { mode: 'std' } };
    } else {
      // Build Google/Veo provider options with full feature support
      const googleOptions: Record<string, any> = {};

      // personGeneration — required for I2V and reference images
      if (referenceImage || portraitUrls?.length) {
        googleOptions.personGeneration = 'allow_adult';
      } else {
        googleOptions.personGeneration = 'allow_all';
      }

      // negativePrompt
      if (veoOptions?.negativePrompt) {
        googleOptions.negativePrompt = veoOptions.negativePrompt;
      }

      // referenceImages — up to 3 character/asset reference images
      if (portraitUrls?.length) {
        googleOptions.referenceImages = portraitUrls.slice(0, 3).map(url => ({
          image: url,
          referenceType: 'asset',
        }));
        console.log(`🧑 Passing ${googleOptions.referenceImages.length} portrait reference(s) to Veo 3.1`);
      }

      // lastFrame — ending frame for interpolation
      if (veoOptions?.lastFrame) {
        googleOptions.lastFrame = veoOptions.lastFrame;
      }

      // resolution
      if (veoOptions?.resolution) {
        googleOptions.resolution = veoOptions.resolution;
      }

      // Duration must be 8s when using reference images, 1080p, or 4k
      if (googleOptions.referenceImages?.length ||
          veoOptions?.resolution === '1080p' ||
          veoOptions?.resolution === '4k') {
        videoDuration = 8;
        generateOptions.duration = videoDuration;
        console.log(`⚠️  Duration forced to 8s (required for reference images / high resolution)`);
      }

      if (Object.keys(googleOptions).length > 0) {
        generateOptions.providerOptions = { google: googleOptions };
      }
    }

    const { videos } = await generateVideo(generateOptions);

    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`✅ VIDEO AGENT: Video generated in ${elapsedTime}s`);
    console.log(`📊 Received ${videos.length} video(s)`);

    if (videos.length === 0) {
      throw new Error('No video was generated');
    }

    // Save first video to storage
    const videoFile = videos[0];
    console.log('💾 Saving video to storage...');

    const video = await saveVideo(videoFile, {
      prompt: enhancedPrompt,
      duration: videoDuration,
      aspectRatio: options.aspectRatio,
    });

    console.log(`✅ Video saved: ${video.filename}`);
    console.log(`📊 Size: ${(video.size / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`🔗 URL: ${video.url}\n`);

    return video;
  } catch (error) {
    const report = await inspectError(error);
    const lines = formatErrorReport(report);
    console.error(`❌ VIDEO AGENT: Failed to generate video for scene ${sceneIndex + 1}`);
    lines.forEach(l => console.error(`  ${l}`));
    throw new Error(report.summary);
  }
}

/**
 * Execute full multi-agent workflow
 */
export async function executeFullWorkflow(
  userInput: string,
  options: GenerationOptions
): Promise<{
  idea: VideoIdea;
  scenes: ScenesResult;
  videos: Video[];
}> {
  console.log('\n═══════════════════════════════════════════════════');
  console.log('🚀 STARTING MULTI-AGENT VIDEO GENERATION WORKFLOW');
  console.log('═══════════════════════════════════════════════════\n');

  // Agent 1: Generate idea
  const idea = await executeIdeaAgent(userInput);

  // Agent 2: Generate scenes
  const scenesResult = await executeScenesAgent(idea, options.numScenes, undefined, options.duration || 8, options.noMusic || false, options.totalLength);

  // Agent 3: Generate videos for each scene
  const videos: Video[] = [];
  for (let i = 0; i < scenesResult.scenes.length; i++) {
    const scene = scenesResult.scenes[i];
    try {
      const video = await executeVideoAgent(
        scene.prompt,
        idea.style,
        idea.mood,
        options,
        i
      );
      videos.push(video);
    } catch (error) {
      console.error(`⚠️  Skipping scene ${i + 1} due to error`);
      // Continue with next scene
    }
  }

  console.log('\n═══════════════════════════════════════════════════');
  console.log(`✅ WORKFLOW COMPLETE: ${videos.length}/${scenesResult.scenes.length} videos generated`);
  console.log('═══════════════════════════════════════════════════\n');

  return {
    idea,
    scenes: scenesResult,
    videos,
  };
}
