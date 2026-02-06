'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { RotateCcw, Play, X, Clock, ChevronDown, Settings2, RotateCw, AlertCircle, Loader2 } from 'lucide-react';

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

// Headlines mapped to each phase of the generation process
const PHASE_HEADLINES: Record<string, string[]> = {
  idea: ["Writing your concept.", "Crafting the story.", "Building the world.", "Finding the angle."],
  scenes: ["Breaking it into shots.", "Blocking the shots.", "Mapping the sequence.", "Setting up each shot."],
  reviewing: ["Your scenes are ready.", "Review and edit.", "Make it yours.", "Check the shots."],
  video: ["Generating video", "Rendering scene", "Camera is rolling", "Bringing it to life", "Processing scene", "Building the shot", "Rendering the take", "Assembling the clip"],
  complete: ["That's a wrap.", "All done.", "Picture's up.", "And... cut."],
};

function pickRandom(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}
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
    state, options, sessionId, setIdea, setOptions,
    updateScenePrompt, removeScene, startModeGeneration, handleGenerateVideos, handleReset, clearGeneration,
    isGenerating,
    rerunShot, rerunningShots,
    customPrompts, updateModeCustomization, restoreModeDefault,
    history, deleteHistoryEntry, loadFromHistory,
  } = useStoryboard();

  const [showAgentSettings, setShowAgentSettings] = useState(false);
  const [wizardActive, setWizardActive] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [settingsTab, setSettingsTab] = useState('amplify');
  const [generatingHeadline, setGeneratingHeadline] = useState('');
  const [headlineFade, setHeadlineFade] = useState(true);
  const lastPhaseRef = useRef('');
  const headline = useMemo(() => HEADLINES[Math.floor(Math.random() * HEADLINES.length)], []);

  const settingsMode = getModeById(settingsTab);
  const isActive = state.status !== 'idle';

  // Derive headline from current agent phase
  useEffect(() => {
    if (!isActive) {
      lastPhaseRef.current = '';
      return;
    }

    // Determine current phase from progress events and status
    let phase = 'idea';
    let videoNum = 0;

    if (state.status === 'reviewing') {
      phase = 'reviewing';
    } else if (state.status === 'complete') {
      phase = 'complete';
    } else {
      for (const event of state.progress) {
        if (event.type === 'agent-start' && event.agent === 'idea') phase = 'idea';
        if (event.type === 'agent-start' && event.agent === 'scenes') phase = 'scenes';
        if (event.type === 'video-start') { phase = 'video'; videoNum = (event.sceneIndex ?? 0) + 1; }
      }
    }

    const phaseKey = `${phase}-${videoNum}`;
    if (phaseKey === lastPhaseRef.current) return;
    lastPhaseRef.current = phaseKey;

    // Fade out, swap, fade in
    setHeadlineFade(false);
    setTimeout(() => {
      const headlines = PHASE_HEADLINES[phase] || PHASE_HEADLINES.idea;
      let text = pickRandom(headlines);
      if (phase === 'video' && videoNum > 0) text = `${text} ${videoNum}.`;
      setGeneratingHeadline(text);
      setHeadlineFade(true);
    }, 600);
  }, [isActive, state.progress, state.status]);

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
              <Badge variant="blue">review shots</Badge>
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
          {!wizardActive && (
            <h1 className={`text-[40px] font-bold tracking-tight leading-tight transition-opacity duration-700 ease-in-out ${isActive ? (headlineFade ? 'opacity-100' : 'opacity-0') : 'animate-fade-in'}`}>{isActive && generatingHeadline ? generatingHeadline : headline}</h1>
          )}

          {/* Input & mode buttons — hidden when generating/reviewing/complete */}
          {!wizardActive && !isActive && (
            <div className="space-y-5 animate-fade-in">
              {/* Unified input box */}
              <div className="border border-[#333] rounded-2xl bg-[#0a0a0a] focus-within:border-[#555] focus-within:ring-1 focus-within:ring-white/10 transition-all">
                <textarea
                  placeholder="A frog drinking a cocktail at Martha's Vineyard..."
                  value={state.idea}
                  onChange={(e) => setIdea(e.target.value)}
                  rows={6}
                  className="w-full bg-transparent px-5 pt-4 pb-2 text-[15px] text-[#ededed] placeholder:text-[#555] focus:outline-none resize-none leading-relaxed"
                />
                <div className="flex items-center gap-4 px-4 pb-3">
                  <div className="flex items-center gap-1.5">
                    <label className="text-[11px] font-mono text-[#444]">ratio</label>
                    <select
                      value={options.aspectRatio}
                      onChange={(e) => setOptions(prev => ({ ...prev, aspectRatio: e.target.value as any }))}
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
                      onChange={(e) => {
                        const val = e.target.value;
                        setOptions(prev => ({
                          ...prev,
                          duration: val === 'auto' ? 'auto' : parseInt(val),
                          totalLength: val === 'auto' ? prev.totalLength : undefined,
                          numScenes: val === 'auto' ? undefined : (prev.numScenes || 3),
                        }));
                      }}
                      className="h-7 px-1.5 rounded-md bg-transparent text-xs text-[#888] font-mono focus:outline-none cursor-pointer hover:text-[#ededed] transition-colors"
                    >
                      <option value={4}>4s</option>
                      <option value={6}>6s</option>
                      <option value={8}>8s</option>
                      <option value="auto">auto</option>
                    </select>
                  </div>
                  {options.duration === 'auto' && (
                    <div className="flex items-center gap-1.5">
                      <label className="text-[11px] font-mono text-[#444]">length</label>
                      <select
                        value={options.totalLength || 'auto'}
                        onChange={(e) => {
                          const val = e.target.value;
                          setOptions(prev => ({ ...prev, totalLength: val === 'auto' ? undefined : parseInt(val) }));
                        }}
                        className="h-7 px-1.5 rounded-md bg-transparent text-xs text-[#888] font-mono focus:outline-none cursor-pointer hover:text-[#ededed] transition-colors"
                      >
                        <option value={15}>15s</option>
                        <option value={30}>30s</option>
                        <option value={45}>45s</option>
                        <option value={60}>60s</option>
                        <option value="auto">auto</option>
                      </select>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <label className="text-[11px] font-mono text-[#444]">shots</label>
                    <select
                      value={options.numScenes || 'auto'}
                      onChange={(e) => {
                        const val = e.target.value;
                        setOptions(prev => ({ ...prev, numScenes: val === 'auto' ? undefined : parseInt(val) }));
                      }}
                      className="h-7 px-1.5 rounded-md bg-transparent text-xs text-[#888] font-mono focus:outline-none cursor-pointer hover:text-[#ededed] transition-colors"
                    >
                      <option value="auto">auto</option>
                      <option value={2}>2</option>
                      <option value={3}>3</option>
                      <option value={4}>4</option>
                      <option value={5}>5</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-1.5 ml-auto">
                    <label className="text-[11px] font-mono text-[#444]">music</label>
                    <button
                      onClick={() => setOptions(prev => ({ ...prev, noMusic: !prev.noMusic }))}
                      className={`h-7 px-2 rounded-md text-xs font-mono transition-colors ${options.noMusic ? 'text-[#ff4444]' : 'text-[#888] hover:text-[#ededed]'}`}
                    >
                      {options.noMusic ? 'off' : 'on'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Mode buttons */}
              <div className="flex flex-wrap gap-3 justify-center">
                {GENERATION_MODES.map((mode) => {
                  const noIdea = !state.idea.trim();
                  return (
                    <div key={mode.id} className="relative group">
                      <button
                        onClick={() => { if (!noIdea) { setGeneratingHeadline(pickRandom(PHASE_HEADLINES.idea)); setHeadlineFade(true); lastPhaseRef.current = ''; startModeGeneration(mode.id); } }}
                        className={`flex items-center gap-2 h-11 px-5 rounded-full border border-[#333] bg-[#0a0a0a] transition-all ${noIdea ? 'opacity-30' : 'hover:border-[#555] hover:bg-[#111] cursor-pointer'}`}
                      >
                        <span className="text-base">{mode.icon}</span>
                        <span className="text-sm text-[#ededed]">{mode.label}</span>
                      </button>
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 rounded-lg bg-[#222] border border-[#333] text-xs text-[#ccc] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        {mode.description}
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          )}

          {/* Progress tracker — shown under title when active */}
          {state.progress.length > 0 && (
            <div className="max-w-3xl mx-auto">
              <ProgressTracker events={state.progress} />
            </div>
          )}

          {/* Start over button — shown whenever generation is active */}
          {isActive && (
            <button
              onClick={handleReset}
              className="flex items-center gap-2 mx-auto text-sm text-[#555] hover:text-[#ededed] transition-colors animate-fade-in"
            >
              <RotateCcw className="h-4 w-4" />
              Start over
            </button>
          )}

          {!isActive && (
            <div className={wizardActive ? '' : 'pt-4'}>
              <IdeaWizard onSelectIdea={(idea) => setIdea(idea)} onActiveChange={(active) => { setWizardActive(active); if (active) clearGeneration(); }} />
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

        {/* Editable Scenes (review mode) */}
        {state.status === 'reviewing' && state.editableScenes && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-[#ededed]">Review Shots</h2>
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
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-md bg-[#1a1a1a] border border-[#333] text-[#888] flex items-center justify-center text-xs font-mono">
                        {i + 1}
                      </div>
                      <span className="text-xs font-mono text-[#555]">Shot {i + 1}</span>
                      <span className="text-xs font-mono text-[#444]">{scene.duration}s</span>
                    </div>
                    {state.editableScenes!.length > 1 && (
                      <button
                        onClick={() => removeScene(i)}
                        className="p-1 rounded-md text-[#444] hover:text-[#ff4444] hover:bg-[#1a1a1a] transition-colors"
                        title="Remove shot"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <textarea
                    value={scene.prompt}
                    onChange={(e) => updateScenePrompt(i, e.target.value)}
                    className="w-full bg-[#0a0a0a] border border-[#333] rounded-lg px-3 py-2 text-sm text-[#ccc] placeholder:text-[#555] focus:outline-none focus:border-[#555] focus:ring-1 focus:ring-white/10 resize-y leading-relaxed"
                    style={{ fieldSizing: 'content' as any, minHeight: '4rem' }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Videos */}
        {state.videos.length > 0 && (
          <VideoGallery videos={state.videos} sessionId={sessionId} onRerunShot={rerunShot} rerunningShots={rerunningShots} />
        )}

        {/* Failed shots — editable prompts with re-run */}
        {state.failedShots.size > 0 && state.editableScenes && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-4 w-4 text-[#ff4444]" />
              <h2 className="text-sm font-medium text-[#ededed]">Failed Shots</h2>
              <span className="text-xs font-mono text-[#555]">{state.failedShots.size} failed — edit prompt and re-run</span>
            </div>
            <div className="grid gap-3">
              {Array.from(state.failedShots).sort().map(idx => {
                const scene = state.editableScenes![idx];
                if (!scene) return null;
                const isRerunning = rerunningShots.has(idx);
                return (
                  <div
                    key={idx}
                    className="border border-[#ff4444]/20 rounded-xl p-4 space-y-3 bg-[#ff4444]/5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex-shrink-0 w-6 h-6 rounded-md bg-[#1a1a1a] border border-[#ff4444]/30 text-[#ff4444] flex items-center justify-center text-xs font-mono">
                          {idx + 1}
                        </div>
                        <span className="text-xs font-mono text-[#ff4444]">Shot {idx + 1}</span>
                        <span className="text-xs font-mono text-[#444]">{scene.duration}s</span>
                      </div>
                      <button
                        onClick={() => rerunShot(idx)}
                        disabled={isRerunning}
                        className="flex items-center gap-2 h-8 px-3 text-xs font-medium rounded-lg border border-[#333] bg-transparent text-[#ededed] hover:bg-[#111] hover:border-[#555] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {isRerunning ? (
                          <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Re-running...</>
                        ) : (
                          <><RotateCw className="h-3.5 w-3.5" /> Re-run</>
                        )}
                      </button>
                    </div>
                    <textarea
                      value={scene.prompt}
                      onChange={(e) => updateScenePrompt(idx, e.target.value)}
                      className="w-full bg-[#0a0a0a] border border-[#333] rounded-lg px-3 py-2 text-sm text-[#ccc] placeholder:text-[#555] focus:outline-none focus:border-[#555] focus:ring-1 focus:ring-white/10 resize-y leading-relaxed"
                      style={{ fieldSizing: 'content' as any, minHeight: '4rem' }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
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
