import { NextRequest } from 'next/server';
import { executeVideoAgent, describeStoryboardFrame } from '@/lib/ai/agents';
import { getSession } from '@/lib/auth/session';
import {
  initDb,
  updateGenerationStatus,
  saveVideoRecord,
  getUserCredits,
  deductCredits,
  isUserAdmin,
} from '@/lib/db';
import { usdToCredits, estimateGenerateVideosCost, estimateVideoCost } from '@/lib/costs';
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

    const { sessionId, scenes, style, mood, options, moodBoard, storyboardImages, characterPortraits } = body as {
      sessionId: string;
      scenes: { prompt: string; dialogue?: string; duration: number }[];
      style: string;
      mood: string;
      options: GenerationOptions;
      moodBoard?: string[];
      storyboardImages?: string[];
      characterPortraits?: Record<string, string>;
    };

    console.log(`📝 Session: ${sessionId}`);
    console.log(`📹 Scenes: ${scenes.length}`);

    // Credit check (admins bypass)
    const isAdmin = userId ? await isUserAdmin(userId) : false;
    if (userId && !isAdmin) {
      const { credits } = await getUserCredits(userId);
      const estimatedCredits = usdToCredits(estimateGenerateVideosCost(scenes));
      if (credits < estimatedCredits) {
        return new Response(
          JSON.stringify({ error: 'Insufficient credits', required: estimatedCredits, available: credits }),
          { status: 402, headers: { 'Content-Type': 'application/json' } }
        );
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

        // Verbose debug log — always sent for admin users
        const isAdmin = user?.isAdmin === true;
        const debug = (msg: string) => {
          if (!isAdmin) return;
          sendEvent({ type: 'agent-log', agent: 'videos', status: `[DEBUG] ${msg}` });
        };

        try {
          const videos: any[] = [];

          // Shot agent already writes Veo3-ready prompts — go straight to video generation
          const perShotDurations = scenes.map((s: any) => s.duration || (typeof options?.duration === 'number' ? options.duration : 8));

          sendEvent({ type: 'agent-log', agent: 'videos', status: `Starting video generation for ${scenes.length} shots (using storyboard frames as reference)` });
          sendEvent({ type: 'agent-log', agent: 'videos', status: `Config: ${options.aspectRatio} / ${options.duration === 'auto' ? 'auto' : options.duration + 's'} / model: veo-3.1-generate-001` });
          debug(`User: ${user?.username || 'unknown'}`);
          debug(`Session ID: ${sessionId}`);
          debug(`Storyboard images provided: ${storyboardImages?.filter(Boolean).length || 0}/${scenes.length}`);
          debug(`Mood board images provided: ${moodBoard?.length || 0}`);
          debug(`Character portraits provided: ${Object.keys(characterPortraits || {}).length}`);

          for (let i = 0; i < scenes.length; i++) {
            const scene = scenes[i] as { prompt: string; dialogue?: string; duration: number };

            // ── Storyboard frame vision analysis ──
            // Analyze the storyboard frame with Gemini vision to inject a detailed
            // visual description, compensating for broken image-to-video mode.
            let visualDescription = '';
            const storyboardFrame = storyboardImages?.[i] && storyboardImages[i] !== '' ? storyboardImages[i] : undefined;
            if (storyboardFrame) {
              try {
                sendEvent({ type: 'agent-log', agent: 'videos', status: `Analyzing storyboard frame ${i + 1}...` });
                visualDescription = await describeStoryboardFrame(storyboardFrame, style, mood);
                debug(`Vision analysis for shot ${i + 1} (${visualDescription.length} chars): ${visualDescription}`);
              } catch (error) {
                const errMsg = error instanceof Error ? error.message : 'Unknown error';
                debug(`Vision analysis failed for shot ${i + 1}: ${errMsg} — continuing with original prompt`);
              }
            }

            // Recombine visual prompt + dialogue for Veo 3.1
            // Dialogue must be woven in BEFORE style/camera specs since Veo weights early tokens more
            let finalPrompt = visualDescription
              ? `[VISUAL REFERENCE: ${visualDescription}] ${scene.prompt}`
              : scene.prompt;
            if (scene.dialogue) {
              const styleMarkers = [', shot on ', ', Shot on ', '. Shot on ', ', filmed on ', ', ARRI ', ', RED ', ', Sony '];
              let insertIdx = -1;
              for (const marker of styleMarkers) {
                const idx = finalPrompt.indexOf(marker);
                if (idx !== -1) { insertIdx = idx; break; }
              }
              if (insertIdx !== -1) {
                finalPrompt = `${finalPrompt.slice(0, insertIdx)}, saying "${scene.dialogue}"${finalPrompt.slice(insertIdx)}`;
              } else {
                const splitPoint = Math.floor(finalPrompt.length * 0.6);
                const lastComma = finalPrompt.lastIndexOf(', ', splitPoint);
                if (lastComma > finalPrompt.length * 0.3) {
                  finalPrompt = `${finalPrompt.slice(0, lastComma)}, saying "${scene.dialogue}"${finalPrompt.slice(lastComma)}`;
                } else {
                  finalPrompt = `${finalPrompt}, saying "${scene.dialogue}"`;
                }
              }
            }
            const shotDuration = perShotDurations[i];
            const shotOptions = { ...options, duration: shotDuration };

            // Reference image priority (must be JPEG/PNG — Veo 3.1 image-to-video rejects video files):
            // 1. Current shot's storyboard frame (character-consistent pre-generated image)
            // 2. Mood board fallback
            const storyboardRef = storyboardImages?.[i] && storyboardImages[i] !== '' ? storyboardImages[i] : undefined;
            const moodBoardRef = moodBoard?.length ? moodBoard[i % moodBoard.length] : undefined;
            const refImage = storyboardRef || moodBoardRef;

            debug(`--- Shot ${i + 1}/${scenes.length} ---`);
            debug(`Duration: ${shotDuration}s | Aspect: ${shotOptions.aspectRatio}`);
            debug(`Original prompt (${scene.prompt.length} chars): ${scene.prompt}`);
            if (scene.dialogue) debug(`Dialogue: "${scene.dialogue}"`);
            debug(`Final prompt after dialogue merge (${finalPrompt.length} chars): ${finalPrompt}`);
            debug(`Ref image source: ${storyboardRef ? 'storyboard frame' : moodBoardRef ? 'mood board' : 'NONE'}`);
            if (refImage) debug(`Ref image URL: ${refImage}`);

            sendEvent({ type: 'agent-log', agent: 'videos', status: `Sending shot ${i + 1}/${scenes.length} to Veo 3.1 (${shotDuration}s)${refImage ? ' — with reference image' : ''}` });
            sendEvent({
              type: 'video-start', sceneIndex: i, prompt: finalPrompt,
              status: `Generating video ${i + 1}/${scenes.length}...`,
            });

            const shotStartTime = Date.now();
            try {
              const video = await executeVideoAgent(
                finalPrompt, style, mood, shotOptions, i, refImage
              );
              const shotElapsed = ((Date.now() - shotStartTime) / 1000).toFixed(1);
              debug(`Shot ${i + 1} succeeded in ${shotElapsed}s — ${(video.size / (1024 * 1024)).toFixed(2)} MB — ${video.url}`);

              const thumbnailUrl = storyboardImages?.[i] && storyboardImages[i] !== '' ? storyboardImages[i] : undefined;
              video.thumbnailUrl = thumbnailUrl;

              await saveVideoRecord({
                id: video.id, generationId: sessionId, userId,
                blobUrl: video.url, prompt: video.prompt, duration: video.duration,
                aspectRatio: video.aspectRatio, size: video.size, sceneIndex: i,
                thumbnailUrl,
              });

              // Deduct credits for this video
              if (userId && !isAdmin) {
                const actualCredits = usdToCredits(estimateVideoCost(video.duration, Boolean(scene.dialogue?.trim())));
                await deductCredits(userId, actualCredits);
              }

              videos.push(video);
              sendEvent({ type: 'agent-log', agent: 'videos', status: `Shot ${i + 1} complete — ${(video.size / (1024 * 1024)).toFixed(1)} MB uploaded` });
              sendEvent({ type: 'video-complete', sceneIndex: i, videoId: video.id, video });
            } catch (error) {
              const shotElapsed = ((Date.now() - shotStartTime) / 1000).toFixed(1);
              console.error(`❌ Failed to generate video ${i + 1}:`, error);
              const errMsg = error instanceof Error ? error.message : 'Unknown error';
              const errStack = error instanceof Error ? error.stack : String(error);
              debug(`Shot ${i + 1} FAILED after ${shotElapsed}s`);
              debug(`Error message: ${errMsg}`);
              debug(`Error stack: ${errStack}`);
              if (error && typeof error === 'object' && 'cause' in error) {
                debug(`Error cause: ${JSON.stringify((error as any).cause, null, 2)}`);
              }
              if (error && typeof error === 'object') {
                const keys = Object.keys(error).filter(k => !['message', 'stack', 'name'].includes(k));
                if (keys.length > 0) debug(`Extra error fields: ${JSON.stringify(Object.fromEntries(keys.map(k => [k, (error as any)[k]])))}`);
              }
              sendEvent({ type: 'agent-log', agent: 'videos', status: `Shot ${i + 1} failed: ${errMsg}` });
              sendEvent({
                type: 'error',
                message: `Failed to generate video ${i + 1}: ${errMsg}`,
                sceneIndex: i,
              });
              // Don't break — continue to next shot, falling back to storyboard frame
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
