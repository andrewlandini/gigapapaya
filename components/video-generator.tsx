'use client';

import { useState } from 'react';
import { RotateCcw, Play, X, Trash2, Clock, ChevronDown, Settings2, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ProgressTracker } from './progress-tracker';
import { ScenePreview } from './scene-preview';
import { VideoGallery } from './video-gallery';
import { useStoryboard } from './storyboard-context';
import { TEXT_MODELS } from '@/lib/types';
import { GENERATION_MODES, getModeById } from '@/lib/generation-modes';

export function VideoGenerator() {
  const {
    state, options, setIdea, setOptions,
    updateScenePrompt, handleGenerate, handleGenerateVideos, handleReset,
    isGenerating,
    history, deleteHistoryEntry, clearHistory, loadFromHistory,
  } = useStoryboard();

  const [showAgentSettings, setShowAgentSettings] = useState(false);
  const [selectedModeId, setSelectedModeId] = useState('amplify');

  const currentMode = getModeById(selectedModeId);

  const handleModeGenerate = (modeId: string) => {
    if (!state.idea.trim() || isGenerating) return;
    const mode = getModeById(modeId);
    setSelectedModeId(modeId);

    // Set agent prompts from mode (preserve user model selections)
    setOptions(prev => ({
      ...prev,
      mode: 'agents',
      ideaAgent: {
        model: prev.ideaAgent?.model || 'anthropic/claude-sonnet-4.5',
        prompt: prev.ideaAgent?.prompt && prev.ideaAgent.prompt !== getModeById(selectedModeId).ideaPrompt
          ? prev.ideaAgent.prompt // user has customized — keep it
          : mode.ideaPrompt,
      },
      sceneAgent: {
        model: prev.sceneAgent?.model || 'anthropic/claude-sonnet-4.5',
        prompt: prev.sceneAgent?.prompt && prev.sceneAgent.prompt !== getModeById(selectedModeId).scenePrompt
          ? prev.sceneAgent.prompt
          : mode.scenePrompt,
      },
    }));

    // Trigger generate on next tick after options are set
    setTimeout(() => handleGenerate(), 0);
  };

  const restoreIdeaPrompt = () => {
    setOptions(prev => ({
      ...prev,
      ideaAgent: {
        model: prev.ideaAgent?.model || 'anthropic/claude-sonnet-4.5',
        prompt: currentMode.ideaPrompt,
      },
    }));
  };

  const restoreScenePrompt = () => {
    setOptions(prev => ({
      ...prev,
      sceneAgent: {
        model: prev.sceneAgent?.model || 'anthropic/claude-sonnet-4.5',
        prompt: currentMode.scenePrompt,
      },
    }));
  };

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header */}
      <header className="border-b border-[#222]">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-[15px] font-semibold tracking-tight">gigapapaya</span>
            <span className="text-[#333]">/</span>
            <span className="text-sm text-[#666]">storyboard</span>
          </div>
          <div className="flex items-center gap-3">
            {isGenerating && (
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-[#0070f3] animate-pulse-dot" />
                <span className="text-xs font-mono text-[#666]">generating</span>
              </div>
            )}
            {state.status === 'reviewing' && (
              <Badge variant="blue">review scenes</Badge>
            )}
            {state.status === 'complete' && (
              <Badge variant="success">complete</Badge>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10 flex-1">
        {/* Hero + Input */}
        <div className="max-w-3xl space-y-6">
          <div className="space-y-2">
            <h1 className="text-[32px] font-semibold tracking-tight">Generate videos</h1>
            <p className="text-[#666] text-[15px] leading-relaxed">
              Describe an idea, choose a style. Two AI agents craft the concept and scenes, then Veo 3.1 produces video variations.
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-3">
              <textarea
                placeholder="A frog drinking a cocktail at Martha's Vineyard..."
                value={state.idea}
                onChange={(e) => setIdea(e.target.value)}
                disabled={isGenerating || state.status === 'reviewing'}
                rows={3}
                className="w-full bg-black border border-[#333] rounded-xl px-4 py-3 text-[15px] text-[#ededed] placeholder:text-[#555] focus:outline-none focus:border-[#555] focus:ring-1 focus:ring-white/10 resize-none leading-relaxed"
              />

              {/* Mode buttons */}
              <div className="flex flex-wrap gap-2">
                {GENERATION_MODES.map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => handleModeGenerate(mode.id)}
                    disabled={isGenerating || state.status === 'reviewing' || !state.idea.trim()}
                    className="group flex items-center gap-2 h-10 px-4 rounded-xl border border-[#333] bg-[#0a0a0a] hover:border-[#555] hover:bg-[#111] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <span className="text-base">{mode.icon}</span>
                    <span className="text-sm text-[#ededed]">{mode.label}</span>
                  </button>
                ))}
                {state.status !== 'idle' && (
                  <Button onClick={handleReset} variant="ghost" className="h-10" title="Reset">
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {/* Mode descriptions */}
              <div className="flex flex-wrap gap-x-6 gap-y-1">
                {GENERATION_MODES.map((mode) => (
                  <span key={mode.id} className="text-[11px] text-[#444]">
                    {mode.icon} {mode.description}
                  </span>
                ))}
              </div>
            </div>

            {/* Options */}
            <div className="flex items-center gap-6 flex-wrap">
              <div className="flex items-center gap-2">
                <label className="text-xs font-mono text-[#555]">ratio</label>
                <select
                  value={options.aspectRatio}
                  onChange={(e) => setOptions(prev => ({ ...prev, aspectRatio: e.target.value as any }))}
                  disabled={isGenerating}
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
                  disabled={isGenerating}
                  className="h-8 px-2 rounded-md border border-[#333] bg-black text-xs text-[#888] font-mono"
                >
                  <option value={4}>4s</option>
                  <option value={6}>6s</option>
                  <option value={8}>8s</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs font-mono text-[#555]">scenes</label>
                <select
                  value={options.numScenes}
                  onChange={(e) => setOptions(prev => ({ ...prev, numScenes: parseInt(e.target.value) }))}
                  disabled={isGenerating}
                  className="h-8 px-2 rounded-md border border-[#333] bg-black text-xs text-[#888] font-mono"
                >
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                  <option value={4}>4</option>
                  <option value={5}>5</option>
                </select>
              </div>
            </div>
          </div>

          {/* Agent settings */}
          <div className="border border-[#222] rounded-xl overflow-hidden">
            <button
              onClick={() => setShowAgentSettings(!showAgentSettings)}
              disabled={isGenerating}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#0a0a0a] transition-colors"
            >
              <div className="flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-[#555]" />
                <span className="text-sm text-[#888]">Agent Settings</span>
                <span className="text-xs text-[#444] font-mono">{currentMode.icon} {currentMode.label}</span>
              </div>
              <ChevronDown className={`h-4 w-4 text-[#555] transition-transform ${showAgentSettings ? 'rotate-180' : ''}`} />
            </button>

            {showAgentSettings && (
              <div className="border-t border-[#222] divide-y divide-[#222]">
                {/* Idea Agent */}
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-[#888]">Idea Agent</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={restoreIdeaPrompt}
                        disabled={isGenerating}
                        className="flex items-center gap-1 text-[10px] text-[#555] hover:text-[#888] transition-colors"
                        title="Restore to default for current mode"
                      >
                        <RotateCw className="h-3 w-3" />
                        Restore default
                      </button>
                      <select
                        value={options.ideaAgent?.model || 'anthropic/claude-sonnet-4.5'}
                        onChange={(e) => setOptions(prev => ({
                          ...prev,
                          ideaAgent: { prompt: prev.ideaAgent?.prompt || currentMode.ideaPrompt, model: e.target.value },
                        }))}
                        disabled={isGenerating}
                        className="h-7 px-2 rounded-md border border-[#333] bg-black text-xs text-[#888] font-mono max-w-[200px]"
                      >
                        {TEXT_MODELS.map(m => (
                          <option key={m.id} value={m.id}>{m.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <textarea
                    value={options.ideaAgent?.prompt || currentMode.ideaPrompt}
                    onChange={(e) => setOptions(prev => ({
                      ...prev,
                      ideaAgent: { model: prev.ideaAgent?.model || 'anthropic/claude-sonnet-4.5', prompt: e.target.value },
                    }))}
                    disabled={isGenerating}
                    rows={8}
                    className="w-full bg-[#0a0a0a] border border-[#333] rounded-lg px-3 py-2 text-xs text-[#888] font-mono placeholder:text-[#444] focus:outline-none focus:border-[#555] resize-y leading-relaxed"
                  />
                </div>

                {/* Scene Agent */}
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-[#888]">Scene Agent</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={restoreScenePrompt}
                        disabled={isGenerating}
                        className="flex items-center gap-1 text-[10px] text-[#555] hover:text-[#888] transition-colors"
                        title="Restore to default for current mode"
                      >
                        <RotateCw className="h-3 w-3" />
                        Restore default
                      </button>
                      <select
                        value={options.sceneAgent?.model || 'anthropic/claude-sonnet-4.5'}
                        onChange={(e) => setOptions(prev => ({
                          ...prev,
                          sceneAgent: { prompt: prev.sceneAgent?.prompt || currentMode.scenePrompt, model: e.target.value },
                        }))}
                        disabled={isGenerating}
                        className="h-7 px-2 rounded-md border border-[#333] bg-black text-xs text-[#888] font-mono max-w-[200px]"
                      >
                        {TEXT_MODELS.map(m => (
                          <option key={m.id} value={m.id}>{m.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <textarea
                    value={options.sceneAgent?.prompt || currentMode.scenePrompt}
                    onChange={(e) => setOptions(prev => ({
                      ...prev,
                      sceneAgent: { model: prev.sceneAgent?.model || 'anthropic/claude-sonnet-4.5', prompt: e.target.value },
                    }))}
                    disabled={isGenerating}
                    rows={8}
                    className="w-full bg-[#0a0a0a] border border-[#333] rounded-lg px-3 py-2 text-xs text-[#888] font-mono placeholder:text-[#444] focus:outline-none focus:border-[#555] resize-y leading-relaxed"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Prompt history */}
          {state.status === 'idle' && history.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-[#444]" />
                  <span className="text-xs font-mono text-[#444]">History</span>
                </div>
                <button
                  onClick={clearHistory}
                  className="flex items-center gap-1 text-xs text-[#444] hover:text-[#888] transition-colors"
                >
                  <Trash2 className="h-3 w-3" />
                  Clear all
                </button>
              </div>
              <div className="flex flex-col gap-1">
                {history.slice(0, 8).map((entry) => (
                  <div
                    key={entry.id}
                    className="group flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[#111] transition-colors cursor-pointer"
                    onClick={() => loadFromHistory(entry.prompt)}
                  >
                    <p className="text-sm text-[#666] truncate flex-1 group-hover:text-[#ededed] transition-colors">
                      {entry.prompt}
                    </p>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteHistoryEntry(entry.id); }}
                      className="flex-shrink-0 p-1 rounded text-[#333] hover:text-[#888] opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Concept + Progress */}
        {state.generatedIdea && state.progress.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
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
            <div>
              <ProgressTracker events={state.progress} />
            </div>
          </div>
        )}

        {/* Progress only (no concept yet) */}
        {!state.generatedIdea && state.progress.length > 0 && (
          <div className="max-w-3xl">
            <ProgressTracker events={state.progress} />
          </div>
        )}

        {/* Editable Scenes (review mode) */}
        {state.status === 'reviewing' && state.editableScenes && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-medium text-[#ededed]">Review Scenes</h2>
                <span className="text-xs font-mono text-[#444]">edit prompts before generating</span>
              </div>
              <Button onClick={handleGenerateVideos} className="gap-2">
                <Play className="h-4 w-4" />
                Generate Videos
              </Button>
            </div>

            <div className="grid gap-3">
              {state.editableScenes.map((scene, i) => (
                <div
                  key={i}
                  className="border border-[#222] rounded-xl p-4 space-y-3 hover:border-[#333] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-md bg-[#1a1a1a] border border-[#333] text-[#888] flex items-center justify-center text-xs font-mono">
                      {i + 1}
                    </div>
                    <span className="text-xs font-mono text-[#555]">Scene {i + 1}</span>
                  </div>
                  <textarea
                    value={scene.prompt}
                    onChange={(e) => updateScenePrompt(i, e.target.value)}
                    rows={3}
                    className="w-full bg-[#0a0a0a] border border-[#333] rounded-lg px-3 py-2 text-sm text-[#ccc] placeholder:text-[#555] focus:outline-none focus:border-[#555] focus:ring-1 focus:ring-white/10 resize-none leading-relaxed"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Read-only Scenes (after video gen started) */}
        {state.status !== 'reviewing' && state.scenes && state.scenes.length > 0 && (
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
