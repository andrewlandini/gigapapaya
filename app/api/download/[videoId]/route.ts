import { NextRequest } from 'next/server';
import { readVideo } from '@/lib/ai/video-storage';

export const runtime = 'nodejs';

/**
 * GET /api/download/[videoId]
 * Download video file
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  try {
    const { videoId } = await params;
    console.log(`⬇️  Downloading video: ${videoId}`);

    const videoBuffer = await readVideo(videoId);

    return new Response(new Uint8Array(videoBuffer), {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Disposition': `attachment; filename="${videoId}.mp4"`,
        'Content-Length': videoBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('❌ Failed to download video:', error);

    return new Response(
      JSON.stringify({ error: 'Video not found' }),
      {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
