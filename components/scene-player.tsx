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
  // Two video elements for seamless crossfade
  const videoARef = useRef<HTMLVideoElement>(null);
  const videoBRef = useRef<HTMLVideoElement>(null);
  const [activePlayer, setActivePlayer] = useState<'A' | 'B'>('A');

  const current = videos[currentIndex];
  const next = videos[currentIndex + 1];

  const getActiveRef = useCallback(() => activePlayer === 'A' ? videoARef : videoBRef, [activePlayer]);
  const getInactiveRef = useCallback(() => activePlayer === 'A' ? videoBRef : videoARef, [activePlayer]);

  // Preload next video into the inactive player
  useEffect(() => {
    const inactive = getInactiveRef().current;
    if (inactive && next) {
      inactive.src = next.blob_url;
      inactive.load();
    }
  }, [next, getInactiveRef]);

  // Load current video into the active player on index change
  useEffect(() => {
    const active = getActiveRef().current;
    if (active && current) {
      active.src = current.blob_url;
      active.load();
      if (playing) {
        active.play().catch(() => {});
      }
    }
  }, [currentIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle video end — seamlessly switch to next
  const handleEnded = useCallback(() => {
    if (autoProgress && currentIndex < videos.length - 1) {
      const inactive = getInactiveRef().current;
      if (inactive) {
        // Start the preloaded next video immediately
        inactive.currentTime = 0;
        inactive.play().catch(() => {});
      }
      // Swap active player
      setActivePlayer(prev => prev === 'A' ? 'B' : 'A');
      setCurrentIndex(prev => prev + 1);
      setProgress(0);
    } else {
      setPlaying(false);
    }
  }, [autoProgress, currentIndex, videos.length, getInactiveRef]);

  const handleTimeUpdate = useCallback(() => {
    const active = getActiveRef().current;
    if (!active) return;
    const totalDuration = videos.reduce((sum, v) => sum + v.duration, 0);
    const elapsed = videos.slice(0, currentIndex).reduce((sum, v) => sum + v.duration, 0) + active.currentTime;
    setProgress((elapsed / totalDuration) * 100);
  }, [currentIndex, videos, getActiveRef]);

  const togglePlay = useCallback(() => {
    const active = getActiveRef().current;
    if (!active) return;
    if (playing) {
      active.pause();
    } else {
      active.play().catch(() => {});
    }
    setPlaying(!playing);
  }, [playing, getActiveRef]);

  const goToScene = useCallback((index: number) => {
    const active = getActiveRef().current;
    if (active) {
      active.src = videos[index].blob_url;
      active.load();
      active.play().catch(() => {});
    }
    setCurrentIndex(index);
    setPlaying(true);
  }, [getActiveRef, videos]);

  if (videos.length === 0) return null;

  const totalDuration = videos.reduce((sum, v) => sum + v.duration, 0);
  const activeRef = getActiveRef();

  return (
    <div className="space-y-4">
      {/* Video player — two stacked elements for seamless transitions */}
      <div className="relative rounded-xl overflow-hidden bg-black aspect-video group cursor-pointer" onClick={togglePlay}>
        <video
          ref={videoARef}
          className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-150 ${activePlayer === 'A' ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
          onEnded={activePlayer === 'A' ? handleEnded : undefined}
          onTimeUpdate={activePlayer === 'A' ? handleTimeUpdate : undefined}
          onPlay={activePlayer === 'A' ? () => setPlaying(true) : undefined}
          onPause={activePlayer === 'A' ? () => setPlaying(false) : undefined}
          playsInline
          preload="auto"
        />
        <video
          ref={videoBRef}
          className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-150 ${activePlayer === 'B' ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
          onEnded={activePlayer === 'B' ? handleEnded : undefined}
          onTimeUpdate={activePlayer === 'B' ? handleTimeUpdate : undefined}
          onPlay={activePlayer === 'B' ? () => setPlaying(true) : undefined}
          onPause={activePlayer === 'B' ? () => setPlaying(false) : undefined}
          playsInline
          preload="auto"
        />

        {/* Play/Pause overlay */}
        <div className={`absolute inset-0 flex items-center justify-center transition-opacity z-20 ${playing ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'}`}>
          <div className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center">
            {playing ? (
              <Pause className="h-6 w-6 text-white" />
            ) : (
              <Play className="h-6 w-6 text-white ml-0.5" />
            )}
          </div>
        </div>

        {/* Scene indicator */}
        <div className="absolute top-3 left-3 z-20 px-2 py-1 rounded-md bg-black/60 backdrop-blur-sm text-xs font-mono text-white/80">
          Scene {currentIndex + 1} of {videos.length}
        </div>
      </div>

      {/* Segmented progress bar */}
      <div className="flex gap-0.5 h-1 rounded-full overflow-hidden">
        {videos.map((v, i) => {
          const segmentWidth = (v.duration / totalDuration) * 100;
          let segmentProgress = 0;
          if (i < currentIndex) segmentProgress = 100;
          else if (i === currentIndex && activeRef.current) {
            segmentProgress = (activeRef.current.currentTime / v.duration) * 100;
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
