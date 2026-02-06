import {
  generateObject,
  experimental_generateVideo as generateVideo,
} from 'ai';
import { z } from 'zod';
import { getTextModel, getVideoModel } from './provider';
import { IDEA_AGENT_PROMPT, SCENES_AGENT_PROMPT } from '../prompts';
import { saveVideo } from './video-storage';
import type { VideoIdea, ScenesResult, Video, GenerationOptions } from '../types';

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
  prompt: z.string().describe('Veo 3.1-ready prompt: [SHOT TYPE] + [SUBJECT with full description] + [ACTION] + [DIALOGUE in quotes] + [STYLE/CAMERA/LENS] + [CAMERA MOVEMENT] + [AUDIO]. Must be fully self-contained — Veo 3.1 has zero context between shots.'),
  duration: z.number().describe('Duration in seconds (2, 4, 6, or 8)'),
  notes: z.string().describe('What happens narratively in this shot and how it connects to the next'),
});

const scenesResultSchema = z.object({
  scenes: z.array(sceneSchema).describe('Array of shots with Veo 3.1-ready prompts'),
  consistencyNotes: z.string().describe('Character descriptions and camera/style setup to maintain across all shots'),
});

/**
 * Agent 1: Generate creative video idea from user input
 */
export async function executeIdeaAgent(
  userInput: string,
  config?: { model?: string; prompt?: string }
): Promise<VideoIdea> {
  const modelId = config?.model || 'anthropic/claude-sonnet-4.5';
  const systemPrompt = config?.prompt || IDEA_AGENT_PROMPT;

  console.log('\n🎨 IDEA AGENT: Starting...');
  console.log(`📝 User Input: "${userInput}"`);
  console.log(`🤖 Model: ${modelId}\n`);

  const result = await generateObject({
    model: getTextModel(modelId),
    temperature: 1,
    schema: videoIdeaSchema,
    prompt: `${systemPrompt}\n\nUser Input: ${userInput}`,
  });

  console.log('✅ IDEA AGENT: Complete');
  console.log('📋 Generated Idea:', JSON.stringify(result.object, null, 2));
  console.log('');

  return result.object as VideoIdea;
}

// Base prompt appended to all scene agent calls (not shown in UI)
const SCENE_AGENT_BASE = `

SCENE CONSISTENCY RULES (MANDATORY):
- Choose ONE cinematic style/look for ALL scenes and repeat it verbatim in every prompt (e.g., "shot on ARRI Alexa, warm amber grade, shallow depth of field")
- Characters must be RECOGNIZABLE across scenes — same age, ethnicity, build, hair, and clothing. Re-describe these identity details every time. But allow their physical STATE to evolve naturally.
- If scenes share a location, describe the environment with the same details each time (same lighting conditions, same set dressing, same color palette)
- Scenes must feel like they belong to the same film — consistent color temperature, grain, contrast, and aspect ratio

SHOT VARIETY (CRITICAL — NO JUMP CUTS):
- Every scene MUST use a DIFFERENT shot type and camera angle. If scene 1 is a medium shot, scene 2 must be a close-up or wide shot — NEVER two medium shots in a row.
- Vary across these: wide/establishing, medium, close-up, extreme close-up, over-the-shoulder, low angle, high angle, profile/side angle
- Vary camera movement too: if scene 1 is a slow push, scene 2 should be static or an orbit — NOT another push
- Think like an EDITOR cutting a scene together. When these clips play back-to-back, each cut should show a meaningfully different framing. Same angle + same framing = jump cut = amateur.
- Example for 3 scenes: Scene 1: wide shot, static → Scene 2: close-up on face, slow push → Scene 3: over-shoulder medium, handheld

CRITICAL PROMPT STRUCTURE FOR EACH SCENE:
[SHOT TYPE] + [SUBJECT with full physical description] + [PRIMARY ACTION + natural body language] + [STYLE - identical across scenes] + [CAMERA MOVEMENT] + [AUDIO CUES]

Example: Medium shot, cyberpunk hacker (male, mid-30s, shaved head, black hoodie, pale skin, cybernetic arm) typing frantically, neon reflections on face, blade runner aesthetic, shot on ARRI Alexa with anamorphic lens, teal and orange color grade, slow push in, Audio: mechanical keyboard clicks, distant sirens

Rules:
- Front-load the important stuff — Veo 3 weights early words more heavily
- Lock down the "what" then iterate on the "how"
- ONE primary action per scene — the reason this shot exists. But allow natural secondary behavior within it (breathing, glancing, wincing, adjusting grip). "A man runs" is too simple. "A man runs while pressing a bleeding wound on his ribs" is one action with subtext.
- Specific > Creative — "Walking sadly" < "shuffling with hunched shoulders"
- Audio cues are essential — give the video a realistic feel
- ALWAYS include full character descriptions — never use "the character" or "the person", always redescribe them

Camera movements that work:
- Slow push/pull (dolly in/out)
- Orbit around subject
- Handheld follow
- Static with subject movement

Avoid:
- Complex combinations ("pan while zooming during a dolly")
- Unmotivated movements
- Multiple focal points
- Vague character references — always fully describe every person in frame

Style references that consistently deliver:
- "Shot on [specific camera]" (use the SAME camera for all scenes)
- "[Director name] style" (use the SAME director reference for all scenes)
- "[Movie] cinematography" (use the SAME film reference for all scenes)
- Specific color grading terms (use the SAME grade for all scenes)

DIALOGUE RULES (MANDATORY):
- Almost ALL videos should feature talking unless the concept genuinely has no speaking characters (pure nature, abstract, etc.)
- Include natural spoken dialogue in quotes within each scene prompt
- Write dialogue as SPOKEN WORDS — conversational, not literary. Use contractions always, natural pauses, filler words where they fit. Real people don't speak in complete, grammatically perfect sentences.
- Match dialogue to the mood: tense scenes = clipped, urgent. Calm scenes = wandering, trailing off. Comedy = matter-of-fact about absurd things.
- Dialogue across scenes should feel like one continuous conversation — each scene picks up roughly where the last left off.
- HARD WORD COUNT LIMIT: A person speaks ~2.5 words per second. For the scene duration, count the words in your dialogue and MAKE SURE they fit. An 8-second scene = MAX 15-18 words of dialogue (leave room for pauses and breathing). A 6-second scene = MAX 12 words. A 4-second scene = MAX 8 words. If your dialogue is longer than this, CUT IT DOWN. The video will literally cut off mid-sentence if you write too much. Shorter is always better — one punchy line beats a paragraph that gets cut off.
- BANNED WORDS: NEVER use "subtitle", "subtitles", "subtitled", "caption", "captions", or "text overlay" in any prompt. Veo 3.1 will render literal subtitle text on screen if these words appear. Write dialogue directly in quotes instead.

DIALOGUE FORMATTING (VEO 3.1 SPEECH MODEL):
- NEVER write dialogue in ALL CAPS — the speech model will try to yell everything. Use normal sentence case, even if the character is shouting. Convey intensity through word choice and stage direction ("shouting", "voice cracking"), not capitalization.
- NEVER use unusual/phonetic spellings for accents ("watcha doin'", "git outta here"). Write standard English with natural contractions. The speech model needs clean text to sound natural.

SELF-CONTAINED PROMPTS (CRITICAL — VEO 3.1 HAS ZERO MEMORY):
Each prompt you write is sent to Veo 3.1 INDEPENDENTLY. The model has ZERO context between shots. Every single prompt must re-describe EVERYTHING from scratch:
- Full character descriptions every time (age, build, hair, clothing, skin tone, distinguishing features). If you say "the same woman" without re-describing her, the model will generate a DIFFERENT person.
- Full environment description every time (location, set dressing, weather, time of day)
- Full style/look every time (camera body, lens, color grade, film stock reference)
- Full lighting setup every time
- Let physical STATE evolve naturally (more dirt, sweat, injuries as story progresses) while keeping IDENTITY consistent
Treat each prompt as if the model has never seen any other prompt in its life.`;

