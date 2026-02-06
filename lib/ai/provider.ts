import { gateway } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

// AI Gateway Configuration
const AI_GATEWAY_API_KEY = process.env.AI_GATEWAY_API_KEY;

if (!AI_GATEWAY_API_KEY) {
  console.warn('⚠️  AI_GATEWAY_API_KEY not found in environment variables');
}

// Text model provider via OpenAI-compatible gateway
const openaiProvider = createOpenAI({
  apiKey: AI_GATEWAY_API_KEY || 'dummy-key',
});

/**
 * Get a text model for idea and scene generation
 * Uses OpenAI provider via AI Gateway
 */
export function getTextModel(modelName: string = 'gpt-4o') {
  console.log(`📝 Using text model: ${modelName}`);
  return openaiProvider(modelName);
}

/**
 * Get a video model for video generation
 * Uses AI Gateway with Google Veo 3.1 models
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
 * Available Veo 3.1 models (gateway prefixed)
 */
export const AVAILABLE_VIDEO_MODELS = [
  'google/veo-3.1-generate-001',
  'google/veo-3.1-generate-preview',
  'google/veo-3.1-fast-generate-001',
] as const;

export type VideoModelName = typeof AVAILABLE_VIDEO_MODELS[number];
