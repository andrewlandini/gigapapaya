'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, SkipForward, SkipBack, Scissors } from 'lucide-react';

interface SceneVideo {
  id: string;
  blob_url: string;
  prompt: string;
  duration: number;
  scene_index: number;
  thumbnail_url?: string | null;
}

interface TrimPoints {
  inPoint: number;
  outPoint: number;
}

interface ScenePlayerProps {
  videos: SceneVideo[];
  autoProgress?: boolean;
}

export function ScenePlayer({ videos, autoProgress: initialAutoProgress = true }: ScenePlayerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [autoProgress, setAutoProgress] = useState(initialAutoProgress);
  const [trims, setTrims] = useState<Record<string, TrimPoints>>({});
  const [showTrim, setShowTrim] = useState<string | null>(null);
  const [progressTime, setProgressTime] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const nextVideoRef = useRef<HTMLVideoElement>(null);
  const playingRef = useRef(false);
  const autoProgressRef = useRef(autoProgress);
  const currentIndexRef = useRef(currentIndex);
  const transitioningRef = useRef(false);
  const rafRef = useRef<number>(0);

  autoProgressRef.current = autoProgress;
  currentIndexRef.current = currentIndex;

  const current = videos[currentIndex];
  const next = videos[currentIndex + 1];

  const getTrim = useCallback((video: SceneVideo): TrimPoints => {
    return trims[video.id] || { inPoint: 0, outPoint: video.duration };
  }, [trims]);

  const getEffectiveDuration = useCallback((video: SceneVideo) => {
    const trim = getTrim(video);
    return trim.outPoint - trim.inPoint;
  }, [getTrim]);

  // Smooth progress bar via requestAnimationFrame
  useEffect(() => {
    const tick = () => {
      const v = videoRef.current;
      if (v) setProgressTime(v.currentTime);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // Preload next video
  useEffect(() => {
    if (nextVideoRef.current && next) {
      nextVideoRef.current.src = next.blob_url;
      nextVideoRef.current.load();
    }
  }, [next?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const advanceToNext = useCallback(() => {
    if (transitioningRef.current) return;
    transitioningRef.current = true;

    const nextIdx = currentIndexRef.current + 1;
    const nextTrim = getTrim(videos[nextIdx]);

    setCurrentIndex(nextIdx);
    setPlaying(true);
    playingRef.current = true;

    const el = videoRef.current;
    if (el) {
      el.src = videos[nextIdx].blob_url;
      el.currentTime = nextTrim.inPoint;
      el.play().catch(() => {});
    }

    // Prevent re-triggering for 500ms
    setTimeout(() => { transitioningRef.current = false; }, 500);
  }, [videos, getTrim]);

  // Check trim out-point
  const handleTimeUpdate = useCallback(() => {
    const v = videoRef.current;
    if (!v || transitioningRef.current) return;

    const trim = getTrim(videos[currentIndexRef.current]);

    if (v.currentTime >= trim.outPoint - 0.08) {
      if (autoProgressRef.current && currentIndexRef.current < videos.length - 1) {
        advanceToNext();
      } else {
        v.pause();
        setPlaying(false);
        playingRef.current = false;
      }
    }
  }, [videos, getTrim, advanceToNext]);

  const handleEnded = useCallback(() => {
    if (transitioningRef.current) return;
    if (autoProgressRef.current && currentIndexRef.current < videos.length - 1) {
      advanceToNext();
    } else {
      setPlaying(false);
      playingRef.current = false;
    }
  }, [videos.length, advanceToNext]);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (playingRef.current) {
      v.pause();
      setPlaying(false);
      playingRef.current = false;
    } else {
      const trim = getTrim(videos[currentIndexRef.current]);
      if (v.currentTime >= trim.outPoint - 0.1 || v.currentTime < trim.inPoint) {
        v.currentTime = trim.inPoint;
      }
      v.play().catch(() => {});
      setPlaying(true);
      playingRef.current = true;
    }
  }, [videos, getTrim]);

  const goToScene = useCallback((index: number) => {
    transitioningRef.current = true;
    const trim = getTrim(videos[index]);
    setCurrentIndex(index);
    setPlaying(true);
    playingRef.current = true;
    const v = videoRef.current;
    if (v) {
      v.src = videos[index].blob_url;
      v.currentTime = trim.inPoint;
      v.play().catch(() => {});
    }
    setTimeout(() => { transitioningRef.current = false; }, 500);
  }, [videos, getTrim]);

  // Initial load
  useEffect(() => {
    const v = videoRef.current;
    if (v && current) {
      v.src = current.blob_url;
      const trim = getTrim(current);
      v.currentTime = trim.inPoint;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (videos.length === 0) return null;

  const totalDuration = videos.reduce((sum, v) => sum + getEffectiveDuration(v), 0);
  const currentTrim = getTrim(current);

  return (
    <div className="space-y-4">
      {/* Video player */}
      <div className="relative rounded-xl overflow-hidden bg-black aspect-video group cursor-pointer" onClick={togglePlay}>
        <video
          ref={videoRef}
          className="w-full h-full object-contain"
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded}
          onPlay={() => { setPlaying(true); playingRef.current = true; }}
          onPause={() => { if (!transitioningRef.current) { setPlaying(false); playingRef.current = false; } }}
          playsInline
          preload="auto"
        />

        <video ref={nextVideoRef} className="hidden" preload="auto" muted />

        <div className={`absolute inset-0 flex items-center justify-center transition-opacity z-20 ${playing ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'}`}>
          <div className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center">
            {playing ? <Pause className="h-6 w-6 text-white" /> : <Play className="h-6 w-6 text-white ml-0.5" />}
          </div>
        </div>

        <div className="absolute top-3 left-3 z-20 px-2 py-1 rounded-md bg-black/60 backdrop-blur-sm text-xs font-mono text-white/80">
          Shot {currentIndex + 1} of {videos.length}
        </div>
      </div>

      {/* Segmented progress bar — smooth */}
      <div className="flex gap-0.5 h-1 rounded-full overflow-hidden">
        {videos.map((v, i) => {
          const effDuration = getEffectiveDuration(v);
          const segmentWidth = (effDuration / totalDuration) * 100;
          const trim = getTrim(v);
          let segmentProgress = 0;
          if (i < currentIndex) segmentProgress = 100;
          else if (i === currentIndex) {
            const elapsed = Math.max(0, progressTime - trim.inPoint);
            segmentProgress = Math.min(100, (elapsed / effDuration) * 100);
          }
          return (
            <button
              key={v.id}
              onClick={() => goToScene(i)}
              className="relative h-full bg-[#333] cursor-pointer hover:bg-[#444] transition-colors"
              style={{ width: `${segmentWidth}%` }}
            >
              <div
                className="absolute inset-y-0 left-0 bg-white/70"
                style={{ width: `${segmentProgress}%`, transition: 'width 0.15s linear' }}
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

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTrim(showTrim === current.id ? null : current.id)}
            className={`flex items-center gap-1.5 text-xs font-mono px-3 py-1 rounded-md transition-colors ${
              showTrim === current.id ? 'text-[#ededed] bg-[#222]' : 'text-[#555] hover:text-[#888]'
            }`}
          >
            <Scissors className="h-3 w-3" />
            Trim
          </button>
          <button
            onClick={() => setAutoProgress(!autoProgress)}
            className={`text-xs font-mono px-3 py-1 rounded-md transition-colors ${
              autoProgress ? 'text-[#ededed] bg-[#222]' : 'text-[#555] hover:text-[#888]'
            }`}
          >
            Auto-play {autoProgress ? 'on' : 'off'}
          </button>
        </div>
      </div>

      {/* Trim controls */}
      {showTrim === current.id && (
        <div className="border border-[#222] rounded-xl p-4 space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-[#888]">Trim Shot {currentIndex + 1}</span>
            {(currentTrim.inPoint > 0 || currentTrim.outPoint < current.duration) && (
              <button
                onClick={() => setTrims(prev => {
                  const n = { ...prev };
                  delete n[current.id];
                  return n;
                })}
                className="text-[10px] text-[#555] hover:text-[#888] transition-colors"
              >
                Reset trim
              </button>
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="flex-1 space-y-1">
              <label className="text-[10px] font-mono text-[#555]">In: {currentTrim.inPoint.toFixed(1)}s</label>
              <input
                type="range"
                name="trimInPoint"
                min={0}
                max={current.duration}
                step={0.1}
                value={currentTrim.inPoint}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  const newIn = Math.min(val, getTrim(current).outPoint - 0.5);
                  setTrims(prev => ({
                    ...prev,
                    [current.id]: { ...getTrim(current), inPoint: newIn },
                  }));
                  if (videoRef.current) videoRef.current.currentTime = newIn;
                }}
                className="w-full accent-white h-1"
              />
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-[10px] font-mono text-[#555]">Out: {currentTrim.outPoint.toFixed(1)}s</label>
              <input
                type="range"
                name="trimOutPoint"
                min={0}
                max={current.duration}
                step={0.1}
                value={currentTrim.outPoint}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  const newOut = Math.max(val, getTrim(current).inPoint + 0.5);
                  setTrims(prev => ({
                    ...prev,
                    [current.id]: { ...getTrim(current), outPoint: newOut },
                  }));
                  if (videoRef.current) videoRef.current.currentTime = Math.max(newOut - 0.5, getTrim(current).inPoint);
                }}
                className="w-full accent-white h-1"
              />
            </div>
            <span className="text-xs font-mono text-[#444] whitespace-nowrap">
              {getEffectiveDuration(current).toFixed(1)}s
            </span>
          </div>
        </div>
      )}

      {/* Scene thumbnails */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {videos.map((v, i) => {
          const trim = getTrim(v);
          const isTrimmed = trim.inPoint > 0 || trim.outPoint < v.duration;
          return (
            <button
              key={v.id}
              onClick={() => goToScene(i)}
              className={`flex-shrink-0 relative rounded-lg overflow-hidden border-2 transition-colors ${
                i === currentIndex ? 'border-white' : 'border-[#333] hover:border-[#555]'
              }`}
              style={{ width: 120, height: 68 }}
            >
              {v.thumbnail_url ? (
                <img src={v.thumbnail_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <video
                  src={v.blob_url}
                  className="w-full h-full object-cover"
                  muted
                  preload="metadata"
                />
              )}
              <div className="absolute bottom-0 left-0 right-0 px-1.5 py-0.5 bg-black/70 flex items-center justify-between">
                <span className="text-[10px] font-mono text-white/80">Shot {i + 1}</span>
                {isTrimmed && <Scissors className="h-2.5 w-2.5 text-white/50" />}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