/**
 * Agent 2: Generate scene breakdown from video idea
 */
export async function executeScenesAgent(
  idea: VideoIdea,
  numScenes?: number,
  config?: { model?: string; prompt?: string },
  duration: number | 'auto' = 8,
  noMusic: boolean = false,
  totalLength?: number
): Promise<ScenesResult> {
  const modelId = config?.model || 'anthropic/claude-sonnet-4.5';
  const systemPrompt = config?.prompt || SCENES_AGENT_PROMPT;
  const autoShotCount = !numScenes;

  console.log('\n🎬 SCENES AGENT: Starting...');
  console.log(`📋 Idea: ${idea.title}`);
  console.log(`🎯 Target: ${autoShotCount ? 'auto' : numScenes} shots, ${duration}${typeof duration === 'number' ? 's' : ''} each`);
  console.log(`🤖 Model: ${modelId}\n`);

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

  const result = await generateObject({
    model: getTextModel(modelId),
    temperature: 1,
    schema: scenesResultSchema,
    prompt: `${systemPrompt}${SCENE_AGENT_BASE}${durationGuidance}\n\n${sceneNarrative}${musicNote}\n\nVideo Idea:\n${ideaSummary}\n\n${shotCountInstruction} ${durationInstruction} Do not self-censor or water down the creative concept — commit fully to the idea.`,
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
 * Agent 3: Generate video from scene prompt using AI Gateway + Veo 3.1
 */
export async function executeVideoAgent(
  scenePrompt: string,
  style: string,
  mood: string,
  options: GenerationOptions,
  sceneIndex: number
): Promise<Video> {
  console.log(`\n🎥 VIDEO AGENT: Starting for scene ${sceneIndex + 1}...`);
  console.log(`📝 Scene Prompt: ${scenePrompt.substring(0, 150)}...`);
  console.log(`🎨 Style: ${style}, Mood: ${mood}`);
  console.log(`⚙️  Options: ${options.aspectRatio}, ${options.duration}s`);
  console.log('⏳ Generating video (this may take 2-5 minutes)...\n');

  // Prompt is already optimized by the Veo3 Prompter agent (or passed directly in direct mode)
  const enhancedPrompt = scenePrompt;
  console.log(`🎬 Final Prompt: ${enhancedPrompt.substring(0, 200)}...\n`);

  const startTime = Date.now();

  try {
    // Generate video via AI Gateway using Veo 3.1
    const videoDuration = typeof options.duration === 'number' ? options.duration : 8;

    const { videos } = await generateVideo({
      model: getVideoModel('google/veo-3.1-generate-001'),
      prompt: enhancedPrompt,
      aspectRatio: options.aspectRatio,
      duration: videoDuration,
    });

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
    console.error(`❌ VIDEO AGENT: Failed to generate video for scene ${sceneIndex + 1}`);
    console.error('Error:', error);
    throw error;
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
