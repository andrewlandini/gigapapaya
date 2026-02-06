'use client';

import Link from 'next/link';
import { FeedGrid } from './feed-grid';
import { PromptBar } from './prompt-bar';
import { useGeneration } from './generation-context';
import { Loader2 } from 'lucide-react';

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

interface HomeContentProps {
  videos: FeedVideo[];
  isAuthenticated: boolean;
}

export function HomeContent({ videos, isAuthenticated }: HomeContentProps) {
  const { drafts } = useGeneration();
  const activeDrafts = drafts.filter(d => d.status === 'generating');
  const totalDraftCount = drafts.length;

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
                    <video
                      src={draft.videos[0].url}
                      muted
                      loop
                      playsInline
                      preload="metadata"
                      className="w-full h-full object-cover"
                    />
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

        {/* Feed */}
        <FeedGrid videos={videos} />
      </main>

      {/* Prompt bar */}
      <PromptBar isAuthenticated={isAuthenticated} />
    </div>
  );
}
