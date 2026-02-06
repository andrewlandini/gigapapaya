import {
  generateObject,
  experimental_generateVideo as generateVideo,
} from 'ai';
import { z } from 'zod';
import { getTextModel, getVideoModel } from './provider';
import { IDEA_AGENT_PROMPT, SCENES_AGENT_PROMPT, VEO3_PROMPTER_PROMPT } from '../prompts';
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
  index: z.number().describe('Scene number'),
  prompt: z.string().describe('Ultra-detailed scene description for video generation'),
  duration: z.number().describe('Duration in seconds'),
  notes: z.string().describe('Technical notes about camera, lighting, and composition'),
});

const scenesResultSchema = z.object({
  scenes: z.array(sceneSchema).describe('Array of 3-5 scene descriptions'),
  consistencyNotes: z.string().describe('Guidance on maintaining visual consistency'),
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
- Characters must be described IDENTICALLY across scenes — same clothing, hair, features, build. Copy-paste the character description into every scene prompt.
- If scenes share a location, describe the environment with the same details each time (same lighting conditions, same set dressing, same color palette)
- Use the SAME camera language across all scenes (e.g., if scene 1 uses "handheld, eye-level", all scenes should default to that unless there's a specific reason to change)
- Scenes must feel like they belong to the same film — consistent color temperature, grain, contrast, and aspect ratio
- When played back-to-back, transitions should feel natural (match action, match eyeline, match energy level between scene endings and beginnings)

CRITICAL PROMPT STRUCTURE FOR EACH SCENE:
[SHOT TYPE] + [SUBJECT with full physical description] + [ACTION - one only] + [STYLE - identical across scenes] + [CAMERA MOVEMENT] + [AUDIO CUES]

Example: Medium shot, cyberpunk hacker (male, mid-30s, shaved head, black hoodie, pale skin, cybernetic arm) typing frantically, neon reflections on face, blade runner aesthetic, shot on ARRI Alexa with anamorphic lens, teal and orange color grade, slow push in, Audio: mechanical keyboard clicks, distant sirens

Rules:
- Front-load the important stuff — Veo 3 weights early words more heavily
- Lock down the "what" then iterate on the "how"
- One action per prompt — multiple actions = chaos (one action per scene)
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
- Write dialogue like people ACTUALLY TALK in real life — not how they write. Use contractions ("I'm", "don't", "can't"), false starts ("I was gonna— actually"), filler words where natural ("like", "you know", "I mean"), trailing off ("so I thought maybe...")
- Dialogue across scenes MUST be a continuation — when scenes are played back-to-back, it should sound like one coherent conversation or monologue. Each scene picks up where the last one left off.
- The dialogue should match the mood and vibe of the concept — a tense scene has clipped, urgent speech; a dreamy scene has soft, wandering words
- NEVER write stiff, formal, or "written" dialogue. Real people don't speak in complete, grammatically perfect sentences.`;

/**
 * Agent 2: Generate scene breakdown from video idea
 */
export async function executeScenesAgent(
  idea: VideoIdea,
  numScenes: number = 3,
  config?: { model?: string; prompt?: string }
): Promise<ScenesResult> {
  const modelId = config?.model || 'anthropic/claude-sonnet-4.5';
  const systemPrompt = config?.prompt || SCENES_AGENT_PROMPT;

  console.log('\n🎬 SCENES AGENT: Starting...');
  console.log(`📋 Idea: ${idea.title}`);
  console.log(`🎯 Target: ${numScenes} scenes`);
  console.log(`🤖 Model: ${modelId}\n`);

  const ideaSummary = `
Title: ${idea.title}
Description: ${idea.description}
Visual Style: ${idea.style}
Mood: ${idea.mood}
Key Elements: ${idea.keyElements.join(', ')}
`;

  const result = await generateObject({
    model: getTextModel(modelId),
    schema: scenesResultSchema,
    prompt: `${systemPrompt}${SCENE_AGENT_BASE}\n\nVideo Idea:\n${ideaSummary}\n\nGenerate ${numScenes} scenes that follow this concept.`,
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

/**
 * Agent 2.5: Veo 3 Prompting Expert — optimize scene prompts for Veo 3.1
 */
const veo3OptimizedSchema = z.object({
  optimizedPrompts: z.array(z.string()).describe('Optimized prompts for Veo 3.1, one per scene in the same order'),
});

export async function executeVeo3PrompterAgent(
  scenePrompts: string[],
  style: string,
  mood: string,
  consistencyNotes: string
): Promise<string[]> {
  console.log('\n🎬 VEO3 PROMPTER: Starting...');
  console.log(`📹 Optimizing ${scenePrompts.length} scene prompts for Veo 3.1`);
  console.log(`🎨 Style: ${style}, Mood: ${mood}\n`);

  const scenesText = scenePrompts
    .map((p, i) => `Scene ${i + 1}: ${p}`)
    .join('\n\n');

  const result = await generateObject({
    model: getTextModel('anthropic/claude-sonnet-4.5'),
    schema: veo3OptimizedSchema,
    prompt: `${VEO3_PROMPTER_PROMPT}\n\nVisual Style: ${style}\nMood: ${mood}\nConsistency Notes: ${consistencyNotes}\n\nScene prompts to optimize:\n\n${scenesText}\n\nOptimize each prompt for Veo 3.1. Return exactly ${scenePrompts.length} optimized prompts in the same order.`,
  });

  console.log('✅ VEO3 PROMPTER: Complete');
  result.object.optimizedPrompts.forEach((p, i) => {
    console.log(`\n  Scene ${i + 1} (optimized): ${p.substring(0, 120)}...`);
  });
  console.log('');

  return result.object.optimizedPrompts;
}

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
    const { videos } = await generateVideo({
      model: getVideoModel('google/veo-3.1-generate-001'),
      prompt: enhancedPrompt,
      aspectRatio: options.aspectRatio,
      duration: options.duration,
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
      duration: options.duration,
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
  const scenesResult = await executeScenesAgent(idea, options.numScenes || 3);

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
