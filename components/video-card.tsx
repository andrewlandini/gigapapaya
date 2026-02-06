'use client';

import { useRef, useState, useEffect } from 'react';
import Link from 'next/link';
import { Globe, Lock, Heart } from 'lucide-react';

interface VideoCardProps {
  id: string;
  blobUrl: string;
  prompt: string;
  username?: string;
  avatarUrl?: string | null;
  aspectRatio: string;
  duration: number;
  visibility?: string;
  heartCount?: number;
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
  heartCount,
  showVisibilityToggle,
  onToggleVisibility,
}: VideoCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLAnchorElement>(null);
  const [hovering, setHovering] = useState(false);
  const [visible, setVisible] = useState(false);

  // Only load video src when card enters viewport
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' } // start loading 200px before visible
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

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
    <Link
      ref={containerRef}
      href={`/v/${id}`}
      className="block relative rounded-xl overflow-hidden border border-[#222] hover:border-[#444] transition-all group cursor-pointer bg-black"
      style={{ aspectRatio: '9/16' }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <video
        ref={videoRef}
        src={visible ? blobUrl : undefined}
        muted
        loop
        playsInline
        preload="metadata"
        className="w-full h-full object-contain"
      />

      {/* Bottom overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {username && (
              <span
                className="flex items-center gap-1.5"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="w-5 h-5 rounded-full bg-[#333] flex items-center justify-center text-[10px] font-bold text-white overflow-hidden">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={username} className="w-full h-full object-cover" />
                  ) : (
                    username[0].toUpperCase()
                  )}
                </div>
                <span className="text-xs text-white/80 font-medium">@{username}</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {heartCount !== undefined && heartCount > 0 && (
              <span className="flex items-center gap-1 text-white/70">
                <Heart className="h-3 w-3 fill-current" />
                <span className="text-[10px] font-medium">{heartCount}</span>
              </span>
            )}
            {showVisibilityToggle && onToggleVisibility && (
              <button
                onClick={(e) => {
                  e.preventDefault();
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
          </div>
        </div>
      </div>
    </Link>
  );
}
