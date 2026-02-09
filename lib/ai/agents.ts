import {
  generateObject,
  generateText,
  experimental_generateVideo as generateVideo,
} from 'ai';
import { z } from 'zod';
import { getTextModel, getVideoModel } from './provider';
import { IDEA_AGENT_PROMPT, SCENES_AGENT_PROMPT } from '../prompts';
import { saveVideo } from './video-storage';
import { put } from '@vercel/blob';
import crypto from 'crypto';
import type { VideoIdea, ScenesResult, Video, GenerationOptions, Character } from '../types';
import { inspectError, formatErrorReport } from './error-inspector';

// Mode-specific visual tone overrides for storyboard image generation
const STORYBOARD_TONE_OVERRIDES: Record<string, string> = {
  deadpan: 'Flat institutional lighting, symmetrical static composition, fluorescent overhead, no dramatic shadows, mundane environment, DMV/waiting-room aesthetic, slightly overexposed',
  comedy: 'Bright natural lighting, warm tones, slightly messy lived-in environment, casual framing',
  unhinged: 'Match the wrong-genre aesthetic from the concept — if it says nature documentary, shoot it like a nature documentary. If prestige drama, make it look like prestige drama',
  action: 'High contrast, dynamic shadows, handheld energy, desaturated with pops of color',
  stylize: 'Follow the specific style direction from the concept exactly — this mode is artist-directed',
};

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

