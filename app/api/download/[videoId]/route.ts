import { NextRequest } from 'next/server';
import { getVideoById } from '@/lib/db';

export const runtime = 'nodejs';

/**
 * GET /api/download/[videoId]
 * Proxy download from Blob Storage with attachment header
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  try {
    const { videoId } = await params;
    console.log(`⬇️  Downloading video: ${videoId}`);

    const video = await getVideoById(videoId);
    if (!video) {
      return new Response(
        JSON.stringify({ error: 'Video not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Fetch from Blob Storage and stream as download
    const blobResponse = await fetch(video.blob_url);
    if (!blobResponse.ok) {
      throw new Error(`Failed to fetch from blob: ${blobResponse.status}`);
    }

    return new Response(blobResponse.body, {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Disposition': `attachment; filename="${videoId}.mp4"`,
      },
    });
  } catch (error) {
    console.error('❌ Failed to download video:', error);
    return new Response(
      JSON.stringify({ error: 'Video not found' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
