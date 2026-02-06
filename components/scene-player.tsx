'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, SkipForward, SkipBack } from 'lucide-react';

interface SceneVideo {
  id: string;
  blob_url: string;
  prompt: string;
  duration: number;
  scene_index: number;
}

interface ScenePlayerProps {
  videos: SceneVideo[];
  autoProgress?: boolean;
}

export function ScenePlayer({ videos, autoProgress: initialAutoProgress = true }: ScenePlayerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [autoProgress, setAutoProgress] = useState(initialAutoProgress);
  const [progress, setProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const preloadRef = useRef<HTMLVideoElement>(null);

  const current = videos[currentIndex];
  const next = videos[currentIndex + 1];

  // Preload next video
  useEffect(() => {
    if (preloadRef.current && next) {
      preloadRef.current.src = next.blob_url;
      preloadRef.current.load();
    }
  }, [next]);

  // Handle video end — auto-progress to next
  const handleEnded = useCallback(() => {
    if (autoProgress && currentIndex < videos.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setProgress(0);
    } else {
      setPlaying(false);
    }
  }, [autoProgress, currentIndex, videos.length]);

  // Auto-play when switching scenes
  useEffect(() => {
    if (videoRef.current && playing) {
      videoRef.current.play().catch(() => {});
    }
  }, [currentIndex, playing]);

  const handleTimeUpdate = useCallback(() => {
    if (!videoRef.current) return;
    const v = videoRef.current;
    // Calculate progress across ALL videos
    const totalDuration = videos.reduce((sum, v) => sum + v.duration, 0);
    const elapsed = videos.slice(0, currentIndex).reduce((sum, v) => sum + v.duration, 0) + v.currentTime;
    setProgress((elapsed / totalDuration) * 100);
  }, [currentIndex, videos]);

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (playing) {
      videoRef.current.pause();
    } else {
      videoRef.current.play().catch(() => {});
    }
    setPlaying(!playing);
  }, [playing]);

  const goToScene = useCallback((index: number) => {
    setCurrentIndex(index);
    setPlaying(true);
  }, []);

  if (videos.length === 0) return null;

  // Calculate segment positions for the progress bar
  const totalDuration = videos.reduce((sum, v) => sum + v.duration, 0);

  return (
    <div className="space-y-4">
      {/* Video player */}
      <div className="relative rounded-xl overflow-hidden bg-black aspect-video group cursor-pointer" onClick={togglePlay}>
        <video
          ref={videoRef}
          key={current.blob_url}
          src={current.blob_url}
          className="w-full h-full object-contain"
          onEnded={handleEnded}
          onTimeUpdate={handleTimeUpdate}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          playsInline
        />

        {/* Play/Pause overlay */}
        <div className={`absolute inset-0 flex items-center justify-center transition-opacity ${playing ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'}`}>
          <div className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center">
            {playing ? (
              <Pause className="h-6 w-6 text-white" />
            ) : (
              <Play className="h-6 w-6 text-white ml-0.5" />
            )}
          </div>
        </div>

        {/* Scene indicator */}
        <div className="absolute top-3 left-3 px-2 py-1 rounded-md bg-black/60 backdrop-blur-sm text-xs font-mono text-white/80">
          Scene {currentIndex + 1} of {videos.length}
        </div>

        {/* Hidden preload element */}
        <video ref={preloadRef} className="hidden" preload="auto" muted />
      </div>

      {/* Segmented progress bar */}
      <div className="flex gap-0.5 h-1 rounded-full overflow-hidden">
        {videos.map((v, i) => {
          const segmentWidth = (v.duration / totalDuration) * 100;
          let segmentProgress = 0;
          if (i < currentIndex) segmentProgress = 100;
          else if (i === currentIndex && videoRef.current) {
            segmentProgress = (videoRef.current.currentTime / v.duration) * 100;
          }
          return (
            <button
              key={v.id}
              onClick={() => goToScene(i)}
              className="relative h-full bg-[#333] cursor-pointer hover:bg-[#444] transition-colors"
              style={{ width: `${segmentWidth}%` }}
            >
              <div
                className="absolute inset-y-0 left-0 bg-white/70 transition-all duration-100"
                style={{ width: `${segmentProgress}%` }}
              />
            </button>
          );
        })}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => currentIndex > 0 && goToScene(currentIndex - 1)}
            disabled={currentIndex === 0}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#888] hover:text-white hover:bg-[#222] transition-colors disabled:opacity-30"
          >
            <SkipBack className="h-4 w-4" />
          </button>
          <button
            onClick={togglePlay}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#888] hover:text-white hover:bg-[#222] transition-colors"
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
          </button>
          <button
            onClick={() => currentIndex < videos.length - 1 && goToScene(currentIndex + 1)}
            disabled={currentIndex === videos.length - 1}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#888] hover:text-white hover:bg-[#222] transition-colors disabled:opacity-30"
          >
            <SkipForward className="h-4 w-4" />
          </button>
        </div>

        <button
          onClick={() => setAutoProgress(!autoProgress)}
          className={`text-xs font-mono px-3 py-1 rounded-md transition-colors ${
            autoProgress ? 'text-[#ededed] bg-[#222]' : 'text-[#555] hover:text-[#888]'
          }`}
        >
          Auto-play {autoProgress ? 'on' : 'off'}
        </button>
      </div>

      {/* Scene thumbnails */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {videos.map((v, i) => (
          <button
            key={v.id}
            onClick={() => goToScene(i)}
            className={`flex-shrink-0 relative rounded-lg overflow-hidden border-2 transition-colors ${
              i === currentIndex ? 'border-white' : 'border-[#333] hover:border-[#555]'
            }`}
            style={{ width: 120, height: 68 }}
          >
            <video
              src={v.blob_url}
              className="w-full h-full object-cover"
              muted
              preload="metadata"
            />
            <div className="absolute bottom-0 left-0 right-0 px-1.5 py-0.5 bg-black/70 text-[10px] font-mono text-white/80">
              Scene {i + 1}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
