'use client';

import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from 'react';
import type { GenerationState, GenerationOptions, SSEMessage, ProgressEvent, AgentConfig, ReferenceImage, DialogueLine } from '@/lib/types';
import { GENERATION_MODES, getModeById } from '@/lib/generation-modes';
import { useDebug } from './debug-context';

const HISTORY_KEY = 'gp_storyboard_history';
const CUSTOM_PROMPTS_KEY = 'gp_custom_prompts';
const MAX_HISTORY = 50;

// Per-mode, per-agent customization stored in localStorage
export interface ModeCustomization {
  ideaModel?: string;
  ideaPrompt?: string;
  sceneModel?: string;
  scenePrompt?: string;
}

export type CustomPrompts = Record<string, ModeCustomization>;

export interface HistoryEntry {
  id: string;
  prompt: string;
  timestamp: number;
}

interface StoryboardContextValue {
  state: GenerationState;
  options: GenerationOptions;
  sessionId: string;
  setIdea: (idea: string) => void;
  setOptions: (updater: (prev: GenerationOptions) => GenerationOptions) => void;
  updateScenePrompt: (index: number, prompt: string) => void;
  updateSceneDialogue: (index: number, dialogue: DialogueLine[]) => void;
  removeScene: (index: number) => void;
  startModeGeneration: (modeId: string) => void;
  startDirectGeneration: () => void;
  handleGenerateVideos: () => void;
  handleReset: () => void;
  clearGeneration: () => void;
  isGenerating: boolean;
  // Re-run individual shots
  rerunShot: (sceneIndex: number) => void;
  rerunningShots: Set<number>;
  // Per-mode custom prompts
  customPrompts: CustomPrompts;
  updateModeCustomization: (modeId: string, field: keyof ModeCustomization, value: string) => void;
  restoreModeDefault: (modeId: string, agent: 'idea' | 'scene') => void;
  // Reference images (slot-based)
  setReferenceImageSlot: (index: number, dataUrl: string, tag: string) => void;
  clearReferenceImageSlot: (index: number) => void;
  removeReferenceImageSlot: (index: number) => void;
  addEmptySlot: () => void;
  resetReferenceImages: () => void;
  // History
  history: HistoryEntry[];
  deleteHistoryEntry: (id: string) => void;
  clearHistory: () => void;
  loadFromHistory: (prompt: string) => void;
  // Mood board review
  selectedMoodBoardIndex: number | null;
  selectMoodBoardImage: (index: number) => void;
  refineMoodBoard: (modifier: string) => Promise<void>;
  undoMoodBoardRefinement: () => void;
  continuePastMoodBoard: () => void;
  isRefining: boolean;
  canUndoMoodBoard: boolean;
  // Portrait lightbox
  portraitModalCharacter: string | null;
  openPortraitModal: (name: string) => void;
  closePortraitModal: () => void;
  regeneratePortrait: (name: string, description: string) => Promise<void>;
  isRegeneratingPortrait: boolean;
  // Character review
  continuePastCharacters: () => void;
}

const StoryboardContext = createContext<StoryboardContextValue | null>(null);

export function useStoryboard() {
  const ctx = useContext(StoryboardContext);
  if (!ctx) throw new Error('useStoryboard must be used within StoryboardProvider');
  return ctx;
}

