'use client';

import { useState, useRef } from 'react';
import { Download, Play, ExternalLink, RotateCw, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { Video } from '@/lib/types';
import Link from 'next/link';

interface VideoGalleryProps {
  videos: Video[];
  sessionId?: string;
  onRerunShot?: (index: number) => void;
  rerunningShots?: Set<number>;
}

function HoverVideo({ video, isRerunning }: { video: Video; isRerunning: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  const handleMouseEnter = () => {
    if (!videoRef.current) return;
    setPlaying(true);
    videoRef.current.play().catch(() => {});
  };

  const handleMouseLeave = () => {
    if (!videoRef.current) return;
    setPlaying(false);
    videoRef.current.pause();
    videoRef.current.currentTime = 0;
  };

  return (
    <div
      className="aspect-video bg-[#0a0a0a] relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {isRerunning && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 text-[#0070f3] animate-spin" />
            <span className="text-xs font-mono text-[#888]">re-generating...</span>
          </div>
        </div>
      )}
      {/* Poster image — always visible when not playing */}
      {video.thumbnailUrl && !playing && (
        <img
          src={video.thumbnailUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}
      {/* Video — only loads src on hover */}
      <video
        ref={videoRef}
        src={playing ? video.url : undefined}
        muted
        loop
        playsInline
        preload="none"
        className="w-full h-full object-contain"
      />
      {/* Play icon overlay */}
      {!playing && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center">
            <Play className="h-5 w-5 text-white ml-0.5" />
          </div>
        </div>
      )}
    </div>
  );
}

export function VideoGallery({ videos, sessionId, onRerunShot, rerunningShots }: VideoGalleryProps) {
  if (videos.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-medium text-[#ededed]">Generated Videos</h2>
          <Badge variant="success">{videos.length} ready</Badge>
        </div>
        {sessionId && videos.length > 1 && (
          <Link
            href={`/s/${sessionId}`}
            className="flex items-center gap-1.5 text-xs font-mono text-[#555] hover:text-[#ededed] transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            View as scene
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {videos.map((video, i) => {
          const isRerunning = rerunningShots?.has(i);
          return (
            <div
              key={video.id}
              className={`border rounded-xl overflow-hidden transition-colors group animate-fade-in ${isRerunning ? 'border-[#0070f3]/40' : 'border-[#222] hover:border-[#333]'}`}
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <HoverVideo video={video} isRerunning={!!isRerunning} />
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-[#444]">Shot {i + 1}</span>
                  <span className="text-[#333]">/</span>
                  <span className="text-xs font-mono text-[#444]">{video.aspectRatio}</span>
                  <span className="text-[#333]">/</span>
                  <span className="text-xs font-mono text-[#444]">{video.duration}s</span>
                  <span className="text-[#333]">/</span>
                  <span className="text-xs font-mono text-[#444]">{(video.size / (1024 * 1024)).toFixed(1)}MB</span>
                </div>
                <p className="text-xs text-[#666] leading-relaxed">
                  {video.prompt}
                </p>
                <div className="flex gap-2">
                  <a
                    href={`/api/download/${video.id}`}
                    download={video.filename}
                    className="inline-flex items-center justify-center flex-1 h-8 px-3 text-xs font-medium rounded-lg border border-[#333] bg-transparent text-[#ededed] hover:bg-[#111] hover:border-[#555] transition-all"
                  >
                    <Download className="h-3.5 w-3.5 mr-2" />
                    Download
                  </a>
                  {onRerunShot && (
                    <button
                      onClick={() => onRerunShot(i)}
                      disabled={isRerunning}
                      className="inline-flex items-center justify-center h-8 px-3 text-xs font-medium rounded-lg border border-[#333] bg-transparent text-[#888] hover:text-[#ededed] hover:bg-[#111] hover:border-[#555] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      title="Re-run this shot"
                    >
                      {isRerunning ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RotateCw className="h-3.5 w-3.5" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