// Base prompt appended to all scene agent calls (not shown in UI)
const SCENE_AGENT_BASE = `

SCENE CONSISTENCY RULES (MANDATORY):
- Choose ONE cinematic style/look for ALL scenes and repeat it verbatim in every prompt (e.g., "shot on ARRI Alexa, warm amber grade, shallow depth of field")
- Characters must be RECOGNIZABLE across scenes — same age, ethnicity, build, hair, and clothing. Re-describe these identity details every time. But allow their physical STATE to evolve naturally.
- If scenes share a location, describe the environment with the same details each time (same lighting conditions, same set dressing, same color palette)
- Scenes must feel like they belong to the same film — consistent color temperature, grain, contrast, and aspect ratio
- LIGHTING DIRECTION: Key light must come from the same side across all shots in the same location. If the key light is camera-left in shot 1, it stays camera-left for every shot in that location. Changing key light direction between cuts makes it look like the scene was shot on different days.
- PROP CONTINUITY: If a character is holding something (coffee cup, phone, weapon, bag), that object must appear in EVERY scene where that character is present unless there is a clear narrative reason it's gone. Disappearing props break the illusion instantly.

SHOT VARIETY (CRITICAL — NO JUMP CUTS):
- Every scene MUST use a DIFFERENT shot type and camera angle. If scene 1 is a medium shot, scene 2 must be a close-up or wide shot — NEVER two medium shots in a row.
- Vary across these: wide/establishing, medium, close-up, extreme close-up, over-the-shoulder, low angle, high angle, profile/side angle
- Vary camera movement too: if scene 1 is a slow push, scene 2 should be static or an orbit — NOT another push
- Think like an EDITOR cutting a scene together. When these clips play back-to-back, each cut should show a meaningfully different framing. Same angle + same framing = jump cut = amateur.
- Example for 3 scenes: Scene 1: wide shot, static → Scene 2: close-up on face, slow push → Scene 3: over-shoulder medium, handheld

THE 180-DEGREE RULE (CRITICAL FOR CONVERSATIONS):
- Pick ONE side of the action line and stay on it for the entire sequence. If character A is screen-left and character B is screen-right in the establishing shot, maintain that spatial relationship in EVERY subsequent shot.
- In over-the-shoulder shots: if we're looking over A's left shoulder at B, then the reverse must be over B's right shoulder at A. Crossing the line makes the audience lose spatial orientation.
- SCREEN DIRECTION: If a character is moving left-to-right in one shot, they continue left-to-right in the next unless there's a motivated cut (arriving at a destination, a collision, a reversal). Flipping screen direction between cuts creates a jarring mismatch.
- In single-character scenes: if the character faces screen-right in shot 1, vary angle but maintain their general orientation — don't flip them to screen-left without motivation.

PROMPT LENGTH (HARD LIMIT — THIS IS THE MOST IMPORTANT RULE):
Each scene's "prompt" field must be 60-80 words MAX. Veo 3.1 deprioritizes everything past ~100 tokens — long prompts mean most of your details get IGNORED. Shorter prompts generate better videos.

Structure each prompt in this order (most important first):
1. Shot type + subject with key identifiers (15-20 words)
2. What the character is DOING and what CHANGES during the shot (10-15 words)
3. Lived-in environment with specific messy details (10-15 words)
4. Camera/lens + style tag (10-15 words)
5. Audio cue — diegetic, specific, layered (5-10 words)

Cut everything that doesn't change the generated video. Skip floor materials, exact Kelvin temperatures, fabric weave. Keep character descriptions to the essentials that make them RECOGNIZABLE: age, build, hair, key clothing.

EVERY SHOT IS A MOMENT, NOT A POSE (THIS IS WHAT SEPARATES FILM FROM STOCK FOOTAGE):
- We are dropping into a MOMENT ALREADY IN PROGRESS. The character was doing something before the camera found them. They will keep doing it after.
- Describe TRANSITIONAL actions — a hand mid-reach, a head turning, a body shifting weight from one foot to the other. NOT settled poses. NOT people standing still and looking at something.
- SOMETHING MUST CHANGE during the shot. An expression shifts. A hand moves. Someone enters or exits frame. A light changes. Stillness is death — even "still" shots have breath, blinking, micro-adjustments.
- AI stock footage looks like someone said "stand here and look thoughtful." Real movies look like someone caught a human being in the middle of living.

BAD (stock footage): "Close-up of a woman looking determined, city lights behind her"
GOOD (movie frame): "Close-up, a woman (late 20s, dark curly hair, paint-stained overalls) mid-blink, jaw tightening, fingers tapping the steering wheel, eyes tracking something moving screen-left. Rain-streaked windshield refracting red brake lights. Handheld, shallow focus, warm tungsten shift. Audio: wipers thumping, muffled traffic, her breath fogging the glass."

BAD (stock footage): "Wide shot of a man walking through a hallway"
GOOD (movie frame): "Wide shot, a man (40s, rumpled grey suit, loosened tie, coffee stain on shirt) pushing through a glass door mid-stride, badge lanyard swinging, looking back over his shoulder screen-right. Fluorescent-lit office corridor, papers taped to walls, one overhead light flickering. Steadicam follow, eye-level. Audio: door hiss, shoes on linoleum, distant phone ringing."

ENVIRONMENTS MUST BE LIVED IN:
- NO pristine surfaces. NO empty rooms. NO generic spaces. Real locations have STUFF in them — half-empty water bottles, post-it notes, scuff marks, a jacket thrown over a chair, condensation on a window.
- Specify 2-3 small environmental details that make the space feel OCCUPIED. These details do more for realism than any camera or lens specification.
- Practical light sources (a desk lamp, a neon sign, light from a laptop screen, a streetlight through blinds) feel more cinematic than described lighting setups. Name the SOURCE of light in the scene.

CHARACTERS INTERACT WITH THEIR SPACE:
- People TOUCH things. They lean on doorframes, rest elbows on tables, grip chair backs, fidget with objects. A character standing in the middle of a room not touching anything looks composited in.
- People have WEIGHT. They shift it, redistribute it, slump into surfaces. "Leaning against the counter, weight on one hip" is more real than "standing at the counter."
- Hands are always doing something — holding a phone, adjusting glasses, drumming fingers, picking at a label, rubbing the back of their neck. Idle hands at sides = mannequin.

Rules:
- Front-load the important stuff — Veo 3.1 weights early words more heavily
- ONE primary action per scene with natural secondary behavior (breathing, glancing, fidgeting)
- Specific > Creative — "Walking sadly" < "shuffling with hunched shoulders, keys jangling"
- Audio cues are essential — layer them (foreground action + ambient + one distant detail)
- ALWAYS re-describe characters — never use "the character" or "the person"
- Describe what CHANGES during the shot — a shift in expression, a hand moving, someone entering frame. Static tableaux are the hallmark of AI slop.

DIALOGUE IS NOT OPTIONAL:
- If there is a person in the shot, they should almost certainly be TALKING. Veo 3.1's speech model is one of its strongest features — USE IT. A character who is present but silent wastes the most powerful tool you have.
- The "dialogue" field is an ARRAY of { character, line } objects, in speaking order. Each object is one character's utterance.
  - For a two-person exchange: [{ character: "Mike", line: "Hey." }, { character: "Sarah", line: "What's up?" }]
  - For a single character: [{ character: "Mike", line: "Okay, let's do this." }]
- The ONLY time dialogue should be an empty array is a pure environment shot with no people, or a rare dramatic beat where silence is the entire point of the shot (max 1 silent shot per video).
- When in doubt: give them something to say. Even a sigh, a muttered "okay," or a half-sentence they abandon is better than nothing.

EDIT RHYTHM AND PACING:
- Wide/establishing shots need more time to read — use 6-8s. Close-ups hit faster — 2-4s is enough. Match duration to shot type.
- Build tension by tightening: start wide, move to medium, end on close-up. The edit gets CLOSER as stakes rise.
- After a series of fast cuts, a held wide shot creates breathing room. After a long held shot, a quick close-up creates impact. Use contrast.
- The first shot should orient the audience (who, where). The last shot should land the emotion or punchline. Middle shots build between those two points.

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

PERFORMANCE DIRECTION (THE ANTI-AI-SLOP SECTION):
These are real people, not stock footage models. The single biggest tell of AI-generated content is characters who look POSED — centered in frame, neutral expression, hands at sides, looking vaguely "cinematic." Real humans are NEVER like this.

Every character in every shot must be:
1. IN THE MIDDLE OF DOING SOMETHING — not waiting for the camera
2. PHYSICALLY INTERACTING with their environment — touching, leaning, holding
3. SHOWING ASYMMETRY — weight on one leg, head tilted, one hand busy while the other rests
4. WEARING THEIR HISTORY — wrinkled clothes, smudged glasses, chapped lips, a bandaid on a finger

BAD (AI stock): "A man stands confidently and delivers his line with a warm smile"
BAD (still AI stock): "A woman sits at a desk, looking focused"
GOOD (real movie): "A man (late 30s, stubble, bags under eyes) slumped in a plastic chair, one knee bouncing, picking at the label on a water bottle, eyes down"
GOOD (real movie): "A woman (mid-40s, reading glasses pushed up on forehead, sleeves rolled) hunched over a laptop, one hand in her hair, squinting at the screen, empty coffee cups around her"

The test: if you can imagine this person JUST WOKE UP and was placed in this position for a photo, you wrote stock footage. If you can imagine this person has been here for 20 minutes and you just walked in, you wrote a movie.

CAMERA AWARENESS AND EYELINES (MANDATORY):
- Characters should NOT look directly at the camera. Veo 3.1 renders this as an awkward "staring at the viewer" effect that breaks immersion.
- The ONLY exceptions: (1) the scene is clearly a commercial or PSA where addressing the viewer is intentional, (2) the creative concept explicitly calls for breaking the fourth wall as a deliberate stylistic choice.
- EYELINE DIRECTION: Always specify WHERE the character is looking — "looking down at the phone in her hand", "eyes fixed on the door", "glancing screen-left at the other person." Unspecified eyelines default to camera-stare.
- EYELINE MATCHING ACROSS CUTS: If character A looks screen-right toward character B in shot 1, then B must look screen-left in shot 2. Their eyelines should "meet" across the cut. Mismatched eyelines make characters look like they're in different rooms.
- Give characters something to look AT in every shot — another person, a task, an object, a horizon point. Idle eyes with no target drift toward camera.

REMEMBER: 60-80 words MAX per prompt. Count them. If you're over 80, cut. Short sentences. Specific details. No essays.

DIALOGUE RULES (MANDATORY):
- EVERY SCENE WITH A PERSON MUST HAVE DIALOGUE entries. This is non-negotiable. If someone is in the frame, they are talking.
- Put dialogue in the SEPARATE "dialogue" array — NOT in the "prompt" field. The prompt field is VISUAL ONLY.
- Each entry in the dialogue array must have "character" (matching a name from the characters array) and "line" (the ACTUAL WORDS spoken).
  - BAD: { character: "Mike", line: "He expresses concern about the situation and mentions they should leave" }
  - GOOD: { character: "Mike", line: "Yeah, no, we should — I think we should go. Like, now." }
- Write SHORT. Real people do not give speeches. They say 5-10 words and pause. One or two entries per scene is perfect.
- Write MESSY. Real people say "um" and "like" and "I mean" and "you know what I mean?" They trail off mid-sentence. They start over. They say "wait, what?" They speak in fragments.
- COMEDY DIALOGUE IS CASUAL. Funny people do not announce their jokes. They say things matter-of-factly. The humor is in WHAT they choose to say, not in HOW cleverly they say it. Deadpan, flat, understated.
- Dialogue across scenes should feel like one continuous conversation — each scene picks up roughly where the last left off.
- HARD WORD COUNT LIMIT: Count the TOTAL words across ALL dialogue entries in a scene. An 8-second scene = MAX 15-18 words total. A 6-second scene = MAX 12 words. A 4-second scene = MAX 8 words. If your dialogue is longer than this, CUT IT DOWN. Shorter is always better.
- BANNED WORDS: NEVER use "subtitle", "subtitles", "subtitled", "caption", "captions", or "text overlay" in any prompt. Veo 3.1 will render literal subtitle text on screen if these words appear.

DIALOGUE FORMATTING (VEO 3.1 SPEECH MODEL):
- NEVER write dialogue in ALL CAPS — the speech model will try to yell everything. Use normal sentence case, even if the character is shouting. Convey intensity through word choice and stage direction ("voice cracking," "barely above a whisper"), not capitalization.
- NEVER use unusual/phonetic spellings for accents ("watcha doin'", "git outta here"). Write standard English with natural contractions. The speech model needs clean text to sound natural.

SELF-CONTAINED PROMPTS (CRITICAL — VEO 3.1 HAS ZERO MEMORY):
Each prompt you write is sent to Veo 3.1 INDEPENDENTLY. The model has ZERO context between shots. Every single prompt must re-describe EVERYTHING from scratch:
- Full character descriptions every time (age, build, hair, clothing, skin tone, distinguishing features). If you say "the same woman" without re-describing her, the model will generate a DIFFERENT person.
- Full environment description every time (location, set dressing, weather, time of day)
- Full style/look every time (camera body, lens, color grade, film stock reference)
- Full lighting setup every time
- Let physical STATE evolve naturally (more dirt, sweat, injuries as story progresses) while keeping IDENTITY consistent
Treat each prompt as if the model has never seen any other prompt in its life.

CHARACTER TRACKING (MANDATORY):
- Give each character a short, consistent NAME (first name only, e.g. "Mike", "Sarah"). Use the SAME name across all scenes.
- List character names in each scene's "characters" array.
- Output a top-level "characters" array with each character's name, full physical description, and which scenes (by index) they appear in.
- Even if there's only one character, name them and track them.`;


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

