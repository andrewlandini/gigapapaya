import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { executeIdeaAgent, executeScenesAgent, executeVideoAgent } from '@/lib/ai/agents';
import { getSession } from '@/lib/auth/session';
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

    const mode = options.mode || 'agents';
    console.log(`📝 Idea: ${idea}`);
    console.log(`⚙️  Mode: ${mode}`);
    console.log(`⚙️  Options:`, options);

    if (!idea || !idea.trim()) {
      return new Response(
        JSON.stringify({ error: 'Idea is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const sessionId = crypto.randomUUID();
    const user = await getSession();
    const userId = user?.id;

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (data: SSEMessage) => {
          const message = `data: ${JSON.stringify(data)}\n\n`;
          console.log(`📡 SSE: ${data.type}`, data.agent || '');
          controller.enqueue(encoder.encode(message));
        };

        try {
          await createGeneration(sessionId, idea, userId);

          if (mode === 'direct') {
            // ── Direct mode: skip agents, generate video from raw prompt ──
            sendEvent({ type: 'agent-log', agent: 'system', status: `Direct mode — skipping agents, sending prompt straight to Veo 3.1` });
            sendEvent({ type: 'agent-log', agent: 'system', status: `Prompt: "${idea.substring(0, 120)}${idea.length > 120 ? '...' : ''}"` });
            sendEvent({ type: 'agent-log', agent: 'system', status: `Config: ${options.aspectRatio} / ${options.duration}s / model: veo-3.1-generate-001` });

            sendEvent({
              type: 'video-start',
              sceneIndex: 0,
              prompt: idea,
              status: 'Generating video from your prompt...',
            });

            const video = await executeVideoAgent(idea, '', '', options, 0);

            await saveVideoRecord({
              id: video.id, generationId: sessionId, userId,
              blobUrl: video.url, prompt: video.prompt, duration: video.duration,
              aspectRatio: video.aspectRatio, size: video.size, sceneIndex: 0,
            });

            sendEvent({ type: 'agent-log', agent: 'system', status: `Video uploaded to Blob Storage (${(video.size / (1024 * 1024)).toFixed(1)} MB)` });
            sendEvent({ type: 'video-complete', sceneIndex: 0, videoId: video.id });

            await updateGenerationStatus(sessionId, 'complete');
            sendEvent({ type: 'complete', sessionId, videos: [video] });
          } else {
            // ── Agent mode: full multi-agent pipeline ──

            // Agent 1: Idea
            sendEvent({ type: 'agent-log', agent: 'idea', status: `Reading user input: "${idea.substring(0, 100)}${idea.length > 100 ? '...' : ''}"` });
            sendEvent({ type: 'agent-log', agent: 'idea', status: 'Analyzing input for visual potential, narrative hooks, and cinematic style...' });
            sendEvent({ type: 'agent-start', agent: 'idea', status: 'Generating creative video concept...' });

            const ideaResult = await executeIdeaAgent(idea, options.ideaAgent);
            await updateGenerationIdea(sessionId, ideaResult);

            sendEvent({ type: 'agent-log', agent: 'idea', status: `Concept: "${ideaResult.title}"` });
            sendEvent({ type: 'agent-log', agent: 'idea', status: `Style: ${ideaResult.style} / Mood: ${ideaResult.mood}` });
            sendEvent({ type: 'agent-log', agent: 'idea', status: `Key elements: ${ideaResult.keyElements.join(', ')}` });
            sendEvent({ type: 'agent-complete', agent: 'idea', result: ideaResult });

            // Agent 2: Scenes
            sendEvent({ type: 'agent-log', agent: 'scenes', status: `Taking concept "${ideaResult.title}" and breaking into ${options.numScenes || 'auto'} shots` });
            sendEvent({ type: 'agent-log', agent: 'scenes', status: `Maintaining consistency: ${ideaResult.style} style, ${ideaResult.mood} mood across all scenes` });
            sendEvent({ type: 'agent-log', agent: 'scenes', status: 'Crafting camera angles, lighting, composition for each scene...' });
            sendEvent({ type: 'agent-start', agent: 'scenes', status: 'Crafting scene variations...' });

            const scenesResult = await executeScenesAgent(ideaResult, options.numScenes, options.sceneAgent, options.duration || 8, options.noMusic || false, options.totalLength);
            await updateGenerationScenes(sessionId, scenesResult);

            sendEvent({ type: 'agent-log', agent: 'scenes', status: `Generated ${scenesResult.scenes.length} scenes` });
            scenesResult.scenes.forEach((scene, i) => {
              sendEvent({ type: 'agent-log', agent: 'scenes', status: `Shot ${i + 1}: ${scene.prompt.substring(0, 80)}...` });
            });
            sendEvent({ type: 'agent-log', agent: 'scenes', status: `Consistency: ${scenesResult.consistencyNotes.substring(0, 100)}...` });
            sendEvent({ type: 'agent-complete', agent: 'scenes', result: scenesResult });

            // Pause for review — send scenes-ready event and stop
            sendEvent({ type: 'agent-log', agent: 'system', status: 'Scenes ready for review. Edit prompts and click Generate Videos to continue.' });
            sendEvent({ type: 'scenes-ready' as any, sessionId, result: { idea: ideaResult, scenes: scenesResult } });
          }

          console.log(`✅ API: Generation complete\n`);
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
