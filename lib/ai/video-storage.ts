import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { Video } from '../types';

const VIDEO_STORAGE_PATH = process.env.VIDEO_STORAGE_PATH || '/tmp/videos';

/**
 * Ensure video storage directory exists
 */
async function ensureStorageDir(): Promise<void> {
  try {
    await fs.mkdir(VIDEO_STORAGE_PATH, { recursive: true });
  } catch (error) {
    console.error('❌ Failed to create storage directory:', error);
    throw error;
  }
}

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
    'video/x-msvideo': 'avi',
    'video/webm': 'webm',
  };

  return mimeToExt[mimeType] || 'mp4';
}

/**
 * Save video to filesystem
 * @param videoData - Video data as Uint8Array from AI SDK
 * @param metadata - Video metadata (prompt, duration, aspectRatio)
 * @returns Saved video metadata
 */
export async function saveVideo(
  videoData: Uint8Array | { uint8Array: Uint8Array; mimeType?: string },
  metadata: {
    prompt: string;
    duration: number;
    aspectRatio: string;
  }
): Promise<Video> {
  await ensureStorageDir();

  // Handle both direct Uint8Array and video object with mimeType
  const uint8Array = videoData instanceof Uint8Array
    ? videoData
    : videoData.uint8Array;
  const mimeType = videoData instanceof Uint8Array
    ? undefined
    : videoData.mimeType;

  const id = generateVideoId();
  const extension = getExtensionFromMimeType(mimeType);
  const filename = `${id}.${extension}`;
  const filepath = path.join(VIDEO_STORAGE_PATH, filename);

  console.log(`💾 Saving video: ${filename}`);
  console.log(`📂 Path: ${filepath}`);
  console.log(`📊 Size: ${(uint8Array.length / (1024 * 1024)).toFixed(2)} MB`);

  try {
    // Write video file
    await fs.writeFile(filepath, uint8Array);

    // Get file stats
    const stats = await fs.stat(filepath);

    const video: Video = {
      id,
      filename,
      path: filepath,
      url: `/api/videos/${id}`,
      ...metadata,
      createdAt: new Date(),
      size: stats.size,
    };

    console.log(`✅ Video saved successfully: ${filename}`);

    return video;
  } catch (error) {
    console.error(`❌ Failed to save video: ${filename}`, error);
    throw error;
  }
}

/**
 * Get video file path by ID
 * @param videoId - Video ID
 * @returns Absolute file path
 */
export async function getVideoPath(videoId: string): Promise<string> {
  // Try different extensions
  const extensions = ['mp4', 'mov', 'avi', 'webm'];

  for (const ext of extensions) {
    const filepath = path.join(VIDEO_STORAGE_PATH, `${videoId}.${ext}`);
    try {
      await fs.access(filepath);
      return filepath;
    } catch {
      // File doesn't exist with this extension, try next
      continue;
    }
  }

  throw new Error(`Video not found: ${videoId}`);
}

/**
 * Read video file
 * @param videoId - Video ID
 * @returns Video buffer
 */
export async function readVideo(videoId: string): Promise<Buffer> {
  const filepath = await getVideoPath(videoId);
  console.log(`📖 Reading video: ${filepath}`);

  try {
    const buffer = await fs.readFile(filepath);
    console.log(`✅ Video read: ${(buffer.length / (1024 * 1024)).toFixed(2)} MB`);
    return buffer;
  } catch (error) {
    console.error(`❌ Failed to read video: ${filepath}`, error);
    throw error;
  }
}

/**
 * Delete video file
 * @param videoId - Video ID
 */
export async function deleteVideo(videoId: string): Promise<void> {
  const filepath = await getVideoPath(videoId);
  console.log(`🗑️  Deleting video: ${filepath}`);

  try {
    await fs.unlink(filepath);
    console.log(`✅ Video deleted: ${filepath}`);
  } catch (error) {
    console.error(`❌ Failed to delete video: ${filepath}`, error);
    throw error;
  }
}

/**
 * List all videos in storage
 */
export async function listVideos(): Promise<string[]> {
  await ensureStorageDir();

  try {
    const files = await fs.readdir(VIDEO_STORAGE_PATH);
    const videoFiles = files.filter(file =>
      /\.(mp4|mov|avi|webm)$/i.test(file)
    );
    return videoFiles;
  } catch (error) {
    console.error('❌ Failed to list videos:', error);
    return [];
  }
}

/**
 * Cleanup old videos (for maintenance)
 * @param maxAgeHours - Maximum age in hours (default 24)
 */
export async function cleanupOldVideos(maxAgeHours: number = 24): Promise<number> {
  await ensureStorageDir();

  console.log(`🧹 Cleaning up videos older than ${maxAgeHours} hours...`);

  try {
    const files = await fs.readdir(VIDEO_STORAGE_PATH);
    const now = Date.now();
    let deletedCount = 0;

    for (const file of files) {
      if (!/\.(mp4|mov|avi|webm)$/i.test(file)) continue;

      const filepath = path.join(VIDEO_STORAGE_PATH, file);
      const stats = await fs.stat(filepath);
      const ageHours = (now - stats.mtimeMs) / (1000 * 60 * 60);

      if (ageHours > maxAgeHours) {
        await fs.unlink(filepath);
        deletedCount++;
        console.log(`  🗑️  Deleted: ${file} (${ageHours.toFixed(1)}h old)`);
      }
    }

    console.log(`✅ Cleanup complete: ${deletedCount} videos deleted`);
    return deletedCount;
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    return 0;
  }
}
