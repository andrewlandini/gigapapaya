'use client';

import { useState, useMemo } from 'react';
import { RotateCcw, Play, X, Clock, ChevronDown, Settings2, RotateCw } from 'lucide-react';

const HEADLINES = [
  "What should we cook, chef?",
  "Let's make movie magic.",
  "You got something good?",
  "What's the vision?",
  "Paint me a picture.",
  "Show me what you see.",
  "Let's build a world.",
  "What story are we telling?",
  "Ready to roll?",
  "Hit me with your best shot.",
  "What are we dreaming up?",
  "Let's make something weird.",
  "Lights, camera...",
  "The stage is yours.",
  "What's on your mind?",
  "Bring the chaos.",
  "Time to create.",
  "What's the vibe today?",
  "Drop the concept.",
  "Let's get cinematic.",
  "Surprise me.",
  "What world do we enter?",
  "Give me the pitch.",
];
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ProgressTracker } from './progress-tracker';
import { ScenePreview } from './scene-preview';
import { VideoGallery } from './video-gallery';
import { useStoryboard } from './storyboard-context';
import { IdeaWizard } from './idea-wizard';
import { TEXT_MODELS } from '@/lib/types';
import { GENERATION_MODES, getModeById } from '@/lib/generation-modes';

export function VideoGenerator() {
  const {
    state, options, setIdea, setOptions,
    updateScenePrompt, startModeGeneration, handleGenerateVideos, handleReset,
    isGenerating,
    customPrompts, updateModeCustomization, restoreModeDefault,
    history, deleteHistoryEntry, loadFromHistory,
  } = useStoryboard();

  const [showAgentSettings, setShowAgentSettings] = useState(false);
  const [wizardActive, setWizardActive] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [settingsTab, setSettingsTab] = useState('amplify');
  const headline = useMemo(() => HEADLINES[Math.floor(Math.random() * HEADLINES.length)], []);

  const settingsMode = getModeById(settingsTab);

  // Get effective values (custom or default) for the settings tab
  const custom = customPrompts[settingsTab] || {};
  const ideaModel = custom.ideaModel || 'anthropic/claude-sonnet-4.5';
  const ideaPrompt = custom.ideaPrompt || settingsMode.ideaPrompt;
  const sceneModel = custom.sceneModel || 'anthropic/claude-sonnet-4.5';
  const scenePrompt = custom.scenePrompt || settingsMode.scenePrompt;

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
          <div className="flex items-center gap-4 pr-12">
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
            <button
              onClick={() => setShowAgentSettings(true)}
              className="flex items-center gap-1.5 text-xs font-mono text-[#555] hover:text-[#888] transition-colors"
            >
              <Settings2 className="h-3.5 w-3.5" />
              Agents
            </button>
            {history.length > 0 && (
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="flex items-center gap-1.5 text-xs font-mono text-[#555] hover:text-[#888] transition-colors"
              >
                <Clock className="h-3.5 w-3.5" />
                History
              </button>
            )}
          </div>
        </div>
      </header>

      {/* History sidebar */}
      {showHistory && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setShowHistory(false)} />
          <div className="fixed top-0 right-0 z-50 h-full w-80 bg-[#111] border-l border-[#222] shadow-2xl flex flex-col animate-fade-in">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#222]">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-[#888]" />
                <span className="text-sm font-medium text-[#ededed]">History</span>
              </div>
              <button
                onClick={() => setShowHistory(false)}
                className="p-1 rounded-lg text-[#555] hover:text-white hover:bg-[#222] transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {history.map((entry) => (
                <div
                  key={entry.id}
                  className="group flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-[#1a1a1a] transition-colors cursor-pointer"
                  onClick={() => { loadFromHistory(entry.prompt); setShowHistory(false); }}
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
        </>
      )}

      <main className="max-w-6xl mx-auto px-6 pt-16 pb-10 space-y-10 flex-1">
        {/* Hero + Input */}
        <div className="max-w-3xl mx-auto space-y-8 text-center">
          <h1 className="text-[40px] font-bold tracking-tight leading-tight">{headline}</h1>
          <IdeaWizard onSelectIdea={(idea) => setIdea(idea)} onActiveChange={setWizardActive} />

          {!wizardActive && (
            <div className="space-y-5">
              {/* Unified input box */}
              <div className="border border-[#333] rounded-2xl bg-[#0a0a0a] focus-within:border-[#555] focus-within:ring-1 focus-within:ring-white/10 transition-all">
                <textarea
                  placeholder="A frog drinking a cocktail at Martha's Vineyard..."
                  value={state.idea}
                  onChange={(e) => setIdea(e.target.value)}
                  disabled={isGenerating || state.status === 'reviewing'}
                  rows={3}
                  className="w-full bg-transparent px-5 pt-4 pb-2 text-[15px] text-[#ededed] placeholder:text-[#555] focus:outline-none resize-none leading-relaxed"
                />
                <div className="flex items-center gap-4 px-4 pb-3">
                  <div className="flex items-center gap-1.5">
                    <label className="text-[11px] font-mono text-[#444]">ratio</label>
                    <select
                      value={options.aspectRatio}
                      onChange={(e) => setOptions(prev => ({ ...prev, aspectRatio: e.target.value as any }))}
                      disabled={isGenerating}
                      className="h-7 px-1.5 rounded-md bg-transparent text-xs text-[#888] font-mono focus:outline-none cursor-pointer hover:text-[#ededed] transition-colors"
                    >
                      <option value="16:9">16:9</option>
                      <option value="9:16">9:16</option>
                      <option value="4:3">4:3</option>
                      <option value="1:1">1:1</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <label className="text-[11px] font-mono text-[#444]">duration</label>
                    <select
                      value={options.duration}
                      onChange={(e) => setOptions(prev => ({ ...prev, duration: parseInt(e.target.value) }))}
                      disabled={isGenerating}
                      className="h-7 px-1.5 rounded-md bg-transparent text-xs text-[#888] font-mono focus:outline-none cursor-pointer hover:text-[#ededed] transition-colors"
                    >
                      <option value={4}>4s</option>
                      <option value={6}>6s</option>
                      <option value={8}>8s</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <label className="text-[11px] font-mono text-[#444]">scenes</label>
                    <select
                      value={options.numScenes}
                      onChange={(e) => setOptions(prev => ({ ...prev, numScenes: parseInt(e.target.value) }))}
                      disabled={isGenerating}
                      className="h-7 px-1.5 rounded-md bg-transparent text-xs text-[#888] font-mono focus:outline-none cursor-pointer hover:text-[#ededed] transition-colors"
                    >
                      <option value={2}>2</option>
                      <option value={3}>3</option>
                      <option value={4}>4</option>
                      <option value={5}>5</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Mode buttons */}
              <div className="flex flex-wrap gap-3 justify-center">
                {GENERATION_MODES.map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => startModeGeneration(mode.id)}
                    disabled={isGenerating || state.status === 'reviewing' || !state.idea.trim()}
                    className="group flex items-center gap-2 h-11 px-5 rounded-full border border-[#333] bg-[#0a0a0a] hover:border-[#555] hover:bg-[#111] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
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
            </div>
          )}

          {/* Agent settings modal */}
          {showAgentSettings && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowAgentSettings(false)} />
              <div className="relative bg-[#111] border border-[#333] rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
                {/* Modal header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-[#222]">
                  <div className="flex items-center gap-2">
                    <Settings2 className="h-4 w-4 text-[#888]" />
                    <span className="text-sm font-medium text-[#ededed]">Agent Settings</span>
                  </div>
                  <button
                    onClick={() => setShowAgentSettings(false)}
                    className="p-1 rounded-lg text-[#555] hover:text-white hover:bg-[#222] transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Mode tabs */}
                <div className="flex border-b border-[#222] overflow-x-auto px-2">
                  {GENERATION_MODES.map((mode) => {
                    const hasCustom = customPrompts[mode.id] && (
                      customPrompts[mode.id].ideaPrompt || customPrompts[mode.id].scenePrompt ||
                      customPrompts[mode.id].ideaModel || customPrompts[mode.id].sceneModel
                    );
                    return (
                      <button
                        key={mode.id}
                        onClick={() => setSettingsTab(mode.id)}
                        className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                          settingsTab === mode.id
                            ? 'border-white text-white'
                            : 'border-transparent text-[#555] hover:text-[#888]'
                        }`}
                      >
                        <span>{mode.icon}</span>
                        <span>{mode.label}</span>
                        {hasCustom && <span className="w-1.5 h-1.5 rounded-full bg-[#0070f3]" />}
                      </button>
                    );
                  })}
                </div>

                {/* Scrollable content */}
                <div className="flex-1 overflow-y-auto divide-y divide-[#222]">
                  {/* Concept Agent */}
                  <div className="p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-[#888]">Concept Agent</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => restoreModeDefault(settingsTab, 'idea')}
                          className="flex items-center gap-1 text-[10px] text-[#555] hover:text-[#888] transition-colors"
                        >
                          <RotateCw className="h-3 w-3" />
                          Restore default
                        </button>
                        <select
                          value={ideaModel}
                          onChange={(e) => updateModeCustomization(settingsTab, 'ideaModel', e.target.value)}
                          className="h-7 px-2 rounded-md border border-[#333] bg-black text-xs text-[#888] font-mono max-w-[200px]"
                        >
                          {TEXT_MODELS.map(m => (
                            <option key={m.id} value={m.id}>{m.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <textarea
                      value={ideaPrompt}
                      onChange={(e) => updateModeCustomization(settingsTab, 'ideaPrompt', e.target.value)}
                      rows={8}
                      className="w-full bg-[#0a0a0a] border border-[#333] rounded-lg px-3 py-2 text-xs text-[#888] font-mono placeholder:text-[#444] focus:outline-none focus:border-[#555] resize-y leading-relaxed"
                    />
                  </div>

                  {/* Scene Agent */}
                  <div className="p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-[#888]">Scene Agent</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => restoreModeDefault(settingsTab, 'scene')}
                          className="flex items-center gap-1 text-[10px] text-[#555] hover:text-[#888] transition-colors"
                        >
                          <RotateCw className="h-3 w-3" />
                          Restore default
                        </button>
                        <select
                          value={sceneModel}
                          onChange={(e) => updateModeCustomization(settingsTab, 'sceneModel', e.target.value)}
                          className="h-7 px-2 rounded-md border border-[#333] bg-black text-xs text-[#888] font-mono max-w-[200px]"
                        >
                          {TEXT_MODELS.map(m => (
                            <option key={m.id} value={m.id}>{m.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <textarea
                      value={scenePrompt}
                      onChange={(e) => updateModeCustomization(settingsTab, 'scenePrompt', e.target.value)}
                      rows={8}
                      className="w-full bg-[#0a0a0a] border border-[#333] rounded-lg px-3 py-2 text-xs text-[#888] font-mono placeholder:text-[#444] focus:outline-none focus:border-[#555] resize-y leading-relaxed"
                    />
                  </div>
                </div>
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
