'use client';

import { useRef, useState, useEffect, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { Globe, Lock, Heart, Volume2, VolumeX } from 'lucide-react';

// ── Global mute state shared across all VideoCard instances ──
let _globalMuted = false;
const _listeners = new Set<() => void>();

function getGlobalMuted() { return _globalMuted; }
function setGlobalMuted(v: boolean) {
  _globalMuted = v;
  _listeners.forEach(l => l());
}
function subscribeGlobalMuted(listener: () => void) {
  _listeners.add(listener);
  return () => { _listeners.delete(listener); };
}
function getServerMuted() { return false; }

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
  tileAspect?: string; // e.g. '9/16' or '16/9'
  thumbnailUrl?: string | null;
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
  tileAspect = '9/16',
  thumbnailUrl,
}: VideoCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLAnchorElement>(null);
  const [hovering, setHovering] = useState(false);
  const muted = useSyncExternalStore(subscribeGlobalMuted, getGlobalMuted, getServerMuted);
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
    if (videoRef.current) {
      videoRef.current.muted = muted;
      videoRef.current.play().catch(() => {});
    }
  };

  const handleMouseLeave = () => {
    setHovering(false);
    if (videoRef.current) {
      videoRef.current.muted = true;
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const next = !muted;
    setGlobalMuted(next);
    if (videoRef.current) videoRef.current.muted = next;
  };

  return (
    <Link
      ref={containerRef}
      href={`/v/${id}`}
      className="block relative rounded-xl overflow-hidden border border-[#222] hover:border-[#444] transition-all group cursor-pointer bg-black"
      style={{ aspectRatio: tileAspect }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Poster image — shown when not hovering (only for videos with thumbnails) */}
      {thumbnailUrl && !hovering && (
        <img
          src={thumbnailUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}
      <video
        ref={videoRef}
        src={thumbnailUrl ? (visible && hovering ? blobUrl : undefined) : (visible ? blobUrl : undefined)}
        muted
        loop
        playsInline
        preload={thumbnailUrl ? 'none' : 'metadata'}
        className="w-full h-full object-contain"
      />

      {/* Mute toggle — top right, visible on hover */}
      {hovering && (
        <button
          onClick={toggleMute}
          className="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-black/60 backdrop-blur-sm text-white/80 hover:text-white hover:bg-black/80 transition-colors"
        >
          {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
        </button>
      )}

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
