'use client';

import { useState } from 'react';
import { Zap, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ProgressTracker } from './progress-tracker';
import { ScenePreview } from './scene-preview';
import { VideoGallery } from './video-gallery';
import type { GenerationState, GenerationOptions, SSEMessage, ProgressEvent } from '@/lib/types';

export function VideoGenerator() {
  const [state, setState] = useState<GenerationState>({
    status: 'idle',
    idea: '',
    generatedIdea: null,
    scenes: null,
    videos: [],
    progress: [],
    error: null,
  });

  const [options, setOptions] = useState<GenerationOptions>({
    aspectRatio: '16:9',
    duration: 8,
    numScenes: 3,
    mode: 'agents',
  });

  const handleGenerate = async () => {
    if (!state.idea.trim()) return;

    console.log('🚀 Starting video generation...');

    setState(prev => ({
      ...prev,
      status: 'generating',
      generatedIdea: null,
      scenes: null,
      videos: [],
      progress: [],
      error: null,
    }));

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea: state.idea, options }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6)) as SSEMessage;
            console.log('📡 SSE:', data.type, data);
            handleSSEEvent(data);
          }
        }
      }
    } catch (error) {
      console.error('❌ Generation failed:', error);
      setState(prev => ({
        ...prev,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        progress: [
          ...prev.progress,
          { type: 'error', timestamp: new Date(), message: error instanceof Error ? error.message : 'Unknown error' },
        ],
      }));
    }
  };

  const handleSSEEvent = (data: SSEMessage) => {
    const progressEvent: ProgressEvent = {
      type: data.type,
      timestamp: new Date(),
      agent: data.agent as any,
      status: data.status,
      result: data.result,
      sceneIndex: data.sceneIndex,
      videoId: data.videoId,
      prompt: data.prompt,
      message: data.message,
    };

    setState(prev => ({
      ...prev,
      progress: [...prev.progress, progressEvent],
    }));

    switch (data.type) {
      case 'agent-complete':
        if (data.agent === 'idea') {
          setState(prev => ({ ...prev, generatedIdea: data.result }));
        } else if (data.agent === 'scenes') {
          setState(prev => ({ ...prev, scenes: data.result.scenes }));
        }
        break;
      case 'complete':
        setState(prev => ({ ...prev, status: 'complete', videos: data.videos || [] }));
        break;
      case 'error':
        setState(prev => ({ ...prev, status: 'error', error: data.message || 'Unknown error' }));
        break;
    }
  };

  const handleReset = () => {
    setState({
      status: 'idle', idea: '', generatedIdea: null,
      scenes: null, videos: [], progress: [], error: null,
    });
  };

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header */}
      <header className="border-b border-[#222]">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-[15px] font-semibold tracking-tight">gigapapaya</span>
            <span className="text-[#333]">/</span>
            <span className="text-sm text-[#666]">generate</span>
          </div>
          <div className="flex items-center gap-3">
            {state.status === 'generating' && (
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-[#0070f3] animate-pulse-dot" />
                <span className="text-xs font-mono text-[#666]">generating</span>
              </div>
            )}
            {state.status === 'complete' && (
              <Badge variant="success">complete</Badge>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        {/* Hero + Input */}
        <div className="max-w-2xl space-y-6">
          <div className="space-y-2">
            <h1 className="text-[32px] font-semibold tracking-tight">Generate videos</h1>
            <p className="text-[#666] text-[15px] leading-relaxed">
              {options.mode === 'agents'
                ? 'Describe an idea. Three AI agents will generate a concept, craft scenes, and produce video variations.'
                : 'Write a prompt. Generate a single video directly with Veo 3.1 — no agents, no frills.'}
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex gap-3">
              <Input
                placeholder="A frog drinking a cocktail at Martha's Vineyard..."
                value={state.idea}
                onChange={(e) => setState(prev => ({ ...prev, idea: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                disabled={state.status === 'generating'}
                className="h-12 text-[15px] bg-black"
              />
              <Button
                onClick={handleGenerate}
                disabled={state.status === 'generating' || !state.idea.trim()}
                className="h-12 px-6"
              >
                <Zap className="h-4 w-4 mr-2" />
                Generate
              </Button>
              {state.status !== 'idle' && (
                <Button onClick={handleReset} variant="ghost" className="h-12" title="Reset">
                  <RotateCcw className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Options */}
            <div className="flex items-center gap-6 flex-wrap">
              <div className="flex items-center gap-2">
                <label className="text-xs font-mono text-[#555]">mode</label>
                <select
                  value={options.mode}
                  onChange={(e) => setOptions(prev => ({ ...prev, mode: e.target.value as any }))}
                  disabled={state.status === 'generating'}
                  className="h-8 px-2 rounded-md border border-[#333] bg-black text-xs text-[#888] font-mono"
                >
                  <option value="agents">agents</option>
                  <option value="direct">direct</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs font-mono text-[#555]">ratio</label>
                <select
                  value={options.aspectRatio}
                  onChange={(e) => setOptions(prev => ({ ...prev, aspectRatio: e.target.value as any }))}
                  disabled={state.status === 'generating'}
                  className="h-8 px-2 rounded-md border border-[#333] bg-black text-xs text-[#888] font-mono"
                >
                  <option value="16:9">16:9</option>
                  <option value="9:16">9:16</option>
                  <option value="4:3">4:3</option>
                  <option value="1:1">1:1</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs font-mono text-[#555]">duration</label>
                <select
                  value={options.duration}
                  onChange={(e) => setOptions(prev => ({ ...prev, duration: parseInt(e.target.value) }))}
                  disabled={state.status === 'generating'}
                  className="h-8 px-2 rounded-md border border-[#333] bg-black text-xs text-[#888] font-mono"
                >
                  <option value={4}>4s</option>
                  <option value={6}>6s</option>
                  <option value={8}>8s</option>
                </select>
              </div>

              {options.mode === 'agents' && (
                <div className="flex items-center gap-2">
                  <label className="text-xs font-mono text-[#555]">scenes</label>
                  <select
                    value={options.numScenes}
                    onChange={(e) => setOptions(prev => ({ ...prev, numScenes: parseInt(e.target.value) }))}
                    disabled={state.status === 'generating'}
                    className="h-8 px-2 rounded-md border border-[#333] bg-black text-xs text-[#888] font-mono"
                  >
                    <option value={2}>2</option>
                    <option value={3}>3</option>
                    <option value={4}>4</option>
                    <option value={5}>5</option>
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Two Column: Concept + Progress */}
        {(state.generatedIdea || state.progress.length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left: Concept */}
            <div className="space-y-6">
              {state.generatedIdea && (
                <div className="space-y-3 animate-fade-in">
                  <h2 className="text-sm font-medium text-[#ededed]">Concept</h2>
                  <div className="border border-[#222] rounded-xl p-5 space-y-3">
                    <h3 className="text-lg font-semibold tracking-tight">{state.generatedIdea.title}</h3>
                    <p className="text-sm text-[#888] leading-relaxed">{state.generatedIdea.description}</p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Badge>{state.generatedIdea.style}</Badge>
                      <Badge>{state.generatedIdea.mood}</Badge>
                      {state.generatedIdea.keyElements.map((el, i) => (
                        <Badge key={i}>{el}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right: Progress */}
            <div>
              <ProgressTracker events={state.progress} />
            </div>
          </div>
        )}

        {/* Scenes */}
        {state.scenes && state.scenes.length > 0 && (
          <ScenePreview
            scenes={state.scenes}
            style={state.generatedIdea?.style}
            mood={state.generatedIdea?.mood}
          />
        )}

        {/* Videos */}
        {state.videos.length > 0 && (
          <VideoGallery videos={state.videos} />
        )}

        {/* Error */}
        {state.error && state.status === 'error' && (
          <div className="border border-[#ff4444]/20 rounded-xl p-5 bg-[#ff4444]/5 animate-fade-in">
            <p className="text-sm text-[#ff4444] font-mono">{state.error}</p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#222] mt-auto">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="text-xs font-mono text-[#333]">gigapapaya</span>
          <span className="text-xs font-mono text-[#333]">veo 3.1 / ai gateway</span>
        </div>
      </footer>
    </div>
  );
}
