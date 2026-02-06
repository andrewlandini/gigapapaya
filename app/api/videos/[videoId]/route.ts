import { NextRequest } from 'next/server';
import { getVideoById } from '@/lib/db';

export const runtime = 'nodejs';

/**
 * GET /api/videos/[videoId]
 * Redirect to Blob Storage URL
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  try {
    const { videoId } = await params;
    console.log(`📺 Serving video: ${videoId}`);

    const video = await getVideoById(videoId);
    if (!video) {
      return new Response(
        JSON.stringify({ error: 'Video not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Redirect to Blob Storage URL
    return Response.redirect(video.blob_url, 302);
  } catch (error) {
    console.error('❌ Failed to serve video:', error);
    return new Response(
      JSON.stringify({ error: 'Video not found' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