export function StoryboardProvider({ children }: { children: ReactNode }) {
  const { pushLog } = useDebug();
  const pushLogRef = useRef(pushLog);
  pushLogRef.current = pushLog;

  // Shorthand for verbose debug logging
  const log = (source: string, raw: Record<string, unknown>) => {
    pushLogRef.current({ timestamp: Date.now(), source, raw });
  };

  const [state, setState] = useState<GenerationState>({
    status: 'idle',
    idea: '',
    generatedIdea: null,
    scenes: null,
    editableScenes: null,
    videos: [],
    progress: [],
    error: null,
    failedShots: new Set(),
    moodBoard: [],
    storyboardImages: [],
    characterPortraits: {},
    characters: [],
    selectedMoodBoardIndex: null,
    moodBoardHistory: [],
  });

  const [isRefining, setIsRefining] = useState(false);
  const [portraitModalCharacter, setPortraitModalCharacter] = useState<string | null>(null);
  const [isRegeneratingPortrait, setIsRegeneratingPortrait] = useState(false);

  const [options, setOptionsState] = useState<GenerationOptions>({
    aspectRatio: '16:9',
    duration: 8,
    numScenes: 1,
    mode: 'agents',
  });

  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [customPrompts, setCustomPrompts] = useState<CustomPrompts>({});
  const [rerunningShots, setRerunningShots] = useState<Set<number>>(new Set());
  const sessionIdRef = useRef<string>('');
  const abortRef = useRef<AbortController | null>(null);

  // Load history and custom prompts from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(HISTORY_KEY);
      if (stored) setHistory(JSON.parse(stored));
    } catch {}
    try {
      const stored = localStorage.getItem(CUSTOM_PROMPTS_KEY);
      if (stored) setCustomPrompts(JSON.parse(stored));
    } catch {}
  }, []);

  const saveHistory = useCallback((entries: HistoryEntry[]) => {
    setHistory(entries);
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(entries)); } catch {}
  }, []);

  const addToHistory = useCallback((prompt: string) => {
    setHistory(prev => {
      // Deduplicate
      const filtered = prev.filter(h => h.prompt !== prompt);
      const next = [{ id: crypto.randomUUID(), prompt, timestamp: Date.now() }, ...filtered].slice(0, MAX_HISTORY);
      try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const deleteHistoryEntry = useCallback((id: string) => {
    setHistory(prev => {
      const next = prev.filter(h => h.id !== id);
      try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    saveHistory([]);
  }, [saveHistory]);

  const loadFromHistory = useCallback((prompt: string) => {
    setState(prev => ({ ...prev, idea: prompt }));
  }, []);

  const setIdea = useCallback((idea: string) => {
    setState(prev => ({ ...prev, idea }));
  }, []);

  // Slot-based reference images (2 empty slots by default)
  const ensureSlots = useCallback(() => {
    setOptionsState(prev => {
      if (!prev.referenceImages || prev.referenceImages.length === 0) {
        return { ...prev, referenceImages: [null, null] };
      }
      return prev;
    });
  }, []);

  // Initialize slots on mount
  useEffect(() => { ensureSlots(); }, [ensureSlots]);

  const setReferenceImageSlot = useCallback((index: number, dataUrl: string, tag: string) => {
    setOptionsState(prev => {
      const slots = [...(prev.referenceImages || [null, null])];
      while (slots.length <= index) slots.push(null);
      slots[index] = { dataUrl, tag };
      return { ...prev, referenceImages: slots };
    });
  }, []);

  const clearReferenceImageSlot = useCallback((index: number) => {
    setOptionsState(prev => {
      const slots = [...(prev.referenceImages || [null, null])];
      if (index < slots.length) slots[index] = null;
      return { ...prev, referenceImages: slots };
    });
  }, []);

  const removeReferenceImageSlot = useCallback((index: number) => {
    setOptionsState(prev => {
      const slots = [...(prev.referenceImages || [null, null])];
      slots.splice(index, 1);
      // Never go below 2 slots
      while (slots.length < 2) slots.push(null);
      return { ...prev, referenceImages: slots };
    });
  }, []);

  const addEmptySlot = useCallback(() => {
    setOptionsState(prev => {
      const slots = [...(prev.referenceImages || [null, null])];
      if (slots.length >= 14) return prev;
      slots.push(null);
      return { ...prev, referenceImages: slots };
    });
  }, []);

  const resetReferenceImages = useCallback(() => {
    setOptionsState(prev => ({ ...prev, referenceImages: [null, null] }));
  }, []);

  const setOptions = useCallback((updater: (prev: GenerationOptions) => GenerationOptions) => {
    setOptionsState(updater);
  }, []);

  const updateModeCustomization = useCallback((modeId: string, field: keyof ModeCustomization, value: string) => {
    setCustomPrompts(prev => {
      const next = { ...prev, [modeId]: { ...prev[modeId], [field]: value } };
      try { localStorage.setItem(CUSTOM_PROMPTS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const restoreModeDefault = useCallback((modeId: string, agent: 'idea' | 'scene') => {
    setCustomPrompts(prev => {
      const current = { ...prev[modeId] };
      if (agent === 'idea') {
        delete current.ideaPrompt;
        delete current.ideaModel;
      } else {
        delete current.scenePrompt;
        delete current.sceneModel;
      }
      const next = { ...prev, [modeId]: current };
      try { localStorage.setItem(CUSTOM_PROMPTS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  // Get the effective agent config for a mode (custom or default)
  const getAgentConfigForMode = useCallback((modeId: string): { ideaAgent: AgentConfig; sceneAgent: AgentConfig } => {
    const mode = getModeById(modeId);
    const custom = customPrompts[modeId] || {};
    return {
      ideaAgent: {
        model: custom.ideaModel || 'anthropic/claude-sonnet-4.5',
        prompt: custom.ideaPrompt || mode.ideaPrompt,
      },
      sceneAgent: {
        model: custom.sceneModel || 'anthropic/claude-sonnet-4.5',
        prompt: custom.scenePrompt || mode.scenePrompt,
      },
    };
  }, [customPrompts]);

  const updateScenePrompt = useCallback((index: number, prompt: string) => {
    setState(prev => ({
      ...prev,
      editableScenes: prev.editableScenes?.map((s, i) =>
        i === index ? { ...s, prompt } : s
      ) || null,
    }));
  }, []);

  const updateSceneDialogue = useCallback((index: number, dialogue: DialogueLine[]) => {
    setState(prev => ({
      ...prev,
      editableScenes: prev.editableScenes?.map((s, i) =>
        i === index ? { ...s, dialogue } : s
      ) || null,
    }));
  }, []);

  const removeScene = useCallback((index: number) => {
    setState(prev => ({
      ...prev,
      editableScenes: prev.editableScenes?.filter((_, i) => i !== index) || null,
    }));
  }, []);

  // Mood board review callbacks
  const selectMoodBoardImage = useCallback((index: number) => {
    setState(prev => ({ ...prev, selectedMoodBoardIndex: index }));
  }, []);

  const refineMoodBoard = useCallback(async (modifier: string) => {
    const idx = state.selectedMoodBoardIndex;
    if (idx === null || !state.generatedIdea) return;

    setIsRefining(true);

    // Push current moodBoard to history for undo
    setState(prev => ({
      ...prev,
      moodBoardHistory: [...prev.moodBoardHistory, [...prev.moodBoard]],
    }));

    try {
      const response = await fetch('/api/refine-mood-board', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: state.moodBoard[idx],
          modifier,
          idea: state.generatedIdea,
          aspectRatio: options.aspectRatio,
        }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();

      setState(prev => {
        const newMoodBoard = [...prev.moodBoard];
        newMoodBoard[idx] = data.imageUrl;
        return { ...prev, moodBoard: newMoodBoard };
      });
    } catch (error) {
      // Revert the history push on failure
      setState(prev => ({
        ...prev,
        moodBoardHistory: prev.moodBoardHistory.slice(0, -1),
      }));
      console.error('Mood board refinement failed:', error);
    } finally {
      setIsRefining(false);
    }
  }, [state.selectedMoodBoardIndex, state.moodBoard, state.generatedIdea, options.aspectRatio]);

  const undoMoodBoardRefinement = useCallback(() => {
    setState(prev => {
      if (prev.moodBoardHistory.length === 0) return prev;
      const history = [...prev.moodBoardHistory];
      const previousBoard = history.pop()!;
      return { ...prev, moodBoard: previousBoard, moodBoardHistory: history };
    });
  }, []);

  // Portrait lightbox callbacks
  const openPortraitModal = useCallback((name: string) => {
    setPortraitModalCharacter(name);
  }, []);

  const closePortraitModal = useCallback(() => {
    setPortraitModalCharacter(null);
  }, []);

  const regeneratePortrait = useCallback(async (name: string, description: string) => {
    if (!state.generatedIdea) return;
    setIsRegeneratingPortrait(true);

    try {
      const response = await fetch('/api/regenerate-portrait', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          style: state.generatedIdea.style,
          mood: state.generatedIdea.mood,
          moodBoard: state.moodBoard,
        }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();

      setState(prev => ({
        ...prev,
        characterPortraits: { ...prev.characterPortraits, [name]: data.imageUrl },
        // Also update the character description in the characters array
        characters: prev.characters.map(c =>
          c.name === name ? { ...c, description } : c
        ),
      }));
    } catch (error) {
      console.error(`Failed to regenerate portrait for ${name}:`, error);
    } finally {
      setIsRegeneratingPortrait(false);
    }
  }, [state.generatedIdea, state.moodBoard]);

  // SSE stream reader — also pushes to debug log when debug mode is on
  const readSSEStream = async (response: Response, onEvent: (data: SSEMessage) => void, source: 'generate' | 'generate-videos' | 'rerun' = 'generate') => {
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
          pushLogRef.current({ timestamp: Date.now(), source, raw: data as unknown as Record<string, unknown> });
          onEvent(data);
        }
      }
    }
  };

  const startModeGeneration = useCallback((modeId: string) => {
    const idea = state.idea.trim();
    if (!idea) return;

    pushLogRef.current({ timestamp: Date.now(), source: 'client', raw: { type: 'generation-start', mode: 'agents', modeId, prompt: idea, options: { ...options, modeId } } });
    addToHistory(idea);

    setState(prev => ({
      ...prev,
      status: 'generating',
      generatedIdea: null,
      scenes: null,
      editableScenes: null,
      videos: [],
      progress: [],
      error: null,
      failedShots: new Set(),
      moodBoard: [],
      storyboardImages: [],
      characterPortraits: {},
      characters: [],
    }));

    const agentConfig = getAgentConfigForMode(modeId);
    const currentOptions = {
      ...options,
      mode: 'agents' as const,
      modeId,
      ideaAgent: agentConfig.ideaAgent,
      sceneAgent: agentConfig.sceneAgent,
    };

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idea, options: currentOptions }),
      signal: controller.signal,
    })
      .then(async (response) => {
        log('client', { type: 'http-response', endpoint: '/api/generate', mode: 'agents', status: response.status });
        if (response.status === 402) {
          const data = await response.json();
          log('client', { type: 'credit-error', endpoint: '/api/generate', required: data.required, available: data.available });
          setState(prev => ({
            ...prev,
            status: 'error',
            error: `Insufficient credits. Need ${data.required?.toLocaleString()}, have ${data.available?.toLocaleString()}. Request more from an admin.`,
          }));
          return;
        }
        if (!response.ok) {
          log('client', { type: 'http-error', endpoint: '/api/generate', status: response.status });
          throw new Error(`HTTP ${response.status}`);
        }

        await readSSEStream(response, (data) => {
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
            moodBoard: data.moodBoard,
            storyboardImages: data.storyboardImages,
            characterPortraits: data.characterPortraits,
            moodBoardImage: data.moodBoardImage,
            storyboardImage: data.storyboardImage,
            characterName: data.characterName,
            characterPortrait: data.characterPortrait,
          };

          setState(prev => ({ ...prev, progress: [...prev.progress, progressEvent] }));

          switch (data.type) {
            case 'agent-complete':
              if (data.agent === 'idea') {
                setState(prev => ({ ...prev, generatedIdea: data.result }));
              } else if (data.agent === 'scenes') {
                setState(prev => ({ ...prev, scenes: data.result.scenes, characters: data.result.characters || prev.characters }));
              }
              break;
            case 'mood-board-image':
              if (data.moodBoardImage) {
                setState(prev => ({ ...prev, moodBoard: [...prev.moodBoard, data.moodBoardImage!] }));
              }
              break;
            case 'mood-board-complete':
              if (data.moodBoard) {
                setState(prev => ({ ...prev, moodBoard: data.moodBoard || [] }));
              }
              break;
            case 'mood-board-ready':
              sessionIdRef.current = data.sessionId || '';
              setState(prev => ({
                ...prev,
                status: 'mood-board-review',
                moodBoard: data.moodBoard || prev.moodBoard,
                generatedIdea: data.result?.idea || prev.generatedIdea,
                selectedMoodBoardIndex: null,
                moodBoardHistory: [],
              }));
              break;
            case 'character-portrait':
              if (data.characterName && data.characterPortrait) {
                setState(prev => ({
                  ...prev,
                  characterPortraits: { ...prev.characterPortraits, [data.characterName!]: data.characterPortrait! },
                }));
              }
              break;
            case 'storyboard-frame':
              if (data.storyboardImage !== undefined && data.sceneIndex !== undefined) {
                setState(prev => {
                  const imgs = [...prev.storyboardImages];
                  imgs[data.sceneIndex!] = data.storyboardImage!;
                  return { ...prev, storyboardImages: imgs };
                });
              }
              break;
            case 'storyboard-complete':
              setState(prev => ({
                ...prev,
                storyboardImages: data.storyboardImages || prev.storyboardImages,
                characterPortraits: data.characterPortraits || prev.characterPortraits,
              }));
              break;
            case 'scenes-ready':
              sessionIdRef.current = data.sessionId || '';
              setState(prev => ({
                ...prev,
                status: 'reviewing',
                editableScenes: prev.scenes ? prev.scenes.map(s => {
                  const characters = s.characters || [];
                  // Ensure dialogue field is a DialogueLine[] (backward compat)
                  let dialogue: DialogueLine[];
                  if (Array.isArray(s.dialogue)) {
                    dialogue = s.dialogue;
                  } else if (typeof s.dialogue === 'string' && (s.dialogue as string).trim()) {
                    // Old agent returned a plain string — wrap it
                    dialogue = [{ character: characters[0] || 'Character', line: s.dialogue as string }];
                  } else {
                    dialogue = [];
                  }
                  let prompt = s.prompt;
                  // If dialogue is empty and there's quoted text in the prompt, extract it
                  if (dialogue.length === 0) {
                    const match = prompt.match(/"([^"]{3,})"/);
                    if (match) {
                      dialogue = [{ character: characters[0] || 'Character', line: match[1] }];
                      prompt = prompt.replace(`"${match[1]}"`, '').replace(/,\s*saying\s*,/, ',').replace(/\s+/g, ' ').trim();
                    }
                  }
                  return { ...s, dialogue, characters, prompt };
                }) : null,
                moodBoard: data.moodBoard || prev.moodBoard,
                storyboardImages: data.storyboardImages || prev.storyboardImages,
                characterPortraits: data.characterPortraits || prev.characterPortraits,
              }));
              break;
            case 'complete':
              setState(prev => ({ ...prev, status: 'complete', videos: data.videos || [] }));
              window.dispatchEvent(new Event('credits-changed'));
              break;
            case 'error':
              if (!data.sceneIndex && data.sceneIndex !== 0) {
                setState(prev => ({ ...prev, status: 'error', error: data.message || 'Unknown error' }));
              }
              break;
          }
        });
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          log('client', { type: 'generation-aborted', mode: 'agents' });
          return;
        }
        log('client', { type: 'fetch-error', endpoint: '/api/generate', mode: 'agents', error: error instanceof Error ? error.message : String(error) });
        setState(prev => ({
          ...prev,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
          progress: [
            ...prev.progress,
            { type: 'error', timestamp: new Date(), message: error instanceof Error ? error.message : 'Unknown error' },
          ],
        }));
      });
  }, [state.idea, options, addToHistory, getAgentConfigForMode]);

  const startDirectGeneration = useCallback(() => {
    const idea = state.idea.trim();
    if (!idea) return;

    log('client', { type: 'generation-start', mode: 'direct', prompt: idea, aspectRatio: options.aspectRatio, duration: options.duration });
    addToHistory(idea);

    setState(prev => ({
      ...prev,
      status: 'generating',
      generatedIdea: null,
      scenes: null,
      editableScenes: null,
      videos: [],
      progress: [],
      error: null,
      failedShots: new Set(),
      moodBoard: [],
      storyboardImages: [],
      characterPortraits: {},
      characters: [],
    }));

    const currentOptions = {
      ...options,
      mode: 'direct' as const,
      numScenes: 1,
    };

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idea, options: currentOptions }),
      signal: controller.signal,
    })
      .then(async (response) => {
        log('client', { type: 'http-response', endpoint: '/api/generate', mode: 'direct', status: response.status });
        if (response.status === 402) {
          const data = await response.json();
          log('client', { type: 'credit-error', endpoint: '/api/generate', required: data.required, available: data.available });
          setState(prev => ({
            ...prev,
            status: 'error',
            error: `Insufficient credits. Need ${data.required?.toLocaleString()}, have ${data.available?.toLocaleString()}. Request more from an admin.`,
          }));
          return;
        }
        if (!response.ok) {
          log('client', { type: 'http-error', endpoint: '/api/generate', status: response.status });
          throw new Error(`HTTP ${response.status}`);
        }

        await readSSEStream(response, (data) => {
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

          setState(prev => ({ ...prev, progress: [...prev.progress, progressEvent] }));

          switch (data.type) {
            case 'video-complete':
              if (data.video) {
                setState(prev => ({ ...prev, videos: [...prev.videos, data.video!] }));
              }
              break;
            case 'complete':
              log('client', { type: 'generation-complete', mode: 'direct', videoCount: (data.videos || []).length });
              setState(prev => ({ ...prev, status: 'complete', videos: data.videos || prev.videos }));
              window.dispatchEvent(new Event('credits-changed'));
              break;
            case 'error':
              log('client', { type: 'generation-error', mode: 'direct', message: data.message });
              setState(prev => ({ ...prev, status: 'error', error: data.message || 'Unknown error' }));
              break;
          }
        });
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        log('client', { type: 'fetch-error', endpoint: '/api/generate', error: error instanceof Error ? error.message : String(error) });
        setState(prev => ({
          ...prev,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        }));
      });
  }, [state.idea, options, addToHistory]);

  const continuePastMoodBoard = useCallback(() => {
    if (!state.generatedIdea || state.moodBoard.length === 0) return;

    // Reorder mood board: selected image first, then the rest
    const selectedIdx = state.selectedMoodBoardIndex ?? 0;
    const reorderedMoodBoard = [
      state.moodBoard[selectedIdx],
      ...state.moodBoard.filter((_, i) => i !== selectedIdx),
    ];

    setState(prev => ({
      ...prev,
      status: 'generating',
      moodBoard: reorderedMoodBoard,
      moodBoardHistory: [],
      selectedMoodBoardIndex: 0,
    }));

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const currentOptions = { ...options, mode: 'agents' as const, modeId: options.modeId };

    fetch('/api/continue-generation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idea: state.generatedIdea,
        moodBoard: reorderedMoodBoard,
        options: currentOptions,
        sessionId: sessionIdRef.current,
      }),
      signal: controller.signal,
    })
      .then(async (response) => {
        log('client', { type: 'http-response', endpoint: '/api/continue-generation', status: response.status });
        if (!response.ok) {
          log('client', { type: 'http-error', endpoint: '/api/continue-generation', status: response.status });
          throw new Error(`HTTP ${response.status}`);
        }

        await readSSEStream(response, (data) => {
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
            moodBoard: data.moodBoard,
            storyboardImages: data.storyboardImages,
            characterPortraits: data.characterPortraits,
            moodBoardImage: data.moodBoardImage,
            storyboardImage: data.storyboardImage,
            characterName: data.characterName,
            characterPortrait: data.characterPortrait,
          };

          setState(prev => ({ ...prev, progress: [...prev.progress, progressEvent] }));

          switch (data.type) {
            case 'agent-complete':
              if (data.agent === 'scenes') {
                setState(prev => ({ ...prev, scenes: data.result.scenes, characters: data.result.characters || prev.characters }));
              }
              break;
            case 'character-portrait':
              if (data.characterName && data.characterPortrait) {
                setState(prev => ({
                  ...prev,
                  characterPortraits: { ...prev.characterPortraits, [data.characterName!]: data.characterPortrait! },
                }));
              }
              break;
            case 'characters-ready':
              sessionIdRef.current = data.sessionId || sessionIdRef.current;
              setState(prev => ({
                ...prev,
                status: 'characters-review',
                characterPortraits: data.characterPortraits || prev.characterPortraits,
                scenes: data.result?.scenes?.scenes || prev.scenes,
                characters: data.result?.scenes?.characters || prev.characters,
                generatedIdea: data.result?.idea || prev.generatedIdea,
              }));
              break;
            case 'storyboard-frame':
              if (data.storyboardImage !== undefined && data.sceneIndex !== undefined) {
                setState(prev => {
                  const imgs = [...prev.storyboardImages];
                  imgs[data.sceneIndex!] = data.storyboardImage!;
                  return { ...prev, storyboardImages: imgs };
                });
              }
              break;
            case 'storyboard-complete':
              setState(prev => ({
                ...prev,
                storyboardImages: data.storyboardImages || prev.storyboardImages,
                characterPortraits: data.characterPortraits || prev.characterPortraits,
              }));
              break;
            case 'scenes-ready':
              sessionIdRef.current = data.sessionId || sessionIdRef.current;
              setState(prev => ({
                ...prev,
                status: 'reviewing',
                editableScenes: prev.scenes ? prev.scenes.map(s => {
                  const characters = s.characters || [];
                  let dialogue: DialogueLine[];
                  if (Array.isArray(s.dialogue)) {
                    dialogue = s.dialogue;
                  } else if (typeof s.dialogue === 'string' && (s.dialogue as string).trim()) {
                    dialogue = [{ character: characters[0] || 'Character', line: s.dialogue as string }];
                  } else {
                    dialogue = [];
                  }
                  let prompt = s.prompt;
                  if (dialogue.length === 0) {
                    const match = prompt.match(/"([^"]{3,})"/);
                    if (match) {
                      dialogue = [{ character: characters[0] || 'Character', line: match[1] }];
                      prompt = prompt.replace(`"${match[1]}"`, '').replace(/,\s*saying\s*,/, ',').replace(/\s+/g, ' ').trim();
                    }
                  }
                  return { ...s, dialogue, characters, prompt };
                }) : null,
                moodBoard: data.moodBoard || prev.moodBoard,
                storyboardImages: data.storyboardImages || prev.storyboardImages,
                characterPortraits: data.characterPortraits || prev.characterPortraits,
              }));
              break;
            case 'error':
              if (!data.sceneIndex && data.sceneIndex !== 0) {
                setState(prev => ({ ...prev, status: 'error', error: data.message || 'Unknown error' }));
              }
              break;
          }
        });
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        log('client', { type: 'fetch-error', endpoint: '/api/continue-generation', error: error instanceof Error ? error.message : String(error) });
        setState(prev => ({
          ...prev,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
          progress: [
            ...prev.progress,
            { type: 'error', timestamp: new Date(), message: error instanceof Error ? error.message : 'Unknown error' },
          ],
        }));
      });
  }, [state.generatedIdea, state.moodBoard, state.selectedMoodBoardIndex, options]);

  const continuePastCharacters = useCallback(() => {
    if (!state.generatedIdea || !state.scenes) return;

    setState(prev => ({ ...prev, status: 'generating' }));

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const currentOptions = { ...options, mode: 'agents' as const, modeId: options.modeId };

    fetch('/api/continue-storyboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idea: state.generatedIdea,
        moodBoard: state.moodBoard,
        scenes: state.scenes,
        characters: state.characters,
        characterPortraits: state.characterPortraits,
        options: currentOptions,
        sessionId: sessionIdRef.current,
      }),
      signal: controller.signal,
    })
      .then(async (response) => {
        log('client', { type: 'http-response', endpoint: '/api/continue-storyboard', status: response.status });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        await readSSEStream(response, (data) => {
          const progressEvent: ProgressEvent = {
            type: data.type,
            timestamp: new Date(),
            agent: data.agent as any,
            status: data.status,
            result: data.result,
            sceneIndex: data.sceneIndex,
            moodBoard: data.moodBoard,
            storyboardImages: data.storyboardImages,
            characterPortraits: data.characterPortraits,
            storyboardImage: data.storyboardImage,
            environmentImage: data.environmentImage,
          };

          setState(prev => ({ ...prev, progress: [...prev.progress, progressEvent] }));

          switch (data.type) {
            case 'storyboard-frame':
              if (data.storyboardImage !== undefined && data.sceneIndex !== undefined) {
                setState(prev => {
                  const imgs = [...prev.storyboardImages];
                  imgs[data.sceneIndex!] = data.storyboardImage!;
                  return { ...prev, storyboardImages: imgs };
                });
              }
              break;
            case 'storyboard-complete':
              setState(prev => ({
                ...prev,
                storyboardImages: data.storyboardImages || prev.storyboardImages,
                characterPortraits: data.characterPortraits || prev.characterPortraits,
              }));
              break;
            case 'scenes-ready':
              sessionIdRef.current = data.sessionId || sessionIdRef.current;
              setState(prev => ({
                ...prev,
                status: 'reviewing',
                editableScenes: prev.scenes ? prev.scenes.map(s => {
                  const characters = s.characters || [];
                  let dialogue: DialogueLine[];
                  if (Array.isArray(s.dialogue)) {
                    dialogue = s.dialogue;
                  } else if (typeof s.dialogue === 'string' && (s.dialogue as string).trim()) {
                    dialogue = [{ character: characters[0] || 'Character', line: s.dialogue as string }];
                  } else {
                    dialogue = [];
                  }
                  let prompt = s.prompt;
                  if (dialogue.length === 0) {
                    const match = prompt.match(/"([^"]{3,})"/);
                    if (match) {
                      dialogue = [{ character: characters[0] || 'Character', line: match[1] }];
                      prompt = prompt.replace(`"${match[1]}"`, '').replace(/,\s*saying\s*,/, ',').replace(/\s+/g, ' ').trim();
                    }
                  }
                  return { ...s, dialogue, characters, prompt };
                }) : null,
                moodBoard: data.moodBoard || prev.moodBoard,
                storyboardImages: data.storyboardImages || prev.storyboardImages,
                characterPortraits: data.characterPortraits || prev.characterPortraits,
              }));
              break;
            case 'error':
              if (!data.sceneIndex && data.sceneIndex !== 0) {
                setState(prev => ({ ...prev, status: 'error', error: data.message || 'Unknown error' }));
              }
              break;
          }
        });
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        log('client', { type: 'fetch-error', endpoint: '/api/continue-storyboard', error: error instanceof Error ? error.message : String(error) });
        setState(prev => ({
          ...prev,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        }));
      });
  }, [state.generatedIdea, state.scenes, state.characters, state.characterPortraits, state.moodBoard, options]);

  const handleGenerateVideos = useCallback(() => {
    setState(prev => {
      if (!prev.editableScenes) return prev;

      log('client', { type: 'video-generation-start', sceneCount: prev.editableScenes.length, scenes: prev.editableScenes.map((s, i) => ({ shot: i + 1, duration: s.duration, promptLength: s.prompt.length, hasDialogue: Array.isArray(s.dialogue) && s.dialogue.length > 0 })) });
      const scenes = prev.editableScenes.map(s => ({ prompt: s.prompt, dialogue: s.dialogue, duration: s.duration }));
      const style = prev.generatedIdea?.style || '';
      const mood = prev.generatedIdea?.mood || '';
      const sid = sessionIdRef.current;
      const currentOptions = options;
      const currentMoodBoard = prev.moodBoard;
      const currentStoryboard = prev.storyboardImages;
      const currentPortraits = prev.characterPortraits;

      // Start fetch in a microtask so we can return the state update first
      setTimeout(() => {
        if (abortRef.current) abortRef.current.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        fetch('/api/generate-videos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: sid, scenes, style, mood, options: currentOptions, moodBoard: currentMoodBoard, storyboardImages: currentStoryboard, characterPortraits: currentPortraits }),
          signal: controller.signal,
        })
          .then(async (response) => {
            log('client', { type: 'http-response', endpoint: '/api/generate-videos', status: response.status });
            if (response.status === 402) {
              const data = await response.json();
              log('client', { type: 'credit-error', endpoint: '/api/generate-videos', required: data.required, available: data.available });
              setState(p => ({
                ...p,
                status: 'error',
                error: `Insufficient credits. Need ${data.required?.toLocaleString()}, have ${data.available?.toLocaleString()}. Request more from an admin.`,
              }));
              return;
            }
            if (!response.ok) {
              log('client', { type: 'http-error', endpoint: '/api/generate-videos', status: response.status });
              throw new Error(`HTTP ${response.status}`);
            }

            await readSSEStream(response, (data) => {
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

              setState(p => ({ ...p, progress: [...p.progress, progressEvent] }));

              switch (data.type) {
                case 'video-complete':
                  if (data.video) {
                    setState(p => ({ ...p, videos: [...p.videos, data.video!] }));
                    window.dispatchEvent(new Event('credits-changed'));
                  }
                  break;
                case 'complete':
                  setState(p => ({ ...p, status: 'complete' }));
                  break;
                case 'error':
                  if (data.sceneIndex !== undefined && data.sceneIndex !== null) {
                    // Per-shot error — track the failed shot
                    setState(p => {
                      const next = new Set(p.failedShots);
                      next.add(data.sceneIndex!);
                      return { ...p, failedShots: next };
                    });
                  } else {
                    setState(p => ({ ...p, status: 'error', error: data.message || 'Unknown error' }));
                  }
                  break;
              }
            });
          })
          .catch((error) => {
            if (error instanceof DOMException && error.name === 'AbortError') return;
            setState(p => ({
              ...p,
              status: 'error',
              error: error instanceof Error ? error.message : 'Unknown error',
            }));
          });
      }, 0);

      return { ...prev, status: 'generating-videos', failedShots: new Set() };
    });
  }, [options]);

  const rerunShot = useCallback((sceneIndex: number) => {
    const scene = state.editableScenes?.[sceneIndex];
    if (!scene) return;

    log('client', { type: 'rerun-start', shot: sceneIndex + 1, duration: scene.duration, promptLength: scene.prompt.length });
    const style = state.generatedIdea?.style || '';
    const mood = state.generatedIdea?.mood || '';
    const sid = sessionIdRef.current;

    setRerunningShots(prev => new Set(prev).add(sceneIndex));

    fetch('/api/generate-videos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: sid,
        scenes: [{ prompt: scene.prompt, dialogue: scene.dialogue, duration: scene.duration }],
        style,
        mood,
        options,
        storyboardImages: state.storyboardImages ? [state.storyboardImages[sceneIndex]] : undefined,
        characterPortraits: state.characterPortraits,
      }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        await readSSEStream(response, (data) => {
          if (data.type === 'video-complete' && data.video) {
            setState(prev => {
              const newVideos = [...prev.videos];
              // Replace the video at this scene index, or append if not found
              const existingIdx = newVideos.findIndex((_, i) => i === sceneIndex);
              if (existingIdx >= 0) {
                newVideos[existingIdx] = data.video!;
              } else {
                newVideos.push(data.video!);
              }
              // Clear from failed shots
              const nextFailed = new Set(prev.failedShots);
              nextFailed.delete(sceneIndex);
              return { ...prev, videos: newVideos, failedShots: nextFailed };
            });
          }
        });
      })
      .catch((error) => {
        console.error(`Failed to re-run shot ${sceneIndex + 1}:`, error);
      })
      .finally(() => {
        setRerunningShots(prev => {
          const next = new Set(prev);
          next.delete(sceneIndex);
          return next;
        });
      });
  }, [state.editableScenes, state.generatedIdea, options]);

  const clearGeneration = useCallback(() => {
    setState(prev => ({
      ...prev,
      generatedIdea: null,
      scenes: null,
      editableScenes: null,
      videos: [],
      progress: [],
      error: null,
      failedShots: new Set(),
      moodBoard: [],
      storyboardImages: [],
      characterPortraits: {},
      characters: [],
      selectedMoodBoardIndex: null,
      moodBoardHistory: [],
      status: 'idle',
    }));
  }, []);

  const handleReset = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    sessionIdRef.current = '';
    setState({
      status: 'idle', idea: '', generatedIdea: null,
      scenes: null, editableScenes: null, videos: [], progress: [], error: null,
      failedShots: new Set(), moodBoard: [], storyboardImages: [], characterPortraits: {},
      characters: [], selectedMoodBoardIndex: null, moodBoardHistory: [],
    });
  }, []);

  const isGenerating = state.status === 'generating' || state.status === 'generating-videos';

  return (
    <StoryboardContext.Provider value={{
      state, options, sessionId: sessionIdRef.current,
      setIdea, setOptions, updateScenePrompt, updateSceneDialogue, removeScene,
      startModeGeneration, startDirectGeneration, handleGenerateVideos, handleReset, clearGeneration,
      isGenerating,
      rerunShot, rerunningShots,
      setReferenceImageSlot, clearReferenceImageSlot, removeReferenceImageSlot, addEmptySlot, resetReferenceImages,
      customPrompts, updateModeCustomization, restoreModeDefault,
      history, deleteHistoryEntry, clearHistory, loadFromHistory,
      selectedMoodBoardIndex: state.selectedMoodBoardIndex,
      selectMoodBoardImage, refineMoodBoard, undoMoodBoardRefinement, continuePastMoodBoard,
      isRefining, canUndoMoodBoard: state.moodBoardHistory.length > 0,
      portraitModalCharacter, openPortraitModal, closePortraitModal,
      regeneratePortrait, isRegeneratingPortrait,
      continuePastCharacters,
    }}>
      {children}
    </StoryboardContext.Provider>
  );
}
