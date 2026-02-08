'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Plus, ArrowUp, ArrowLeft, ChevronRight, ChevronUp, Monitor, Smartphone, Square, Clock, Film, Layers } from 'lucide-react';
import { useGeneration } from './generation-context';
import { useToast } from './toast';
import { formatCostWithCredits, estimateQuickGenerateCost } from '@/lib/costs';

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
  const [showPopup, setShowPopup] = useState(false);
  const [popupView, setPopupView] = useState<'settings' | 'models'>('settings');
  const [selectedModel, setSelectedModel] = useState('veo-3.1');
  const [aspectRatio, setAspectRatio] = useState<string>('16:9');
  const [duration, setDuration] = useState<number>(8);
  const popupRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { startGeneration } = useGeneration();
  const { showToast } = useToast();

  // Close popup on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (showPopup && popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setShowPopup(false);
        setPopupView('settings');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPopup]);

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  }, []);

  const togglePopup = () => {
    if (showPopup) {
      setShowPopup(false);
      setPopupView('settings');
    } else {
      setShowPopup(true);
      setPopupView('settings');
    }
  };

  const handleSubmit = () => {
    if (!prompt.trim()) return;
    if (!isAuthenticated) return;

    startGeneration(prompt.trim(), { aspectRatio, duration });
    showToast('Video generation started', 'info');
    setPrompt('');
    setShowPopup(false);
    setPopupView('settings');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const orientationLabel = ORIENTATIONS.find(o => o.value === aspectRatio)?.label || 'Landscape';
  const modelLabel = VIDEO_MODELS.find(m => m.id === selectedModel)?.label || 'Veo 3.1';

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
        {/* Unified popup */}
        {showPopup && (
          <div ref={popupRef} className="absolute bottom-full right-0 mb-2 w-80 rounded-2xl border border-[#333] bg-[#111]/95 backdrop-blur-xl shadow-2xl overflow-hidden animate-fade-in z-10">
            {popupView === 'settings' ? (
              <div className="p-1.5">
                {/* Model */}
                <button
                  onClick={() => setPopupView('models')}
                  className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl hover:bg-[#1a1a1a] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Layers className="h-4.5 w-4.5 text-[#888]" />
                    <span className="text-[15px] text-[#ededed] font-medium">Model</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[15px] text-[#888]">{modelLabel}</span>
                    <ChevronRight className="h-4 w-4 text-[#555]" />
                  </div>
                </button>

                {/* Orientation */}
                <div className="px-4 py-3.5 rounded-xl">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <Monitor className="h-4.5 w-4.5 text-[#888]" />
                      <span className="text-[15px] text-[#ededed] font-medium">Orientation</span>
                    </div>
                    <span className="text-[15px] text-[#888]">{orientationLabel}</span>
                  </div>
                  <div className="flex gap-1.5">
                    {ORIENTATIONS.map(({ value, label }) => (
                      <button
                        key={value}
                        onClick={() => setAspectRatio(value)}
                        className={`flex-1 text-sm py-2 rounded-xl transition-colors ${
                          aspectRatio === value
                            ? 'bg-white text-black font-medium'
                            : 'bg-[#222] text-[#888] hover:bg-[#2a2a2a]'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Duration */}
                <div className="px-4 py-3.5 rounded-xl">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <Clock className="h-4.5 w-4.5 text-[#888]" />
                      <span className="text-[15px] text-[#ededed] font-medium">Duration</span>
                    </div>
                    <span className="text-[15px] text-[#888]">{duration}s</span>
                  </div>
                  <div className="flex gap-1.5">
                    {DURATIONS.map((d) => (
                      <button
                        key={d}
                        onClick={() => setDuration(d)}
                        className={`flex-1 text-sm py-2 rounded-xl transition-colors ${
                          duration === d
                            ? 'bg-white text-black font-medium'
                            : 'bg-[#222] text-[#888] hover:bg-[#2a2a2a]'
                        }`}
                      >
                        {d}s
                      </button>
                    ))}
                  </div>
                </div>

                {/* Videos */}
                <div className="flex items-center justify-between px-4 py-3.5 rounded-xl">
                  <div className="flex items-center gap-3">
                    <Film className="h-4.5 w-4.5 text-[#888]" />
                    <span className="text-[15px] text-[#ededed] font-medium">Videos</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[15px] text-[#888]">1 video</span>
                    <ChevronRight className="h-4 w-4 text-[#555]" />
                  </div>
                </div>
              </div>
            ) : (
              /* Model picker view */
              <div>
                <div className="flex items-center gap-2 px-3 py-3 border-b border-[#222]">
                  <button
                    onClick={() => setPopupView('settings')}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-[#888] hover:text-white hover:bg-[#222] transition-colors"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <span className="text-sm font-medium text-[#ededed]">Model</span>
                </div>
                <div className="p-1.5">
                  {VIDEO_MODELS.map((model) => (
                    <button
                      key={model.id}
                      onClick={() => {
                        if (model.available) {
                          setSelectedModel(model.id);
                          setPopupView('settings');
                        }
                      }}
                      disabled={!model.available}
                      className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-sm transition-colors ${
                        selectedModel === model.id
                          ? 'bg-white text-black font-medium'
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
              rows={2}
              className="w-full bg-transparent text-[15px] text-[#ededed] placeholder:text-[#555] focus:outline-none resize-none overflow-hidden"
              style={{ maxHeight: 200 }}
            />
          </div>

          {/* Actions row */}
          <div className="flex items-center justify-between px-3 pb-3">
            <div className="flex items-center gap-2">
              <button
                onClick={togglePopup}
                className={`h-9 w-9 rounded-xl border flex items-center justify-center transition-colors ${
                  showPopup
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
                onClick={togglePopup}
                className={`h-9 px-3 rounded-xl border flex items-center gap-2 text-sm transition-colors ${
                  showPopup
                    ? 'bg-[#222] border-[#555] text-white'
                    : 'bg-[#1a1a1a] border-[#333] text-[#888] hover:text-white hover:border-[#555]'
                }`}
              >
                {modelLabel}
                <ChevronUp className={`h-3 w-3 transition-transform ${showPopup ? '' : 'rotate-180'}`} />
              </button>
              <span className="text-xs font-mono text-[#FF0000]">
                {formatCostWithCredits(estimateQuickGenerateCost(duration))}
              </span>
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
