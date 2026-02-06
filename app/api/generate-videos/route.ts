import { NextRequest } from 'next/server';
import { executeVideoAgent } from '@/lib/ai/agents';
import { getSession } from '@/lib/auth/session';
import {
  initDb,
  updateGenerationStatus,
  saveVideoRecord,
} from '@/lib/db';
import type { GenerationOptions, SSEMessage } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 600;

/**
 * POST /api/generate-videos
 * Generate videos from pre-approved scene prompts (phase 2)
 */
export async function POST(request: NextRequest) {
  console.log('\n🎥 API: Generate-videos endpoint called');

  await initDb();

  try {
    const body = await request.json();
    const user = await getSession();
    const userId = user?.id;

    const { sessionId, scenes, style, mood, options, moodBoard } = body as {
      sessionId: string;
      scenes: { prompt: string; duration: number }[];
      style: string;
      mood: string;
      options: GenerationOptions;
      moodBoard?: string[];
    };

    console.log(`📝 Session: ${sessionId}`);
    console.log(`📹 Scenes: ${scenes.length}`);

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (data: SSEMessage) => {
          const message = `data: ${JSON.stringify(data)}\n\n`;
          console.log(`📡 SSE: ${data.type}`, data.agent || '');
          controller.enqueue(encoder.encode(message));
        };

        try {
          const videos: any[] = [];

          // Shot agent already writes Veo3-ready prompts — go straight to video generation
          const perShotDurations = scenes.map((s: any) => s.duration || (typeof options?.duration === 'number' ? options.duration : 8));

          sendEvent({ type: 'agent-log', agent: 'videos', status: `Starting video generation for ${scenes.length} shots (parallel)` });
          sendEvent({ type: 'agent-log', agent: 'videos', status: `Config: ${options.aspectRatio} / ${options.duration === 'auto' ? 'auto' : options.duration + 's'} / model: veo-3.1-generate-001` });

          // Launch all shots in parallel
          const shotPromises = scenes.map(async (scene: { prompt: string; duration: number }, i: number) => {
            const finalPrompt = scene.prompt;
            const shotDuration = perShotDurations[i];
            const shotOptions = { ...options, duration: shotDuration };

            sendEvent({ type: 'agent-log', agent: 'videos', status: `Sending shot ${i + 1} to Veo 3.1 (${shotDuration}s)` });
            sendEvent({
              type: 'video-start', sceneIndex: i, prompt: finalPrompt,
              status: `Generating video ${i + 1}/${scenes.length}...`,
            });

            try {
              // Pick a mood board image for this shot (round-robin across available images)
              const refImage = moodBoard?.length ? moodBoard[i % moodBoard.length] : undefined;

              const video = await executeVideoAgent(
                finalPrompt, style, mood, shotOptions, i, refImage
              );

              await saveVideoRecord({
                id: video.id, generationId: sessionId, userId,
                blobUrl: video.url, prompt: video.prompt, duration: video.duration,
                aspectRatio: video.aspectRatio, size: video.size, sceneIndex: i,
              });

              videos.push(video);
              sendEvent({ type: 'agent-log', agent: 'videos', status: `Shot ${i + 1} complete — ${(video.size / (1024 * 1024)).toFixed(1)} MB uploaded` });
              sendEvent({ type: 'video-complete', sceneIndex: i, videoId: video.id, video });
            } catch (error) {
              console.error(`❌ Failed to generate video ${i + 1}:`, error);
              sendEvent({ type: 'agent-log', agent: 'videos', status: `Shot ${i + 1} failed: ${error instanceof Error ? error.message : 'Unknown error'}` });
              sendEvent({
                type: 'error',
                message: `Failed to generate video ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`,
                sceneIndex: i,
              });
            }
          });

          await Promise.allSettled(shotPromises);

          sendEvent({ type: 'agent-log', agent: 'videos', status: `Pipeline complete: ${videos.length}/${scenes.length} videos generated` });
          await updateGenerationStatus(sessionId, 'complete');
          sendEvent({ type: 'complete', sessionId, videos });

          controller.close();
        } catch (error) {
          console.error('❌ API: Video generation failed:', error);
          sendEvent({
            type: 'error',
            message: `Video generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    console.error('❌ API: Request failed:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
