'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { FeedGrid } from './feed-grid';
import { PromptBar } from './prompt-bar';
import { useGeneration } from './generation-context';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const PERIODS = [
  { value: 'day', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'year', label: 'This Year' },
  { value: 'all', label: 'All Time' },
] as const;

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
  thumbnail_url?: string | null;
}

interface HomeContentProps {
  videos: FeedVideo[];
  isAuthenticated: boolean;
}

export function HomeContent({ videos: initialVideos, isAuthenticated }: HomeContentProps) {
  const { drafts } = useGeneration();
  const totalDraftCount = drafts.length;
  const [period, setPeriod] = useState<string>('all');
  const [videos, setVideos] = useState<FeedVideo[]>(initialVideos);
  const [loadingFeed, setLoadingFeed] = useState(false);

  const fetchFeed = useCallback(async (p: string) => {
    setLoadingFeed(true);
    try {
      const res = await fetch(`/api/feed?period=${p}`);
      if (res.ok) setVideos(await res.json());
    } catch {}
    setLoadingFeed(false);
  }, []);

  useEffect(() => {
    // Don't fetch on initial mount since we have server-side data for 'all'
    if (period !== 'all') {
      fetchFeed(period);
    } else {
      setVideos(initialVideos);
    }
  }, [period, fetchFeed, initialVideos]);

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <main className="flex-1 p-4">
        {/* Drafts section */}
        {totalDraftCount > 0 && (
          <Link
            href="/drafts"
            className="block mb-4 group"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-[#ededed]">Drafts</span>
                <span className="h-5 min-w-[20px] px-1.5 rounded-full bg-white text-black text-xs font-bold flex items-center justify-center">
                  {totalDraftCount}
                </span>
              </div>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {drafts.map((draft) => (
                <div
                  key={draft.id}
                  className="flex-shrink-0 w-48 aspect-video rounded-xl border border-[#222] bg-[#0a0a0a] overflow-hidden relative group-hover:border-[#444] transition-colors"
                >
                  {draft.status === 'complete' && draft.videos.length > 0 ? (
                    draft.videos[0].thumbnailUrl ? (
                      <img src={draft.videos[0].thumbnailUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <video
                        src={draft.videos[0].url}
                        muted
                        playsInline
                        preload="metadata"
                        className="w-full h-full object-cover"
                      />
                    )
                  ) : draft.status === 'error' ? (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-xs text-[#ff4444]">Failed</span>
                    </div>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-[#111] to-[#0a0a0a]">
                      <Loader2 className="h-5 w-5 text-[#555] animate-spin" />
                      <span className="text-[10px] text-[#555] font-mono">Generating...</span>
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                    <p className="text-[10px] text-white/70 truncate">{draft.prompt}</p>
                  </div>
                </div>
              ))}
            </div>
          </Link>
        )}

        {/* Period filter tabs */}
        <div className="flex items-center gap-1 mb-4 overflow-x-auto">
          {PERIODS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setPeriod(value)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap',
                period === value
                  ? 'bg-white text-black'
                  : 'text-[#666] hover:text-white hover:bg-[#111]'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Feed */}
        {loadingFeed ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-5 w-5 text-[#555] animate-spin" />
          </div>
        ) : (
          <FeedGrid videos={videos} />
        )}
      </main>

      {/* Prompt bar */}
      <PromptBar isAuthenticated={isAuthenticated} />
    </div>
  );
}
