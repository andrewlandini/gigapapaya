import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { executeIdeaAgent, executeScenesAgent, executeVideoAgent } from '@/lib/ai/agents';
import {
  initDb,
  createGeneration,
  updateGenerationIdea,
  updateGenerationScenes,
  updateGenerationStatus,
  saveVideoRecord,
} from '@/lib/db';
import type { GenerationOptions, SSEMessage } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 600;

let dbInitialized = false;

export async function POST(request: NextRequest) {
  console.log('\n🚀 API: Generate endpoint called');

  // Initialize database on first request
  if (!dbInitialized) {
    await initDb();
    dbInitialized = true;
  }

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

    const sessionId = crypto.randomUUID();

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (data: SSEMessage) => {
          const message = `data: ${JSON.stringify(data)}\n\n`;
          console.log(`📡 SSE: ${data.type}`, data.agent || '');
          controller.enqueue(encoder.encode(message));
        };

        try {
          // Create generation record in DB
          await createGeneration(sessionId, idea);

          // ── Agent 1: Idea ──────────────────────────────────
          sendEvent({
            type: 'agent-start',
            agent: 'idea',
            status: 'Generating creative video concept...',
          });

          const ideaResult = await executeIdeaAgent(idea);
          await updateGenerationIdea(sessionId, ideaResult);

          sendEvent({
            type: 'agent-complete',
            agent: 'idea',
            result: ideaResult,
          });

          // ── Agent 2: Scenes ────────────────────────────────
          sendEvent({
            type: 'agent-start',
            agent: 'scenes',
            status: 'Crafting scene variations...',
          });

          const scenesResult = await executeScenesAgent(
            ideaResult,
            options.numScenes || 3
          );
          await updateGenerationScenes(sessionId, scenesResult);

          sendEvent({
            type: 'agent-complete',
            agent: 'scenes',
            result: scenesResult,
          });

          // ── Agent 3: Videos ────────────────────────────────
          const videos = [];

          for (let i = 0; i < scenesResult.scenes.length; i++) {
            const scene = scenesResult.scenes[i];

            sendEvent({
              type: 'video-start',
              sceneIndex: i,
              prompt: scene.prompt,
              status: `Generating video ${i + 1}/${scenesResult.scenes.length}...`,
            });

            try {
              const video = await executeVideoAgent(
                scene.prompt,
                ideaResult.style,
                ideaResult.mood,
                options,
                i
              );

              // Save video record to DB
              await saveVideoRecord({
                id: video.id,
                generationId: sessionId,
                blobUrl: video.url,
                prompt: video.prompt,
                duration: video.duration,
                aspectRatio: video.aspectRatio,
                size: video.size,
                sceneIndex: i,
              });

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
            }
          }

          // ── Complete ───────────────────────────────────────
          await updateGenerationStatus(sessionId, 'complete');

          sendEvent({
            type: 'complete',
            sessionId,
            videos,
          });

          console.log(`✅ API: Generation complete - ${videos.length} videos\n`);
          controller.close();
        } catch (error) {
          console.error('❌ API: Generation failed:', error);
          await updateGenerationStatus(sessionId, 'error').catch(() => {});

          sendEvent({
            type: 'error',
            message: `Generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
