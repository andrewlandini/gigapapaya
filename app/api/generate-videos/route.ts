import { NextRequest } from 'next/server';
import { executeVideoAgent, executeVeo3PrompterAgent } from '@/lib/ai/agents';
import { getSession } from '@/lib/auth/session';
import {
  initDb,
  updateGenerationStatus,
  saveVideoRecord,
} from '@/lib/db';
import type { GenerationOptions, SSEMessage } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 600;

let dbInitialized = false;

/**
 * POST /api/generate-videos
 * Generate videos from pre-approved scene prompts (phase 2)
 */
export async function POST(request: NextRequest) {
  console.log('\n🎥 API: Generate-videos endpoint called');

  if (!dbInitialized) {
    await initDb();
    dbInitialized = true;
  }

  try {
    const body = await request.json();
    const user = await getSession();
    const userId = user?.id;

    const { sessionId, scenes, style, mood, options } = body as {
      sessionId: string;
      scenes: { prompt: string; duration: number }[];
      style: string;
      mood: string;
      options: GenerationOptions;
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
          const videos = [];

          // Veo 3 Prompter Agent — optimize all scene prompts before video generation
          sendEvent({ type: 'agent-start', agent: 'veo3-prompter', status: 'Optimizing prompts for Veo 3.1...' });
          sendEvent({ type: 'agent-log', agent: 'veo3-prompter', status: `Analyzing ${scenes.length} scenes — selecting camera, lens, lighting, adding dialogue...` });

          const perShotDurations = scenes.map((s: any) => s.duration || (typeof options?.duration === 'number' ? options.duration : 8));

          const optimizedPrompts = await executeVeo3PrompterAgent(
            scenes.map((s: any) => s.prompt),
            style,
            mood,
            '',
            options?.duration || 8,
            options?.noMusic || false,
            perShotDurations
          );

          optimizedPrompts.forEach((p: string, i: number) => {
            sendEvent({ type: 'agent-log', agent: 'veo3-prompter', status: `Shot ${i + 1} optimized (${perShotDurations[i]}s): ${p.substring(0, 100)}...` });
          });
          sendEvent({ type: 'agent-complete', agent: 'veo3-prompter', result: { optimizedPrompts } });

          // Video generation
          sendEvent({ type: 'agent-log', agent: 'videos', status: `Starting video generation for ${scenes.length} optimized shots` });
          sendEvent({ type: 'agent-log', agent: 'videos', status: `Config: ${options.aspectRatio} / ${options.duration === 'auto' ? 'auto' : options.duration + 's'} / model: veo-3.1-generate-001` });

          for (let i = 0; i < scenes.length; i++) {
            const finalPrompt = optimizedPrompts[i] || scenes[i].prompt;
            const shotDuration = perShotDurations[i];

            // Override options.duration with per-shot duration for auto mode
            const shotOptions = { ...options, duration: shotDuration };

            sendEvent({ type: 'agent-log', agent: 'videos', status: `Sending optimized shot ${i + 1} to Veo 3.1 (${shotDuration}s)` });
            sendEvent({
              type: 'video-start', sceneIndex: i, prompt: finalPrompt,
              status: `Generating video ${i + 1}/${scenes.length}...`,
            });

            try {
              const video = await executeVideoAgent(
                finalPrompt, style, mood, shotOptions, i
              );

              await saveVideoRecord({
                id: video.id, generationId: sessionId, userId,
                blobUrl: video.url, prompt: video.prompt, duration: video.duration,
                aspectRatio: video.aspectRatio, size: video.size, sceneIndex: i,
              });

              videos.push(video);
              sendEvent({ type: 'agent-log', agent: 'videos', status: `Scene ${i + 1} complete — ${(video.size / (1024 * 1024)).toFixed(1)} MB uploaded` });
              sendEvent({ type: 'video-complete', sceneIndex: i, videoId: video.id, video });
            } catch (error) {
              console.error(`❌ Failed to generate video ${i + 1}:`, error);
              sendEvent({ type: 'agent-log', agent: 'videos', status: `Scene ${i + 1} failed: ${error instanceof Error ? error.message : 'Unknown error'}` });
              sendEvent({
                type: 'error',
                message: `Failed to generate video ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`,
                sceneIndex: i,
              });
            }
          }

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
