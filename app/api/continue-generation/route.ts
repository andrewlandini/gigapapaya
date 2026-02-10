import { NextRequest } from 'next/server';
import {
  executeScenesAgent,
  generateCharacterPortraits,
} from '@/lib/ai/agents';
import { getSession } from '@/lib/auth/session';
import { initDb, updateGenerationScenes } from '@/lib/db';
import type { GenerationOptions, SSEMessage, VideoIdea } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 600;

/**
 * POST /api/continue-generation
 * Phase 2: Scenes → Portraits → Group Refs → Environments → Storyboard → scenes-ready
 * Called after the user selects and refines their mood board.
 */
export async function POST(request: NextRequest) {
  console.log('\n🚀 API: Continue-generation endpoint called');

  await initDb();

  try {
    const body = await request.json();
    const { idea, moodBoard, options, sessionId } = body as {
      idea: VideoIdea;
      moodBoard: string[];
      options: GenerationOptions;
      sessionId: string;
    };

    console.log(`📝 Session: ${sessionId}`);
    console.log(`🎨 Mood board: ${moodBoard.length} image(s)`);
    console.log(`📋 Idea: ${idea.title}`);

    const user = await getSession();
    // No additional credit check — credits were already deducted in /api/generate

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (data: SSEMessage) => {
          const message = `data: ${JSON.stringify(data)}\n\n`;
          console.log(`📡 SSE: ${data.type}`, data.agent || '');
          controller.enqueue(encoder.encode(message));
        };

        try {
          const ideaResult = idea;
          const refDataUrls = (options.referenceImages || [])
            .filter((r: any) => r && r.dataUrl)
            .map((r: any) => r.dataUrl as string);

          // Agent 2: Scenes
          sendEvent({ type: 'agent-log', agent: 'scenes', status: `Taking concept "${ideaResult.title}" and breaking into ${options.numScenes || 'auto'} shots` });
          sendEvent({ type: 'agent-log', agent: 'scenes', status: `Maintaining consistency: ${ideaResult.style} style, ${ideaResult.mood} mood across all scenes` });
          sendEvent({ type: 'agent-log', agent: 'scenes', status: 'Crafting camera angles, lighting, composition for each scene...' });
          sendEvent({ type: 'agent-start', agent: 'scenes', status: 'Crafting scene variations...' });

          const scenesResult = await executeScenesAgent(
            ideaResult, options.numScenes, options.sceneAgent,
            options.duration || 8, options.noMusic || false,
            options.totalLength, refDataUrls.length > 0 ? refDataUrls : undefined,
          );
          await updateGenerationScenes(sessionId, scenesResult);

          sendEvent({ type: 'agent-log', agent: 'scenes', status: `Generated ${scenesResult.scenes.length} scenes` });
          scenesResult.scenes.forEach((scene, i) => {
            sendEvent({ type: 'agent-log', agent: 'scenes', status: `Shot ${i + 1}: ${scene.prompt.substring(0, 80)}...` });
          });
          sendEvent({ type: 'agent-log', agent: 'scenes', status: `Consistency: ${scenesResult.consistencyNotes.substring(0, 100)}...` });
          sendEvent({ type: 'agent-complete', agent: 'scenes', result: scenesResult });

          // Character portraits
          let characterPortraits: Record<string, string> = {};

          sendEvent({ type: 'storyboard-start' as any, status: 'Generating character portraits...' });

          try {
            const chars = scenesResult.characters || [];
            sendEvent({ type: 'agent-log', agent: 'mood-board', status: `Found ${chars.length} character(s): ${chars.map((c: any) => c.name).join(', ') || 'none'}` });

            // Step 1: Character portraits
            if (chars.length > 0) {
              sendEvent({ type: 'agent-log', agent: 'mood-board', status: `Generating ${chars.length} character portrait(s)...` });
              try {
                characterPortraits = await generateCharacterPortraits(
                  chars, ideaResult.style, ideaResult.mood, options.modeId,
                  (name, url) => {
                    sendEvent({ type: 'character-portrait', characterName: name, characterPortrait: url });
                  },
                  moodBoard,
                );
                sendEvent({ type: 'agent-log', agent: 'mood-board', status: `${Object.keys(characterPortraits).length} portrait(s) ready` });
              } catch (e) {
                sendEvent({ type: 'agent-log', agent: 'mood-board', status: `Portrait generation failed: ${e instanceof Error ? e.message : 'Unknown error'}` });
              }
            }

          } catch (error) {
            console.error('❌ Portrait generation failed:', error);
            sendEvent({ type: 'agent-log', agent: 'mood-board', status: `Portraits failed: ${error instanceof Error ? error.message : 'Unknown error'}` });
          }

          // Pause for character review
          sendEvent({ type: 'agent-log', agent: 'system', status: 'Characters ready for review. Tap to edit, then continue to storyboard.' });
          sendEvent({ type: 'characters-ready' as any, sessionId, characterPortraits, result: { idea: ideaResult, scenes: scenesResult } });

          console.log(`✅ API: Continue-generation complete\n`);
          controller.close();
        } catch (error) {
          console.error('❌ API: Continue-generation failed:', error);
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
