'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { RotateCcw, Play, X, Clock, ChevronDown, ChevronUp, Settings2, RotateCw, AlertCircle, Loader2, ImagePlus, MessageSquare } from 'lucide-react';
import { ReferenceImages } from './reference-images';
import { formatCostWithCredits, estimateGenerateVideosCost, estimateVideoCost, estimateStoryboardTotalCost } from '@/lib/costs';

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
  'mood-board': ["Setting the vibe.", "Finding the look.", "Building the mood board.", "Locking the aesthetic."],
  scenes: ["Breaking it into shots.", "Blocking the shots.", "Mapping the sequence.", "Setting up each shot."],
  storyboard: ["Drawing the storyboard.", "Framing each shot.", "Sketching the frames.", "Previewing the shots."],
  reviewing: ["Your scenes are ready.", "Review and edit.", "Make it yours.", "Check the shots."],
  video: ["Generating videos.", "Rendering scenes.", "Cameras rolling.", "Bringing it to life.", "Processing shots.", "Building the shots.", "Assembling the clips."],
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
import { TEXT_MODELS, type DialogueLine } from '@/lib/types';
import { GENERATION_MODES, getModeById } from '@/lib/generation-modes';

export function VideoGenerator() {
  const {
    state, options, sessionId, setIdea, setOptions,
    updateScenePrompt, updateSceneDialogue, removeScene, startModeGeneration, startDirectGeneration, handleGenerateVideos, handleReset, clearGeneration,
    isGenerating,
    rerunShot, rerunningShots,
    setReferenceImageSlot, clearReferenceImageSlot, removeReferenceImageSlot, addEmptySlot, resetReferenceImages,
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
  const [headline, setHeadline] = useState(HEADLINES[0]);

  useEffect(() => {
    setHeadline(HEADLINES[Math.floor(Math.random() * HEADLINES.length)]);
  }, []);

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

    if (state.status === 'reviewing') {
      phase = 'reviewing';
    } else if (state.status === 'complete') {
      phase = 'complete';
    } else {
      for (const event of state.progress) {
        if (event.type === 'agent-start' && event.agent === 'idea') phase = 'idea';
        if (event.type === 'mood-board-start') phase = 'mood-board';
        if (event.type === 'agent-start' && event.agent === 'scenes') phase = 'scenes';
        if (event.type === 'storyboard-start') phase = 'storyboard';
        if (event.type === 'video-start') phase = 'video';
      }
    }

    if (phase === lastPhaseRef.current) return;
    lastPhaseRef.current = phase;

    // Fade out, swap, fade in
    setHeadlineFade(false);
    setTimeout(() => {
      const headlines = PHASE_HEADLINES[phase] || PHASE_HEADLINES.idea;
      setGeneratingHeadline(pickRandom(headlines));
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
        <div className="px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-[15px] font-semibold tracking-tight" style={{ fontFamily: 'var(--font-geist-sans)' }}>gigapapaya</span>
            <span className="text-[#333]">/</span>
            <span className="text-sm text-[#666]" style={{ fontFamily: 'var(--font-geist-sans)' }}>storyboard</span>
          </div>
          <div className="flex items-center gap-4 pr-36">
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

      <main className="px-6 pt-16 pb-10 space-y-10 flex-1">
        {/* Hero + Input */}
        <div className="max-w-3xl mx-auto space-y-8 text-center">
          {!wizardActive && (
            <h1 className={`text-[40px] font-semibold tracking-tight leading-tight transition-opacity duration-700 ease-in-out ${isActive ? (headlineFade ? 'opacity-100' : 'opacity-0') : 'animate-fade-in'}`}>{isActive && generatingHeadline ? generatingHeadline : headline}</h1>
          )}

          {/* Input & mode buttons — hidden when generating/reviewing/complete */}
          {!wizardActive && !isActive && (
            <div className="space-y-5 animate-fade-in">
              {/* Unified input box */}
              <div className="border border-[#333] rounded-2xl bg-[#0a0a0a] focus-within:border-[#555] focus-within:ring-1 focus-within:ring-white/10 transition-all">
                <textarea
                  name="storyboardIdea"
                  placeholder="A frog drinking a cocktail at Martha's Vineyard..."
                  value={state.idea}
                  onChange={(e) => setIdea(e.target.value)}
                  rows={6}
                  className="w-full bg-transparent px-5 pt-4 pb-2 text-[15px] text-[#ededed] placeholder:text-[#555] focus:outline-none resize-none leading-relaxed"
                />
                <div className="flex items-center gap-4 px-4 pb-3">
                  <div className="flex items-center gap-1.5" title="Video aspect ratio — 16:9 landscape, 9:16 vertical/TikTok, 4:3 classic, 1:1 square">
                    <label className="text-[11px] font-mono text-[#444]">ratio</label>
                    <select
                      name="aspectRatio"
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
                  <div className="flex items-center gap-1.5" title="Length of each shot in seconds — auto lets the AI pick the best duration per scene">
                    <label className="text-[11px] font-mono text-[#444]">duration</label>
                    <select
                      name="duration"
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
                    <div className="flex items-center gap-1.5" title="Target total video length — only used when duration is set to auto">
                      <label className="text-[11px] font-mono text-[#444]">length</label>
                      <select
                        name="totalLength"
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
                  <div className="flex items-center gap-1.5" title="Number of scenes to generate — auto lets the AI decide based on the story">
                    <label className="text-[11px] font-mono text-[#444]">shots</label>
                    <select
                      name="numScenes"
                      value={options.numScenes || 'auto'}
                      onChange={(e) => {
                        const val = e.target.value;
                        setOptions(prev => ({ ...prev, numScenes: val === 'auto' ? undefined : parseInt(val) }));
                      }}
                      className="h-7 px-1.5 rounded-md bg-transparent text-xs text-[#888] font-mono focus:outline-none cursor-pointer hover:text-[#ededed] transition-colors"
                    >
                      <option value={1}>1</option>
                      <option value={2}>2</option>
                      <option value={3}>3</option>
                      <option value={4}>4</option>
                      <option value={5}>5</option>
                      <option value="auto">auto</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-1.5 ml-auto" title="AI-generated background music — turn off if you'll add your own in post">
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

              {/* Reference Images */}
              <ReferenceImages
                images={options.referenceImages || [null, null]}
                onSetSlot={setReferenceImageSlot}
                onClearSlot={clearReferenceImageSlot}
                onRemoveSlot={removeReferenceImageSlot}
                onAddEmptySlot={addEmptySlot}
                onReset={resetReferenceImages}
              />

              {/* Mode buttons */}
              {/* Cost estimate */}
              <div className="flex items-center justify-center gap-2 text-xs text-[#555]">
                <span className="font-mono">
                  <span className="text-[#FF0000]">{formatCostWithCredits(estimateStoryboardTotalCost(
                    options.numScenes || 3,
                    typeof options.duration === 'number' ? options.duration : 8
                  ))}</span>
                </span>
                <span className="text-[#333]">·</span>
                <span className="text-[#444]">
                  {options.numScenes || 3} {(options.numScenes || 3) === 1 ? 'video' : 'videos'} × {typeof options.duration === 'number' ? `${options.duration}s` : 'auto'}
                </span>
              </div>

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
                <div className="relative group">
                  <button
                    onClick={() => { if (state.idea.trim()) { setGeneratingHeadline(pickRandom(PHASE_HEADLINES.video)); setHeadlineFade(true); lastPhaseRef.current = ''; startDirectGeneration(); } }}
                    className={`flex items-center gap-2 h-11 px-5 rounded-full border border-[#555] bg-[#0a0a0a] transition-all ${!state.idea.trim() ? 'opacity-30' : 'hover:border-[#888] hover:bg-[#111] cursor-pointer'}`}
                  >
                    <span className="text-base">⚡</span>
                    <span className="text-sm text-[#ededed]">Raw</span>
                  </button>
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 rounded-lg bg-[#222] border border-[#333] text-xs text-[#ccc] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    Skip agents. Send your prompt directly to Veo.
                  </div>
                </div>
              </div>


            </div>
          )}

          {/* Progress tracker — shown under title when active */}
          {state.progress.length > 0 && (
            <div className="max-w-3xl mx-auto">
              <ProgressTracker events={state.progress} status={state.status} shotCount={state.editableScenes?.length} />
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
                          name="ideaModel"
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
                      name="ideaPrompt"
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
                          name="sceneModel"
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
                      name="scenePrompt"
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

        {/* Mood Board — shown as soon as images arrive */}
        {state.moodBoard.length > 0 && (
          <div className="space-y-3 animate-fade-in">
            <h2 className="text-sm font-medium text-[#ededed]">Mood Board</h2>
            <div className="grid grid-cols-3 gap-3">
              {state.moodBoard.map((img, i) => (
                <img key={i} src={img} alt={`Mood board ${i + 1}`} className="w-full object-contain rounded-xl border border-[#222] animate-scale-in bg-black" style={{ animationDelay: `${i * 200}ms`, aspectRatio: options.aspectRatio.replace(':', '/') }} />
              ))}
            </div>
          </div>
        )}

        {/* Character Portraits — shown as soon as portraits arrive */}
        {Object.keys(state.characterPortraits).length > 0 && (
          <div className="space-y-3 animate-fade-in">
            <h2 className="text-sm font-medium text-[#ededed]">Characters</h2>
            <div className="flex gap-3 flex-wrap">
              {Object.entries(state.characterPortraits).map(([name, img], i) => (
                <div key={name} className="text-center space-y-1.5 animate-scale-in" style={{ animationDelay: `${i * 200}ms` }}>
                  <img src={img} alt={name} className="w-20 h-20 object-contain rounded-full border border-[#333] bg-black" />
                  <span className="text-xs font-mono text-[#888] block">{name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Scene Cards — shown during generating (read-only) and reviewing (editable) */}
        {(state.scenes || state.editableScenes) && (state.status === 'generating' || state.status === 'reviewing') && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-medium text-[#ededed]">{state.status === 'reviewing' ? 'Review Shots' : 'Building Shots'}</h2>
                {(state.editableScenes || state.scenes) && (
                  <p className="text-xs text-[#555] mt-1 font-mono">
                    {(state.editableScenes || state.scenes)!.length} {(state.editableScenes || state.scenes)!.length === 1 ? 'shot' : 'shots'} · {(state.editableScenes || state.scenes)!.reduce((sum, s) => sum + s.duration, 0)}s total
                    {state.status === 'reviewing' && state.editableScenes && (
                      <> · <span className="text-[#FF0000]">{formatCostWithCredits(estimateGenerateVideosCost(state.editableScenes))}</span></>
                    )}
                  </p>
                )}
              </div>
              {state.status === 'reviewing' && state.editableScenes && (
                <Button onClick={handleGenerateVideos} className="gap-2">
                  <Play className="h-4 w-4" />
                  Generate {state.editableScenes?.length === 1 ? 'Video' : 'Videos'}
                  {state.editableScenes && (
                    <span className="text-[#FF0000] font-mono text-xs ml-1">
                      {formatCostWithCredits(estimateGenerateVideosCost(state.editableScenes))}
                    </span>
                  )}
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(state.editableScenes || state.scenes)!.map((scene, i) => {
                const isReviewing = state.status === 'reviewing';
                return (
                  <div
                    key={i}
                    className="border border-[#222] rounded-xl overflow-hidden hover:border-[#333] transition-colors flex flex-col animate-fade-in"
                    style={{ animationDelay: `${i * 150}ms` }}
                  >
                    {/* 1. Image */}
                    <div className="relative bg-[#0a0a0a]">
                      {state.storyboardImages[i] ? (
                        <>
                          <img src={state.storyboardImages[i]} alt={`Shot ${i + 1}`} className="w-full object-contain animate-scale-in bg-black" style={{ aspectRatio: options.aspectRatio.replace(':', '/') }} />
                          {isReviewing && (
                            <button
                              onClick={() => {
                                // TODO: implement frame regeneration
                              }}
                              className="absolute bottom-2 right-2 flex items-center gap-1 px-2 py-1 rounded-md bg-black/60 text-[10px] font-mono text-[#888] hover:text-white transition-colors backdrop-blur-sm"
                              title="Regenerate this storyboard frame (coming soon)"
                            >
                              <RotateCw className="h-2.5 w-2.5" />
                              Edit
                            </button>
                          )}
                        </>
                      ) : (
                        <div className="animate-shimmer border-b border-[#222]" style={{ aspectRatio: options.aspectRatio.replace(':', '/') }} />
                      )}
                      {/* Shot badge */}
                      <div className="absolute top-2 left-2 flex items-center gap-2">
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-sm">
                          <span className="text-xs font-mono font-medium text-white">Shot {i + 1}</span>
                          <span className="text-xs font-mono text-[#888]">{scene.duration}s</span>
                        </div>
                      </div>
                      {isReviewing && state.editableScenes && state.editableScenes.length > 1 && (
                        <button
                          onClick={() => removeScene(i)}
                          className="absolute top-2 right-2 p-1 rounded-md bg-black/60 text-[#888] hover:text-[#ff4444] transition-colors backdrop-blur-sm"
                          title="Remove shot"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>

                    {/* 2. Dialogue */}
                    <div className="px-3 pt-3 pb-2">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <MessageSquare className="h-3 w-3 text-[#555]" />
                        <label className="text-[10px] font-mono text-[#555] uppercase tracking-wider">dialogue</label>
                      </div>
                      {isReviewing ? (
                        <div className="space-y-2">
                          {(scene.dialogue || []).map((dl: DialogueLine, dlIdx: number) => (
                            <div key={dlIdx} className="flex items-start gap-1.5 group">
                              {/* Reorder buttons */}
                              <div className="flex flex-col gap-0 pt-1">
                                <button
                                  onClick={() => {
                                    if (dlIdx === 0) return;
                                    const d = [...scene.dialogue];
                                    [d[dlIdx - 1], d[dlIdx]] = [d[dlIdx], d[dlIdx - 1]];
                                    updateSceneDialogue(i, d);
                                  }}
                                  disabled={dlIdx === 0}
                                  className="text-[#444] hover:text-[#888] disabled:opacity-20 transition-colors"
                                  title="Move up"
                                >
                                  <ChevronUp className="h-3 w-3" />
                                </button>
                                <button
                                  onClick={() => {
                                    if (dlIdx === scene.dialogue.length - 1) return;
                                    const d = [...scene.dialogue];
                                    [d[dlIdx], d[dlIdx + 1]] = [d[dlIdx + 1], d[dlIdx]];
                                    updateSceneDialogue(i, d);
                                  }}
                                  disabled={dlIdx === scene.dialogue.length - 1}
                                  className="text-[#444] hover:text-[#888] disabled:opacity-20 transition-colors"
                                  title="Move down"
                                >
                                  <ChevronDown className="h-3 w-3" />
                                </button>
                              </div>
                              {/* Character selector */}
                              <select
                                value={dl.character}
                                onChange={(e) => {
                                  const d = [...scene.dialogue];
                                  d[dlIdx] = { ...dl, character: e.target.value };
                                  updateSceneDialogue(i, d);
                                }}
                                className="h-7 px-1.5 rounded-md bg-[#0a0a0a] border border-[#333] text-[10px] text-[#e0c866] font-mono focus:outline-none flex-shrink-0 min-w-0"
                              >
                                {(scene.characters || []).map((c: string) => (
                                  <option key={c} value={c}>{c}</option>
                                ))}
                                {/* Include current character if not in scene.characters */}
                                {dl.character && !(scene.characters || []).includes(dl.character) && (
                                  <option value={dl.character}>{dl.character}</option>
                                )}
                              </select>
                              {/* Line text — auto-expanding */}
                              <textarea
                                value={dl.line}
                                onChange={(e) => {
                                  const d = [...scene.dialogue];
                                  d[dlIdx] = { ...dl, line: e.target.value };
                                  updateSceneDialogue(i, d);
                                }}
                                placeholder="What do they say?"
                                className="flex-1 min-w-0 bg-[#111] border border-[#333] rounded-lg px-2 py-1.5 text-sm text-[#e0c866] placeholder:text-[#555] focus:outline-none focus:border-[#555] italic resize-none"
                                style={{ fieldSizing: 'content' as any, minHeight: '2rem' }}
                              />
                              {/* Remove line */}
                              <button
                                onClick={() => {
                                  updateSceneDialogue(i, scene.dialogue.filter((_: DialogueLine, idx: number) => idx !== dlIdx));
                                }}
                                className="p-1 mt-1 text-[#333] hover:text-[#ff4444] transition-colors opacity-0 group-hover:opacity-100"
                                title="Remove line"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                          {/* Add line */}
                          <button
                            onClick={() => {
                              const defaultChar = scene.characters?.[0] || 'Character';
                              updateSceneDialogue(i, [...(scene.dialogue || []), { character: defaultChar, line: '' }]);
                            }}
                            className="text-[10px] font-mono text-[#444] hover:text-[#888] transition-colors"
                          >
                            + Add line
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {(scene.dialogue || []).map((dl: DialogueLine, dlIdx: number) => (
                            <p key={dlIdx} className="text-sm text-[#e0c866]/60 italic">
                              <span className="text-[10px] font-mono text-[#555] not-italic mr-1.5">{dl.character}:</span>
                              {dl.line}
                            </p>
                          ))}
                          {(!scene.dialogue || scene.dialogue.length === 0) && (
                            <p className="text-sm text-[#555] italic">(no dialogue)</p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* 3. Description */}
                    <div className="px-3 pb-3">
                      <label className="text-[10px] font-mono text-[#555] uppercase tracking-wider mb-1.5 block">description</label>
                      {isReviewing ? (
                        <textarea
                          value={scene.prompt}
                          onChange={(e) => updateScenePrompt(i, e.target.value)}
                          className="w-full bg-[#0a0a0a] border border-[#333] rounded-lg px-3 py-2 text-xs text-[#999] placeholder:text-[#555] focus:outline-none focus:border-[#555] focus:ring-1 focus:ring-white/10 resize-y leading-relaxed"
                          style={{ fieldSizing: 'content' as any, minHeight: '3rem' }}
                        />
                      ) : (
                        <p className="w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-3 py-2 text-xs text-[#666] leading-relaxed">
                          {scene.prompt}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
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
                      <div className="flex items-center gap-2">
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
                        {!isRerunning && (
                          <span className="text-[10px] font-mono text-[#FF0000]">
                            {formatCostWithCredits(estimateVideoCost(scene.duration, scene.dialogue?.length > 0))}
                          </span>
                        )}
                      </div>
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
        <div className="px-6 h-14 flex items-center justify-between">
          <span className="text-xs font-mono text-[#333]">gigapapaya</span>
          <span className="text-xs font-mono text-[#333]">veo 3.1 / ai gateway</span>
        </div>
      </footer>
    </div>
  );
}
