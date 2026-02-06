'use client';

import { VideoCard } from './video-card';

interface FeedVideo {
  id: string;
  blob_url: string;
  prompt: string;
  username: string;
  user_name: string;
  avatar_url: string | null;
  aspect_ratio: string;
  duration: number;
  visibility: string;
}

interface FeedGridProps {
  videos: FeedVideo[];
}

export function FeedGrid({ videos }: FeedGridProps) {
  if (videos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <p className="text-[#555] text-lg">No videos yet</p>
        <p className="text-[#333] text-sm mt-2">Be the first to share something</p>
      </div>
    );
  }

  return (
    <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-3 space-y-3">
      {videos.map((video) => (
        <div key={video.id} className="break-inside-avoid">
          <VideoCard
            id={video.id}
            blobUrl={video.blob_url}
            prompt={video.prompt}
            username={video.username}
            avatarUrl={video.avatar_url}
            aspectRatio={video.aspect_ratio}
            duration={video.duration}
          />
        </div>
      ))}
    </div>
  );
}
