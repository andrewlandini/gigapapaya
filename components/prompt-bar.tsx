'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Plus, ArrowUp, ChevronRight, Monitor, Smartphone, Square, Clock, Film, Layers } from 'lucide-react';
import { useGeneration } from './generation-context';
import { useToast } from './toast';

interface PromptBarProps {
  isAuthenticated: boolean;
}

const ORIENTATIONS = [
  { value: '16:9', label: 'Landscape', icon: Monitor },
  { value: '9:16', label: 'Portrait', icon: Smartphone },
  { value: '1:1', label: 'Square', icon: Square },
] as const;

const DURATIONS = [4, 6, 8] as const;

export function PromptBar({ isAuthenticated }: PromptBarProps) {
  const [prompt, setPrompt] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<string>('16:9');
  const [duration, setDuration] = useState<number>(8);
  const settingsRef = useRef<HTMLDivElement>(null);
  const { startGeneration } = useGeneration();
  const { showToast } = useToast();

  // Close settings on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setShowSettings(false);
      }
    }
    if (showSettings) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showSettings]);

  const handleSubmit = () => {
    if (!prompt.trim()) return;
    if (!isAuthenticated) return;

    startGeneration(prompt.trim(), { aspectRatio, duration });
    showToast('Video generation started', 'info');
    setPrompt('');
    setShowSettings(false);
  };

  const orientationLabel = ORIENTATIONS.find(o => o.value === aspectRatio)?.label || 'Landscape';

  if (!isAuthenticated) {
    return (
      <div className="sticky bottom-0 p-4 bg-gradient-to-t from-black via-black/95 to-transparent">
        <div className="max-w-2xl mx-auto">
          <Link
            href="/auth/sign-in"
            className="flex items-center justify-center gap-2 w-full h-12 px-4 rounded-xl border border-[#333] bg-[#0a0a0a] hover:border-[#555] transition-colors"
          >
            <span className="text-sm text-[#555]">Sign in to generate videos</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="sticky bottom-0 p-4 bg-gradient-to-t from-black via-black/95 to-transparent">
      <div className="max-w-2xl mx-auto relative" ref={settingsRef}>
        {/* Settings popover */}
        {showSettings && (
          <div className="absolute bottom-full right-0 mb-2 w-72 rounded-2xl border border-[#333] bg-[#111]/95 backdrop-blur-xl shadow-2xl overflow-hidden animate-fade-in">
            <div className="p-1">
              {/* Model */}
              <div className="flex items-center justify-between px-4 py-3 rounded-xl hover:bg-[#1a1a1a] transition-colors">
                <div className="flex items-center gap-3">
                  <Layers className="h-4 w-4 text-[#888]" />
                  <span className="text-sm text-[#ededed]">Model</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-sm text-[#888]">Veo 3.1</span>
                  <ChevronRight className="h-3.5 w-3.5 text-[#555]" />
                </div>
              </div>

              {/* Orientation */}
              <div className="px-4 py-3 rounded-xl hover:bg-[#1a1a1a] transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <Monitor className="h-4 w-4 text-[#888]" />
                    <span className="text-sm text-[#ededed]">Orientation</span>
                  </div>
                  <span className="text-sm text-[#888]">{orientationLabel}</span>
                </div>
                <div className="flex gap-1">
                  {ORIENTATIONS.map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => setAspectRatio(value)}
                      className={`flex-1 text-xs py-1.5 rounded-lg transition-colors ${
                        aspectRatio === value
                          ? 'bg-white text-black'
                          : 'bg-[#222] text-[#888] hover:bg-[#2a2a2a]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Duration */}
              <div className="px-4 py-3 rounded-xl hover:bg-[#1a1a1a] transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <Clock className="h-4 w-4 text-[#888]" />
                    <span className="text-sm text-[#ededed]">Duration</span>
                  </div>
                  <span className="text-sm text-[#888]">{duration}s</span>
                </div>
                <div className="flex gap-1">
                  {DURATIONS.map((d) => (
                    <button
                      key={d}
                      onClick={() => setDuration(d)}
                      className={`flex-1 text-xs py-1.5 rounded-lg transition-colors ${
                        duration === d
                          ? 'bg-white text-black'
                          : 'bg-[#222] text-[#888] hover:bg-[#2a2a2a]'
                      }`}
                    >
                      {d}s
                    </button>
                  ))}
                </div>
              </div>

              {/* Videos */}
              <div className="flex items-center justify-between px-4 py-3 rounded-xl hover:bg-[#1a1a1a] transition-colors">
                <div className="flex items-center gap-3">
                  <Film className="h-4 w-4 text-[#888]" />
                  <span className="text-sm text-[#ededed]">Videos</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-sm text-[#888]">1 video</span>
                  <ChevronRight className="h-3.5 w-3.5 text-[#555]" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Prompt bar */}
        <div className="rounded-2xl border border-[#333] bg-[#0a0a0a] overflow-hidden">
          {/* Input */}
          <div className="px-4 pt-3 pb-2">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder="Describe your video..."
              className="w-full bg-transparent text-[15px] text-[#ededed] placeholder:text-[#555] focus:outline-none"
            />
          </div>

          {/* Actions row */}
          <div className="flex items-center justify-between px-3 pb-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="h-9 w-9 rounded-xl bg-[#1a1a1a] border border-[#333] flex items-center justify-center text-[#888] hover:text-white hover:border-[#555] transition-colors"
              >
                <Plus className="h-4 w-4" />
              </button>
              <Link
                href="/storyboard"
                className="h-9 px-4 rounded-xl bg-[#1a1a1a] border border-[#333] flex items-center justify-center text-sm text-[#888] hover:text-white hover:border-[#555] transition-colors"
              >
                Storyboard
              </Link>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="h-9 px-3 rounded-xl bg-[#1a1a1a] border border-[#333] flex items-center gap-2 text-sm text-[#888] hover:text-white hover:border-[#555] transition-colors"
              >
                Veo 3.1
              </button>
              <button
                onClick={handleSubmit}
                disabled={!prompt.trim()}
                className="h-9 w-9 rounded-xl bg-white flex items-center justify-center text-black disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#ddd] transition-colors"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
