'use client';

import { useRef, useState, useEffect, useMemo, useCallback } from 'react';
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
  heart_count?: string;
}

interface FeedGridProps {
  videos: FeedVideo[];
  showVisibilityToggle?: boolean;
  onToggleVisibility?: (id: string, visibility: 'public' | 'private') => void;
}

function isLandscape(ar: string) {
  return ar === '16:9' || ar === '4:3';
}

export function FeedGrid({ videos, showVisibilityToggle, onToggleVisibility }: FeedGridProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(2);

  // Read actual rendered column count from the grid's computed style
  const updateCols = useCallback(() => {
    const el = gridRef.current;
    if (!el) return;
    const computed = getComputedStyle(el).gridTemplateColumns;
    // gridTemplateColumns returns something like "200px 200px 200px" — count the values
    const count = computed.split(' ').filter(Boolean).length;
    if (count > 0) setCols(count);
  }, []);

  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    // Initial read after first paint
    requestAnimationFrame(updateCols);
    const observer = new ResizeObserver(updateCols);
    observer.observe(el);
    return () => observer.disconnect();
  }, [updateCols]);

  // Compute tile aspect per video based on row grouping
  const tileAspects = useMemo(() => {
    const aspects: string[] = [];
    for (let i = 0; i < videos.length; i++) {
      const rowStart = Math.floor(i / cols) * cols;
      const rowEnd = Math.min(rowStart + cols, videos.length);
      const rowVideos = videos.slice(rowStart, rowEnd);
      const allLandscape = rowVideos.every(v => isLandscape(v.aspect_ratio));
      aspects.push(allLandscape ? '16/9' : '9/16');
    }
    return aspects;
  }, [videos, cols]);

  if (videos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <p className="text-[#555] text-lg">No videos yet</p>
        <p className="text-[#333] text-sm mt-2">Be the first to share something</p>
      </div>
    );
  }

  return (
    <div ref={gridRef} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
      {videos.map((video, i) => (
        <div key={video.id}>
          <VideoCard
            id={video.id}
            blobUrl={video.blob_url}
            prompt={video.prompt}
            username={video.username}
            avatarUrl={video.avatar_url}
            aspectRatio={video.aspect_ratio}
            duration={video.duration}
            heartCount={video.heart_count ? parseInt(video.heart_count, 10) : undefined}
            visibility={video.visibility}
            showVisibilityToggle={showVisibilityToggle}
            onToggleVisibility={onToggleVisibility}
            tileAspect={tileAspects[i]}
          />
        </div>
      ))}
    </div>
  );
}
