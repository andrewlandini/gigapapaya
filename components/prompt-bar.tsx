'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Plus, ArrowUp, ChevronRight, ChevronUp, Monitor, Smartphone, Square, Clock, Film, Layers } from 'lucide-react';
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

const VIDEO_MODELS = [
  { id: 'veo-3.1', label: 'Veo 3.1', available: true },
  { id: 'sonnet-5', label: 'Sonnet 5', available: true },
  { id: 'sora-2-pro', label: 'Sora 2 Pro', available: false },
  { id: 'runway-gen4', label: 'Runway Gen-4', available: false },
  { id: 'kling-2.1', label: 'Kling 2.1', available: false },
  { id: 'minimax-video-01', label: 'MiniMax Video-01', available: false },
  { id: 'pika-2.2', label: 'Pika 2.2', available: false },
  { id: 'luma-ray-3', label: 'Luma Ray 3', available: false },
] as const;

export function PromptBar({ isAuthenticated }: PromptBarProps) {
  const [prompt, setPrompt] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [selectedModel, setSelectedModel] = useState('veo-3.1');
  const [aspectRatio, setAspectRatio] = useState<string>('16:9');
  const [duration, setDuration] = useState<number>(8);
  const settingsRef = useRef<HTMLDivElement>(null);
  const modelRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { startGeneration } = useGeneration();
  const { showToast } = useToast();

  // Close popups on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (showSettings && settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setShowSettings(false);
      }
      if (showModelPicker && modelRef.current && !modelRef.current.contains(e.target as Node)) {
        setShowModelPicker(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSettings, showModelPicker]);

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  }, []);

  const handleSubmit = () => {
    if (!prompt.trim()) return;
    if (!isAuthenticated) return;

    startGeneration(prompt.trim(), { aspectRatio, duration });
    showToast('Video generation started', 'info');
    setPrompt('');
    setShowSettings(false);
    setShowModelPicker(false);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
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
      <div className="max-w-2xl mx-auto relative">
        {/* Settings popover — anchored to + button */}
        {showSettings && (
          <div ref={settingsRef} className="absolute bottom-full left-0 mb-2 w-72 rounded-2xl border border-[#333] bg-[#111]/95 backdrop-blur-xl shadow-2xl overflow-hidden animate-fade-in z-10">
            <div className="p-1">
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
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Model picker — anchored to model button */}
        {showModelPicker && (
          <div ref={modelRef} className="absolute bottom-full right-0 mb-2 w-52 rounded-xl border border-[#333] bg-[#111]/95 backdrop-blur-xl shadow-2xl overflow-hidden animate-fade-in z-10">
            <div className="p-1">
              {VIDEO_MODELS.map((model) => (
                <button
                  key={model.id}
                  onClick={() => {
                    if (model.available) {
                      setSelectedModel(model.id);
                      setShowModelPicker(false);
                    }
                  }}
                  disabled={!model.available}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                    selectedModel === model.id
                      ? 'bg-white text-black'
                      : model.available
                        ? 'text-[#ededed] hover:bg-[#1a1a1a]'
                        : 'text-[#444] cursor-default'
                  }`}
                >
                  <span>{model.label}</span>
                  {!model.available && (
                    <span className="text-[10px] font-mono text-[#444]">coming soon</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Prompt bar */}
        <div className="rounded-2xl border border-[#333] bg-[#0a0a0a] overflow-hidden">
          {/* Input */}
          <div className="px-4 pt-3 pb-2">
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => { setPrompt(e.target.value); autoResize(); }}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
              placeholder="Describe your video..."
              rows={1}
              className="w-full bg-transparent text-[15px] text-[#ededed] placeholder:text-[#555] focus:outline-none resize-none overflow-hidden"
              style={{ maxHeight: 200 }}
            />
          </div>

          {/* Actions row */}
          <div className="flex items-center justify-between px-3 pb-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setShowSettings(!showSettings); setShowModelPicker(false); }}
                className={`h-9 w-9 rounded-xl border flex items-center justify-center transition-colors ${
                  showSettings
                    ? 'bg-white text-black border-white'
                    : 'bg-[#1a1a1a] border-[#333] text-[#888] hover:text-white hover:border-[#555]'
                }`}
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
                onClick={() => { setShowModelPicker(!showModelPicker); setShowSettings(false); }}
                className={`h-9 px-3 rounded-xl border flex items-center gap-2 text-sm transition-colors ${
                  showModelPicker
                    ? 'bg-[#222] border-[#555] text-white'
                    : 'bg-[#1a1a1a] border-[#333] text-[#888] hover:text-white hover:border-[#555]'
                }`}
              >
                {VIDEO_MODELS.find(m => m.id === selectedModel)?.label}
                <ChevronUp className={`h-3 w-3 transition-transform ${showModelPicker ? '' : 'rotate-180'}`} />
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
