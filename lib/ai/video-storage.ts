import { put, head, del } from '@vercel/blob';
import crypto from 'crypto';
import type { Video } from '../types';

/**
 * Generate unique video ID
 */
function generateVideoId(): string {
  return crypto.randomUUID();
}

/**
 * Get file extension from MIME type
 */
function getExtensionFromMimeType(mimeType?: string): string {
  if (!mimeType) return 'mp4';
  const mimeToExt: Record<string, string> = {
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
    'video/webm': 'webm',
  };
  return mimeToExt[mimeType] || 'mp4';
}

/**
 * Save video to Vercel Blob Storage
 */
export async function saveVideo(
  videoData: Uint8Array | { uint8Array: Uint8Array; mimeType?: string },
  metadata: {
    prompt: string;
    duration: number;
    aspectRatio: string;
  }
): Promise<Video> {
  const uint8Array = videoData instanceof Uint8Array
    ? videoData
    : videoData.uint8Array;
  const mimeType = videoData instanceof Uint8Array
    ? undefined
    : videoData.mimeType;

  const id = generateVideoId();
  const extension = getExtensionFromMimeType(mimeType);
  const filename = `${id}.${extension}`;
  const contentType = mimeType || 'video/mp4';

  console.log(`💾 Uploading video to Blob Storage: ${filename}`);
  console.log(`📊 Size: ${(uint8Array.length / (1024 * 1024)).toFixed(2)} MB`);

  const blob = await put(`videos/${filename}`, Buffer.from(uint8Array), {
    access: 'public',
    contentType,
  });

  console.log(`✅ Uploaded to Blob: ${blob.url}`);

  const video: Video = {
    id,
    filename,
    path: blob.url,
    url: blob.url,
    ...metadata,
    createdAt: new Date(),
    size: uint8Array.length,
  };

  return video;
}

/**
 * Get video blob URL by checking if it exists
 */
export async function getVideoUrl(videoId: string): Promise<string | null> {
  const extensions = ['mp4', 'mov', 'webm'];

  for (const ext of extensions) {
    try {
      const blobPath = `videos/${videoId}.${ext}`;
      const result = await head(blobPath);
      if (result) return result.url;
    } catch {
      continue;
    }
  }

  return null;
}

/**
 * Delete a video from Blob Storage
 */
export async function deleteVideo(blobUrl: string): Promise<void> {
  console.log(`🗑️  Deleting video: ${blobUrl}`);
  await del(blobUrl);
  console.log(`✅ Video deleted`);
}
