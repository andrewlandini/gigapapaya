import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { executeIdeaAgent, executeScenesAgent, executeVideoAgent, executeMoodBoardAgent, generateCharacterPortraits, generateGroupReferences, generateSceneStoryboards } from '@/lib/ai/agents';
import { getSession } from '@/lib/auth/session';
import {
  initDb,
  createGeneration,
  updateGenerationIdea,
  updateGenerationScenes,
  updateGenerationStatus,
  saveVideoRecord,
  getUserCredits,
  deductCredits,
  isUserAdmin,
} from '@/lib/db';
import { usdToCredits, estimateQuickGenerateCost, STORYBOARD_PIPELINE_COST } from '@/lib/costs';
import type { GenerationOptions, SSEMessage } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 600;

export async function POST(request: NextRequest) {
  console.log('\n🚀 API: Generate endpoint called');

  await initDb();

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

    // Credit check (admins bypass)
    if (userId && !(await isUserAdmin(userId))) {
      const { credits } = await getUserCredits(userId);

      if (mode === 'direct') {
        const duration = typeof options.duration === 'number' ? options.duration : 8;
        const estimatedCredits = usdToCredits(estimateQuickGenerateCost(duration));
        if (credits < estimatedCredits) {
          return new Response(
            JSON.stringify({ error: 'Insufficient credits', required: estimatedCredits, available: credits }),
            { status: 402, headers: { 'Content-Type': 'application/json' } }
          );
        }
      } else {
        const pipelineCredits = usdToCredits(STORYBOARD_PIPELINE_COST);
        if (credits < pipelineCredits) {
          return new Response(
            JSON.stringify({ error: 'Insufficient credits', required: pipelineCredits, available: credits }),
            { status: 402, headers: { 'Content-Type': 'application/json' } }
          );
        }
        const ok = await deductCredits(userId, pipelineCredits);
        if (!ok) {
          return new Response(
            JSON.stringify({ error: 'Insufficient credits' }),
            { status: 402, headers: { 'Content-Type': 'application/json' } }
          );
        }
      }
    }

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

            // Deduct credits for direct mode video
            if (userId && !(user?.isAdmin)) {
              const { estimateVideoCost } = await import('@/lib/costs');
              const actualCredits = usdToCredits(estimateVideoCost(video.duration, true));
              await deductCredits(userId, actualCredits);
            }

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

            // Build tagged reference image context for the idea agent
            const refImages = (options.referenceImages || []).filter((r: any) => r && r.dataUrl);
            console.log(`📎 Reference images: ${refImages.length} provided (raw slots: ${(options.referenceImages || []).length}, non-null: ${(options.referenceImages || []).filter(Boolean).length})`);
            let ideaPromptWithRefs = idea;
            if (refImages.length > 0) {
              const tagList = refImages.map((r: any, i: number) => `[${r.tag || `image-${i + 1}`}]`).join(', ');
              ideaPromptWithRefs = `${idea}\n\nThe user provided these reference images for visual guidance: ${tagList}. Incorporate these visual elements into the concept.`;
              sendEvent({ type: 'agent-log', agent: 'idea', status: `Reference images: ${tagList}` });
            }

            const refDataUrls = refImages.map((r: any) => r.dataUrl as string);
            const ideaResult = await executeIdeaAgent(ideaPromptWithRefs, options.ideaAgent, refDataUrls.length > 0 ? refDataUrls : undefined);
            await updateGenerationIdea(sessionId, ideaResult);

            sendEvent({ type: 'agent-log', agent: 'idea', status: `Concept: "${ideaResult.title}"` });
            sendEvent({ type: 'agent-log', agent: 'idea', status: `Style: ${ideaResult.style} / Mood: ${ideaResult.mood}` });
            sendEvent({ type: 'agent-log', agent: 'idea', status: `Key elements: ${ideaResult.keyElements.join(', ')}` });
            sendEvent({ type: 'agent-complete', agent: 'idea', result: ideaResult });

            // Mood Board: Generate reference images from concept
            let moodBoard: string[] = [];
            sendEvent({ type: 'mood-board-start', status: 'Generating mood board images...' });
            sendEvent({ type: 'agent-log', agent: 'mood-board', status: `Creating visual references for "${ideaResult.title}"` });

            try {
              sendEvent({ type: 'agent-log', agent: 'mood-board', status: `${refDataUrls.length > 0 ? `Passing ${refDataUrls.length} reference image(s) to mood board generation` : 'No reference images — generating from concept only'}` });
              moodBoard = await executeMoodBoardAgent(ideaResult, refDataUrls.length > 0 ? refDataUrls : undefined);
              sendEvent({ type: 'agent-log', agent: 'mood-board', status: `Generated ${moodBoard.length} reference images` });
              sendEvent({ type: 'mood-board-complete', moodBoard });
            } catch (error) {
              console.error('❌ Mood board generation failed:', error);
              sendEvent({ type: 'agent-log', agent: 'mood-board', status: `Mood board failed — continuing without visual references` });
              sendEvent({ type: 'mood-board-complete', moodBoard: [] });
            }

            // Agent 2: Scenes
            sendEvent({ type: 'agent-log', agent: 'scenes', status: `Taking concept "${ideaResult.title}" and breaking into ${options.numScenes || 'auto'} shots` });
            sendEvent({ type: 'agent-log', agent: 'scenes', status: `Maintaining consistency: ${ideaResult.style} style, ${ideaResult.mood} mood across all scenes` });
            sendEvent({ type: 'agent-log', agent: 'scenes', status: 'Crafting camera angles, lighting, composition for each scene...' });
            sendEvent({ type: 'agent-start', agent: 'scenes', status: 'Crafting scene variations...' });

            const scenesResult = await executeScenesAgent(ideaResult, options.numScenes, options.sceneAgent, options.duration || 8, options.noMusic || false, options.totalLength, refDataUrls.length > 0 ? refDataUrls : undefined);
            await updateGenerationScenes(sessionId, scenesResult);

            sendEvent({ type: 'agent-log', agent: 'scenes', status: `Generated ${scenesResult.scenes.length} scenes` });
            scenesResult.scenes.forEach((scene, i) => {
              sendEvent({ type: 'agent-log', agent: 'scenes', status: `Shot ${i + 1}: ${scene.prompt.substring(0, 80)}...` });
            });
            sendEvent({ type: 'agent-log', agent: 'scenes', status: `Consistency: ${scenesResult.consistencyNotes.substring(0, 100)}...` });
            sendEvent({ type: 'agent-complete', agent: 'scenes', result: scenesResult });

            // Storyboard: Character portraits → Group refs → Scene frames
            let storyboardImages: string[] = [];
            let characterPortraits: Record<string, string> = {};

            sendEvent({ type: 'storyboard-start' as any, status: 'Generating character-consistent storyboard...' });

            try {
              const chars = scenesResult.characters || [];
              sendEvent({ type: 'agent-log', agent: 'mood-board', status: `Found ${chars.length} character(s): ${chars.map((c: any) => c.name).join(', ') || 'none'}` });

              // Step 1: Character portraits
              if (chars.length > 0) {
                sendEvent({ type: 'agent-log', agent: 'mood-board', status: `Generating ${chars.length} character portrait(s)...` });
                try {
                  characterPortraits = await generateCharacterPortraits(chars, ideaResult.style, ideaResult.mood, options.modeId);
                  sendEvent({ type: 'agent-log', agent: 'mood-board', status: `${Object.keys(characterPortraits).length} portrait(s) ready` });
                } catch (e) {
                  sendEvent({ type: 'agent-log', agent: 'mood-board', status: `Portrait generation failed: ${e instanceof Error ? e.message : 'Unknown error'}` });
                }
              }

              // Step 2: Group references for multi-character scenes
              let groupRefs: Record<string, string> = {};
              try {
                groupRefs = await generateGroupReferences(
                  scenesResult.scenes, chars, characterPortraits, ideaResult.style, ideaResult.mood,
                );
                if (Object.keys(groupRefs).length > 0) {
                  sendEvent({ type: 'agent-log', agent: 'mood-board', status: `${Object.keys(groupRefs).length} group reference(s) ready` });
                }
              } catch (e) {
                sendEvent({ type: 'agent-log', agent: 'mood-board', status: `Group refs failed: ${e instanceof Error ? e.message : 'Unknown error'}` });
              }

              // Step 3: Scene storyboard frames
              sendEvent({ type: 'agent-log', agent: 'mood-board', status: `Generating ${scenesResult.scenes.length} scene frames...` });
              try {
                storyboardImages = await generateSceneStoryboards(
                  scenesResult.scenes, chars, characterPortraits, groupRefs, ideaResult.style, ideaResult.mood, options.modeId,
                );
                sendEvent({ type: 'agent-log', agent: 'mood-board', status: `${storyboardImages.filter(Boolean).length}/${scenesResult.scenes.length} storyboard frames ready` });
              } catch (e) {
                sendEvent({ type: 'agent-log', agent: 'mood-board', status: `Scene frames failed: ${e instanceof Error ? e.message : 'Unknown error'}` });
              }

              sendEvent({ type: 'storyboard-complete' as any, storyboardImages, characterPortraits });
            } catch (error) {
              console.error('❌ Storyboard generation failed:', error);
              sendEvent({ type: 'agent-log', agent: 'mood-board', status: `Storyboard failed: ${error instanceof Error ? error.message : 'Unknown error'}` });
              sendEvent({ type: 'storyboard-complete' as any, storyboardImages: [], characterPortraits: {} });
            }

            // Pause for review — send scenes-ready event and stop
            sendEvent({ type: 'agent-log', agent: 'system', status: 'Scenes ready for review. Edit prompts and click Generate Videos to continue.' });
            sendEvent({ type: 'scenes-ready' as any, sessionId, result: { idea: ideaResult, scenes: scenesResult }, moodBoard, storyboardImages, characterPortraits });
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
