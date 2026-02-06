import { gateway } from 'ai';

/**
 * All models go through Vercel AI Gateway.
 * Auth is handled by the VERCEL_AI_GATEWAY env var automatically.
 */

/**
 * Get a text model for idea and scene generation
 * Uses gateway.languageModel() with provider-prefixed model ID
 */
export function getTextModel(modelName: string = 'openai/gpt-4o') {
  console.log(`📝 Using text model: ${modelName}`);
  return gateway.languageModel(modelName);
}

/**
 * Get a video model for video generation
 * Uses gateway.videoModel() with provider-prefixed model ID
 *
 * Available models:
 * - google/veo-3.1-generate-001 (stable)
 * - google/veo-3.1-generate-preview (latest)
 * - google/veo-3.1-fast-generate-001 (faster)
 */
export function getVideoModel(modelName: string = 'google/veo-3.1-generate-001') {
  console.log(`🎬 Using video model: ${modelName}`);
  return gateway.videoModel(modelName);
}

/**
 * Get an image model for avatar/icon generation
 * Uses gateway.imageModel() with provider-prefixed model ID
 */
export function getImageModel(modelName: string = 'google/gemini-3-pro-image') {
  console.log(`🎨 Using image model: ${modelName}`);
  return gateway.imageModel(modelName);
}

export const AVAILABLE_VIDEO_MODELS = [
  'google/veo-3.1-generate-001',
  'google/veo-3.1-generate-preview',
  'google/veo-3.1-fast-generate-001',
] as const;

export type VideoModelName = typeof AVAILABLE_VIDEO_MODELS[number];