async function geminiImage(prompt: string, referenceImages?: string[], aspectRatio?: string): Promise<string> {
  // Build Google provider options with aspect ratio if provided
  const googleOptions: Record<string, any> = { responseModalities: ['TEXT', 'IMAGE'] };
  if (aspectRatio) {
    googleOptions.imageConfig = { aspectRatio };
  }

  let result;
  if (referenceImages && referenceImages.length > 0) {
    console.log(`  📎 geminiImage: passing ${referenceImages.length} reference image(s) (sizes: ${referenceImages.map(r => `${Math.round(r.length / 1024)}KB`).join(', ')})`);
    // Multimodal: pass reference images + text prompt
    // Wrap prompt to strongly instruct the model to use reference images as the visual basis
    const refPrompt = `You are given ${referenceImages.length} reference image(s). These are the user's visual references — you MUST use them as the primary basis for the generated image. Match their visual style, color palette, lighting, composition, subject matter, and overall aesthetic as closely as possible. The output should look like it belongs in the same film or photo series as the reference images.\n\n${prompt}`;
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

  // Upload to Blob Storage instead of returning huge base64 data URLs
  const buffer = Buffer.from(imageFile.uint8Array);
  const ext = imageFile.mediaType === 'image/jpeg' ? 'jpg' : 'png';
  const blob = await put(`storyboard/${crypto.randomUUID()}.${ext}`, buffer, {
    access: 'public',
    contentType: imageFile.mediaType,
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
): Promise<Record<string, string>> {
  console.log(`\n🧑 PORTRAITS: Generating ${characters.length} character portraits...`);
  const portraits: Record<string, string> = {};

  const promises = characters.map(async (char) => {
    try {
      console.log(`🧑 Generating portrait for ${char.name}...`);
      const url = await geminiImage(
        `Cinematic character portrait. ${style} visual style and color grade. Shallow depth of field, motivated lighting.

Subject: ${char.description}

Framing: Tight medium close-up from chest up. Subject fills the frame. Bokeh background — neutral tones. The face is the focal point, lit with intention — key light with subtle fill, natural skin tones.

This is a definitive character reference photograph for a film production. Every detail of their appearance (face, hair, skin, build, clothing) must be precisely rendered as described. This exact person must be recognizable in every subsequent frame.

NO overlay graphics, captions, speech bubbles, subtitles, labels, or watermarks. Clean photographic image only. Output only the image.`
      );
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
): Promise<string[]> {
  console.log(`\n🎬 STORYBOARD: Generating ${scenes.length} scene frames...`);
  const results = new Array<string>(scenes.length).fill('');

  const promises = scenes.map(async (scene, i) => {
    try {
      // Build character context and collect reference images
      let charContext = '';
      const refImages: string[] = [];
      const sceneChars = scene.characters.map(n => characters.find(c => c.name === n)).filter(Boolean);

      if (sceneChars.length > 0) {
        charContext = sceneChars.map(c => `${c!.name}: ${c!.description}`).join('. ') + '. ';
      }

      // Use group ref if available, otherwise individual portraits
      if (scene.characters.length >= 2) {
        const key = [...scene.characters].sort().join('+');
        if (groupRefs[key]) refImages.push(groupRefs[key]);
        else scene.characters.forEach(n => { if (portraits[n]) refImages.push(portraits[n]); });
      } else if (scene.characters.length === 1 && portraits[scene.characters[0]]) {
        refImages.push(portraits[scene.characters[0]]);
      }

      console.log(`🎬 Generating frame ${i + 1}/${scenes.length} (with ${refImages.length} ref image(s))...`);
      const url = await geminiImage(
        `${refImages.length > 0 ? 'The attached images are character reference portraits. The characters in the generated image must look IDENTICAL to these references — same face, hair, skin tone, build, clothing. Only lighting, angle, pose, and expression change. Clothing stays the same unless the scene is at a clearly different time or location.\n\n' : ''}Cinematic production still. ${modeId && STORYBOARD_TONE_OVERRIDES[modeId] ? STORYBOARD_TONE_OVERRIDES[modeId] + '.' : `${style} visual style, ${mood} mood.`}

Shot description: ${scene.prompt}

${charContext ? `Characters in this frame: ${charContext}\n` : ''}This must look like a FRAME GRAB from a real film — a single frame pulled from a moving shot. NOT a photograph. NOT a posed portrait. NOT stock footage.

Key requirements for realism:
- Characters must be MID-ACTION, not posing. Caught in the middle of a gesture, a turn, a reach. Asymmetric body positions — weight shifted, head tilted, one hand busy.
- Characters must NEVER look at the camera. They look at other people, objects, tasks, or into the middle distance.
- The environment must look LIVED IN — clutter, wear, practical light sources (lamps, screens, windows), objects that suggest someone has been here a while.
- Characters must be TOUCHING or interacting with their environment — leaning on surfaces, holding objects, gripping things.
- Include subtle motion cues — slight blur on a moving hand, hair catching light mid-swing, fabric mid-settle.

Match the camera, lens, and framing from the shot description exactly. Do not override the camera specs.

NO overlay graphics, captions, speech bubbles, dialogue text, subtitles, labels, or watermarks. Diegetic screens (phones, laptops, TVs) can show content. Clean photographic frame only. Output only the image.`,
        refImages.length > 0 ? refImages : undefined,
        aspectRatio
      );
      if (url) {
        results[i] = url;
        console.log(`✅ Frame ${i + 1} generated`);
        onFrame?.(i, url);
      } else {
        console.error(`❌ No image returned for frame ${i + 1}`);
      }
    } catch (error) {
      console.error(`❌ Failed to generate frame ${i + 1}:`, error instanceof Error ? error.message : error);
    }
  });

  await Promise.allSettled(promises);
  console.log(`✅ STORYBOARD: ${results.filter(Boolean).length}/${scenes.length} frames generated\n`);
  return results;
}

/**
 * Describe a storyboard frame using Gemini vision for shot consistency.
 * Sends the image to Gemini 2.5 Flash and extracts an extremely detailed
 * visual description that can be prepended to the Veo prompt, compensating
 * for the lack of image-to-video support through the AI Gateway.
 */
export async function describeStoryboardFrame(
  imageUrl: string,
  style: string,
  mood: string,
): Promise<string> {
  const result = await generateText({
    model: getTextModel('google/gemini-2.5-flash'),
    messages: [
      {
        role: 'system' as const,
        content: `You are a cinematography reference analyst. Given a storyboard frame, output a CONCISE visual description (40-60 words max) that a text-to-video model can use to match this image's look.

Focus on what matters most for visual matching:
- People: position, build, hair, key clothing, expression
- Environment: location type, key objects, lighting quality
- Color/mood: overall palette, warm/cool, contrast level
- Framing: shot type, camera angle

Output a SINGLE SHORT PARAGRAPH. No bullet points. Keep it under 60 words — the video model ignores long descriptions.`,
      },
      {
        role: 'user' as const,
        content: [
          { type: 'image' as const, image: imageUrl },
          { type: 'text' as const, text: `Describe this storyboard frame with extreme visual precision. The intended style is "${style}" with a "${mood}" mood. Output only the visual description paragraph — nothing else.` },
        ],
      },
    ],
  });

  return result.text.trim();
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

    // Text-to-video only — image-to-video via the AI Gateway returns empty errors
    const model = getVideoModel('google/veo-3.1-generate-001');
    const { videos } = await generateVideo({
      model,
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
