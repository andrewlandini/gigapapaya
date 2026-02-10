import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { executeIdeaAgent, executeScenesAgent, executeVideoAgent, executeMoodBoardAgent, generateCharacterPortraits, generateGroupReferences, generateEnvironmentImages, generateSceneStoryboards } from '@/lib/ai/agents';
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
            const videoModelId = options.videoModel || 'google/veo-3.1-generate-001';
            const videoModelLabel = videoModelId.split('/').pop() || videoModelId;
            sendEvent({ type: 'agent-log', agent: 'system', status: `Direct mode — skipping agents, sending prompt straight to ${videoModelLabel}` });
            sendEvent({ type: 'agent-log', agent: 'system', status: `Prompt: "${idea.substring(0, 120)}${idea.length > 120 ? '...' : ''}"` });
            sendEvent({ type: 'agent-log', agent: 'system', status: `Config: ${options.aspectRatio} / ${options.duration}s / model: ${videoModelLabel}` });

            sendEvent({
              type: 'video-start',
              sceneIndex: 0,
              prompt: idea,
              status: 'Generating video from your prompt...',
            });

            const firstRefImage = (options.referenceImages || []).find((r: any) => r && r.dataUrl);
            const video = await executeVideoAgent(idea, '', '', options, 0, firstRefImage?.dataUrl);

            // Use reference image as thumbnail if available (direct mode has no storyboard)
            const thumbnailUrl = firstRefImage?.dataUrl || undefined;
            if (thumbnailUrl) video.thumbnailUrl = thumbnailUrl;

            await saveVideoRecord({
              id: video.id, generationId: sessionId, userId,
              blobUrl: video.url, prompt: video.prompt, duration: video.duration,
              aspectRatio: video.aspectRatio, size: video.size, sceneIndex: 0,
              thumbnailUrl,
            });

            // Deduct credits for direct mode video
            if (userId && !(user?.isAdmin)) {
              const { estimateVideoCost } = await import('@/lib/costs');
              const actualCredits = usdToCredits(estimateVideoCost(video.duration, true));
              await deductCredits(userId, actualCredits);
            }

            sendEvent({ type: 'agent-log', agent: 'system', status: `Video uploaded to Blob Storage (${(video.size / (1024 * 1024)).toFixed(1)} MB)` });
            sendEvent({ type: 'video-complete', sceneIndex: 0, videoId: video.id, video });

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
              moodBoard = await executeMoodBoardAgent(ideaResult, refDataUrls.length > 0 ? refDataUrls : undefined, (i, url) => {
                sendEvent({ type: 'mood-board-image', moodBoardImage: url });
              }, options.aspectRatio);
              sendEvent({ type: 'agent-log', agent: 'mood-board', status: `Generated ${moodBoard.length} reference images` });
              sendEvent({ type: 'mood-board-complete', moodBoard });
            } catch (error) {
              console.error('❌ Mood board generation failed:', error);
              sendEvent({ type: 'agent-log', agent: 'mood-board', status: `Mood board failed — continuing without visual references` });
              sendEvent({ type: 'mood-board-complete', moodBoard: [] });
            }

            // Pause for mood board review — user selects and refines before continuing
            sendEvent({ type: 'agent-log', agent: 'system', status: 'Mood board ready. Select your favorite and refine the style, then continue.' });
            sendEvent({ type: 'mood-board-ready' as any, sessionId, moodBoard, result: { idea: ideaResult } });
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
