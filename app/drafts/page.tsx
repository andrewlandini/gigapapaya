'use client';

import Link from 'next/link';
import { Loader2, X, Play, ArrowLeft } from 'lucide-react';
import { useGeneration, type Draft } from '@/components/generation-context';

export default function DraftsPage() {
  const { drafts, clearDraft, clearCompletedDrafts } = useGeneration();

  return (
    <div className="min-h-screen bg-black">
      <header className="border-b border-[#222]">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-[#555] hover:text-white transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <span className="text-[15px] font-semibold tracking-tight">Drafts</span>
            {drafts.length > 0 && (
              <span className="text-xs font-mono text-[#555]">{drafts.length}</span>
            )}
          </div>
          {drafts.some(d => d.status !== 'generating') && (
            <button
              onClick={clearCompletedDrafts}
              className="text-xs text-[#555] hover:text-white transition-colors"
            >
              Clear finished
            </button>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {drafts.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-[#555]">No drafts</p>
            <p className="text-[#333] text-sm mt-1">Generate a video from the prompt bar to see it here</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {drafts.map((draft) => (
              <DraftCard key={draft.id} draft={draft} onClear={clearDraft} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function DraftCard({ draft, onClear }: { draft: Draft; onClear: (id: string) => void }) {
  return (
    <div className="border border-[#222] rounded-xl overflow-hidden hover:border-[#333] transition-colors">
      <div className="p-4 flex items-start gap-4">
        {/* Thumbnail */}
        <div className="flex-shrink-0 w-40 aspect-video rounded-lg overflow-hidden bg-[#111] border border-[#222]">
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
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#111] to-[#0a0a0a]">
              <Loader2 className="h-5 w-5 text-[#555] animate-spin" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-[#ededed]">{draft.prompt}</p>
          <div className="flex items-center gap-3 mt-2">
            {draft.status === 'generating' && (
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-[#0070f3] animate-pulse-dot" />
                <span className="text-xs font-mono text-[#666]">Generating...</span>
              </div>
            )}
            {draft.status === 'complete' && (
              <div className="flex items-center gap-1.5">
                <Play className="h-3 w-3 text-[#00cc88]" />
                <span className="text-xs font-mono text-[#00cc88]">Complete</span>
                <span className="text-xs font-mono text-[#555]">
                  {draft.videos.length} video{draft.videos.length !== 1 ? 's' : ''}
                </span>
              </div>
            )}
            {draft.status === 'error' && (
              <span className="text-xs font-mono text-[#ff4444]">{draft.error || 'Failed'}</span>
            )}
            <span className="text-xs font-mono text-[#333]">
              {draft.options.aspectRatio} / {draft.options.duration}s
            </span>
          </div>
        </div>

        {/* Close */}
        <button
          onClick={() => onClear(draft.id)}
          className="flex-shrink-0 p-1.5 rounded-lg text-[#555] hover:text-white hover:bg-[#222] transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Completed videos */}
      {draft.status === 'complete' && draft.videos.length > 0 && (
        <div className="border-t border-[#222] p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {draft.videos.map((video) => (
              <div key={video.id} className="rounded-lg overflow-hidden border border-[#222]">
                <video
                  src={video.url}
                  muted
                  loop
                  playsInline
                  controls
                  preload="none"
                  poster={video.thumbnailUrl || undefined}
                  className="w-full"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
