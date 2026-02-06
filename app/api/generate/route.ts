import { NextRequest } from 'next/server';
import { executeIdeaAgent, executeScenesAgent, executeVideoAgent } from '@/lib/ai/agents';
import type { GenerationOptions, SSEMessage } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 600; // 10 minutes max execution time

/**
 * POST /api/generate
 * Main orchestrator endpoint with Server-Sent Events (SSE)
 * Executes multi-agent workflow and streams progress in real-time
 */
export async function POST(request: NextRequest) {
  console.log('\n🚀 API: Generate endpoint called');

  let encoder: TextEncoder;
  let controller: ReadableStreamDefaultController;

  try {
    const body = await request.json();
    const { idea, options } = body as {
      idea: string;
      options: GenerationOptions;
    };

    console.log(`📝 Idea: ${idea}`);
    console.log(`⚙️  Options:`, options);

    if (!idea || !idea.trim()) {
      return new Response(
        JSON.stringify({ error: 'Idea is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create SSE stream
    encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(ctrl) {
        controller = ctrl;

        const sendEvent = (data: SSEMessage) => {
          const message = `data: ${JSON.stringify(data)}\n\n`;
          console.log(`📡 SSE: ${data.type}`, data.agent || '');
          controller.enqueue(encoder.encode(message));
        };

        try {
          // ============================================================
          // AGENT 1: Generate Idea
          // ============================================================
          sendEvent({
            type: 'agent-start',
            agent: 'idea',
            status: '🎨 Generating creative video concept...',
          });

          const ideaResult = await executeIdeaAgent(idea);

          sendEvent({
            type: 'agent-complete',
            agent: 'idea',
            result: ideaResult,
          });

          // ============================================================
          // AGENT 2: Generate Scenes
          // ============================================================
          sendEvent({
            type: 'agent-start',
            agent: 'scenes',
            status: '🎬 Crafting scene variations...',
          });

          const scenesResult = await executeScenesAgent(
            ideaResult,
            options.numScenes || 3
          );

          sendEvent({
            type: 'agent-complete',
            agent: 'scenes',
            result: scenesResult,
          });

          // ============================================================
          // AGENT 3: Generate Videos
          // ============================================================
          const videos = [];

          for (let i = 0; i < scenesResult.scenes.length; i++) {
            const scene = scenesResult.scenes[i];

            sendEvent({
              type: 'video-start',
              sceneIndex: i,
              prompt: scene.prompt,
              status: `🎥 Generating video ${i + 1}/${scenesResult.scenes.length}...`,
            });

            try {
              const video = await executeVideoAgent(
                scene.prompt,
                ideaResult.style,
                ideaResult.mood,
                options,
                i
              );

              videos.push(video);

              sendEvent({
                type: 'video-complete',
                sceneIndex: i,
                videoId: video.id,
              });
            } catch (error) {
              console.error(`❌ Failed to generate video ${i + 1}:`, error);
              sendEvent({
                type: 'error',
                message: `Failed to generate video ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`,
                sceneIndex: i,
              });
              // Continue with next video
            }
          }

          // ============================================================
          // COMPLETE
          // ============================================================
          sendEvent({
            type: 'complete',
            videos,
          });

          console.log(`✅ API: Generation complete - ${videos.length} videos generated\n`);

          controller.close();
        } catch (error) {
          console.error('❌ API: Generation failed:', error);

          const errorMessage = error instanceof Error ? error.message : 'Unknown error';

          sendEvent({
            type: 'error',
            message: `Generation failed: ${errorMessage}`,
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
        'X-Accel-Buffering': 'no', // Disable buffering in nginx
      },
    });
  } catch (error) {
    console.error('❌ API: Request failed:', error);

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
