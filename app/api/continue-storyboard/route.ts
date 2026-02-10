import { NextRequest } from 'next/server';
import {
  generateGroupReferences,
  generateEnvironmentImages,
  generateSceneStoryboards,
} from '@/lib/ai/agents';
import { getSession } from '@/lib/auth/session';
import { initDb } from '@/lib/db';
import type { GenerationOptions, SSEMessage, VideoIdea, Character, Scene } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 600;

/**
 * POST /api/continue-storyboard
 * Phase 3: Group Refs → Environments → Storyboard Frames → scenes-ready
 * Called after the user reviews and confirms character portraits.
 */
export async function POST(request: NextRequest) {
  console.log('\n🚀 API: Continue-storyboard endpoint called');

  await initDb();

  try {
    const body = await request.json();
    const { idea, moodBoard, scenes, characters, characterPortraits, options, sessionId } = body as {
      idea: VideoIdea;
      moodBoard: string[];
      scenes: Scene[];
      characters: Character[];
      characterPortraits: Record<string, string>;
      options: GenerationOptions;
      sessionId: string;
    };

    console.log(`📝 Session: ${sessionId}`);
    console.log(`🎨 Mood board: ${moodBoard.length} image(s)`);
    console.log(`🧑 Portraits: ${Object.keys(characterPortraits).length}`);
    console.log(`📹 Scenes: ${scenes.length}`);

    const user = await getSession();

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (data: SSEMessage) => {
          const message = `data: ${JSON.stringify(data)}\n\n`;
          console.log(`📡 SSE: ${data.type}`, data.agent || '');
          controller.enqueue(encoder.encode(message));
        };

        try {
          let storyboardImages: string[] = [];
          let environmentImages: string[] = [];

          sendEvent({ type: 'storyboard-start' as any, status: 'Generating storyboard...' });

          try {
            // Step 1: Group references for multi-character scenes
            let groupRefs: Record<string, string> = {};
            try {
              groupRefs = await generateGroupReferences(
                scenes, characters, characterPortraits,
                idea.style, idea.mood, options.aspectRatio,
              );
              if (Object.keys(groupRefs).length > 0) {
                sendEvent({ type: 'agent-log', agent: 'mood-board', status: `${Object.keys(groupRefs).length} group reference(s) ready` });
              }
            } catch (e) {
              sendEvent({ type: 'agent-log', agent: 'mood-board', status: `Group refs failed: ${e instanceof Error ? e.message : 'Unknown error'}` });
            }

            // Step 2: Environment images
            sendEvent({ type: 'agent-log', agent: 'mood-board', status: `Generating ${scenes.length} environment image(s)...` });
            try {
              environmentImages = await generateEnvironmentImages(
                scenes, idea.style, idea.mood, options.modeId,
                (i, url) => {
                  sendEvent({ type: 'environment-image', sceneIndex: i, environmentImage: url });
                },
                options.aspectRatio, moodBoard,
              );
              sendEvent({ type: 'agent-log', agent: 'mood-board', status: `${environmentImages.filter(Boolean).length}/${scenes.length} environment images ready` });
            } catch (e) {
              sendEvent({ type: 'agent-log', agent: 'mood-board', status: `Environment images failed: ${e instanceof Error ? e.message : 'Unknown error'}` });
            }

            // Step 3: Scene storyboard frames
            sendEvent({ type: 'agent-log', agent: 'mood-board', status: `Generating ${scenes.length} scene frames...` });
            try {
              storyboardImages = await generateSceneStoryboards(
                scenes, characters, characterPortraits, groupRefs,
                idea.style, idea.mood, options.modeId,
                (i, url) => {
                  sendEvent({ type: 'storyboard-frame', sceneIndex: i, storyboardImage: url });
                },
                options.aspectRatio, environmentImages, moodBoard,
              );
              sendEvent({ type: 'agent-log', agent: 'mood-board', status: `${storyboardImages.filter(Boolean).length}/${scenes.length} storyboard frames ready` });
            } catch (e) {
              sendEvent({ type: 'agent-log', agent: 'mood-board', status: `Scene frames failed: ${e instanceof Error ? e.message : 'Unknown error'}` });
            }

            sendEvent({ type: 'storyboard-complete' as any, storyboardImages, characterPortraits });
          } catch (error) {
            console.error('❌ Storyboard generation failed:', error);
            sendEvent({ type: 'agent-log', agent: 'mood-board', status: `Storyboard failed: ${error instanceof Error ? error.message : 'Unknown error'}` });
            sendEvent({ type: 'storyboard-complete' as any, storyboardImages: [], characterPortraits: {} });
          }

          // Pause for scene review
          sendEvent({ type: 'agent-log', agent: 'system', status: 'Scenes ready for review. Edit prompts and click Generate Videos to continue.' });
          sendEvent({
            type: 'scenes-ready' as any,
            sessionId,
            result: { idea, scenes: { scenes, characters, consistencyNotes: '' } },
            moodBoard,
            storyboardImages,
            characterPortraits,
            environmentImages,
          });

          console.log(`✅ API: Continue-storyboard complete\n`);
          controller.close();
        } catch (error) {
          console.error('❌ API: Continue-storyboard failed:', error);
          sendEvent({
            type: 'error',
            message: `Storyboard generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
