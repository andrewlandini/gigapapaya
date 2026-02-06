import {
  generateObject,
  experimental_generateVideo as generateVideo,
} from 'ai';
import { z } from 'zod';
import { getTextModel, getVideoModel } from './provider';
import { IDEA_AGENT_PROMPT, SCENES_AGENT_PROMPT, buildConsistentPrompt } from '../prompts';
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
  const modelId = config?.model || 'openai/gpt-4o';
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

/**
 * Agent 2: Generate scene breakdown from video idea
 */
export async function executeScenesAgent(
  idea: VideoIdea,
  numScenes: number = 3,
  config?: { model?: string; prompt?: string }
): Promise<ScenesResult> {
  const modelId = config?.model || 'openai/gpt-4o';
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
    prompt: `${systemPrompt}\n\nVideo Idea:\n${ideaSummary}\n\nGenerate ${numScenes} scenes that follow this concept.`,
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

  const enhancedPrompt = buildConsistentPrompt(scenePrompt, style, mood);
  console.log(`🎬 Enhanced Prompt: ${enhancedPrompt}\n`);

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
