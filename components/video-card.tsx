'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { Eye, EyeOff, Globe, Lock } from 'lucide-react';

interface VideoCardProps {
  id: string;
  blobUrl: string;
  prompt: string;
  username?: string;
  avatarUrl?: string | null;
  aspectRatio: string;
  duration: number;
  visibility?: string;
  showVisibilityToggle?: boolean;
  onToggleVisibility?: (id: string, visibility: 'public' | 'private') => void;
}

export function VideoCard({
  id,
  blobUrl,
  prompt,
  username,
  avatarUrl,
  aspectRatio,
  duration,
  visibility,
  showVisibilityToggle,
  onToggleVisibility,
}: VideoCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hovering, setHovering] = useState(false);

  const handleMouseEnter = () => {
    setHovering(true);
    videoRef.current?.play().catch(() => {});
  };

  const handleMouseLeave = () => {
    setHovering(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  return (
    <div
      className="relative rounded-xl overflow-hidden border border-[#222] hover:border-[#444] transition-all group cursor-pointer"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <video
        ref={videoRef}
        src={blobUrl}
        muted
        loop
        playsInline
        preload="metadata"
        className="w-full object-cover"
      />

      {/* Bottom overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {username && (
              <Link
                href={`/u/${username}`}
                className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="w-5 h-5 rounded-full bg-[#333] flex items-center justify-center text-[10px] font-bold text-white">
                  {username[0].toUpperCase()}
                </div>
                <span className="text-xs text-white/80 font-medium">@{username}</span>
              </Link>
            )}
          </div>

          <div className="flex items-center gap-2">
            {showVisibilityToggle && onToggleVisibility && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleVisibility(id, visibility === 'public' ? 'private' : 'public');
                }}
                className="p-1 rounded hover:bg-white/20 transition-colors"
                title={visibility === 'public' ? 'Make private' : 'Share to feed'}
              >
                {visibility === 'public' ? (
                  <Globe className="h-3.5 w-3.5 text-[#00cc88]" />
                ) : (
                  <Lock className="h-3.5 w-3.5 text-[#888]" />
                )}
              </button>
            )}
            <span className="text-[10px] font-mono text-white/50 bg-black/40 px-1.5 py-0.5 rounded">
              gigapapaya
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
