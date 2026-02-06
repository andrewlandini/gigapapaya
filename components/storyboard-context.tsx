'use client';

import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from 'react';
import type { GenerationState, GenerationOptions, SSEMessage, ProgressEvent, AgentConfig } from '@/lib/types';
import { GENERATION_MODES, getModeById } from '@/lib/generation-modes';

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
  removeScene: (index: number) => void;
  startModeGeneration: (modeId: string) => void;
  handleGenerateVideos: () => void;
  handleReset: () => void;
  clearGeneration: () => void;
  isGenerating: boolean;
  // Per-mode custom prompts
  customPrompts: CustomPrompts;
  updateModeCustomization: (modeId: string, field: keyof ModeCustomization, value: string) => void;
  restoreModeDefault: (modeId: string, agent: 'idea' | 'scene') => void;
  // History
  history: HistoryEntry[];
  deleteHistoryEntry: (id: string) => void;
  clearHistory: () => void;
  loadFromHistory: (prompt: string) => void;
}

const StoryboardContext = createContext<StoryboardContextValue | null>(null);

export function useStoryboard() {
  const ctx = useContext(StoryboardContext);
  if (!ctx) throw new Error('useStoryboard must be used within StoryboardProvider');
  return ctx;
}

export function StoryboardProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GenerationState>({
    status: 'idle',
    idea: '',
    generatedIdea: null,
    scenes: null,
    editableScenes: null,
    videos: [],
    progress: [],
    error: null,
  });

  const [options, setOptionsState] = useState<GenerationOptions>({
    aspectRatio: '16:9',
    duration: 8,
    numScenes: 3,
    mode: 'agents',
  });

  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [customPrompts, setCustomPrompts] = useState<CustomPrompts>({});
  const sessionIdRef = useRef<string>('');

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

  const removeScene = useCallback((index: number) => {
    setState(prev => ({
      ...prev,
      editableScenes: prev.editableScenes?.filter((_, i) => i !== index) || null,
    }));
  }, []);

  // SSE stream reader
  const readSSEStream = async (response: Response, onEvent: (data: SSEMessage) => void) => {
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
          onEvent(data);
        }
      }
    }
  };

  const startModeGeneration = useCallback((modeId: string) => {
    const idea = state.idea.trim();
    if (!idea) return;

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
    }));

    const agentConfig = getAgentConfigForMode(modeId);
    const currentOptions = {
      ...options,
      mode: 'agents' as const,
      ideaAgent: agentConfig.ideaAgent,
      sceneAgent: agentConfig.sceneAgent,
    };

    fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idea, options: currentOptions }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

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
            case 'agent-complete':
              if (data.agent === 'idea') {
                setState(prev => ({ ...prev, generatedIdea: data.result }));
              } else if (data.agent === 'scenes') {
                setState(prev => ({ ...prev, scenes: data.result.scenes }));
              }
              break;
            case 'scenes-ready':
              sessionIdRef.current = data.sessionId || '';
              setState(prev => ({
                ...prev,
                status: 'reviewing',
                editableScenes: prev.scenes ? prev.scenes.map(s => ({ ...s })) : null,
              }));
              break;
            case 'complete':
              setState(prev => ({ ...prev, status: 'complete', videos: data.videos || [] }));
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

  const handleGenerateVideos = useCallback(() => {
    setState(prev => {
      if (!prev.editableScenes) return prev;

      const scenes = prev.editableScenes.map(s => ({ prompt: s.prompt, duration: s.duration }));
      const style = prev.generatedIdea?.style || '';
      const mood = prev.generatedIdea?.mood || '';
      const sid = sessionIdRef.current;
      const currentOptions = options;

      // Start fetch in a microtask so we can return the state update first
      setTimeout(() => {
        fetch('/api/generate-videos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: sid, scenes, style, mood, options: currentOptions }),
        })
          .then(async (response) => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

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
                  }
                  break;
                case 'complete':
                  setState(p => ({ ...p, status: 'complete' }));
                  break;
                case 'error':
                  if (!data.sceneIndex && data.sceneIndex !== 0) {
                    setState(p => ({ ...p, status: 'error', error: data.message || 'Unknown error' }));
                  }
                  break;
              }
            });
          })
          .catch((error) => {
            setState(p => ({
              ...p,
              status: 'error',
              error: error instanceof Error ? error.message : 'Unknown error',
            }));
          });
      }, 0);

      return { ...prev, status: 'generating-videos' };
    });
  }, [options]);

  const clearGeneration = useCallback(() => {
    setState(prev => ({
      ...prev,
      generatedIdea: null,
      scenes: null,
      editableScenes: null,
      videos: [],
      progress: [],
      error: null,
      status: 'idle',
    }));
  }, []);

  const handleReset = useCallback(() => {
    sessionIdRef.current = '';
    setState({
      status: 'idle', idea: '', generatedIdea: null,
      scenes: null, editableScenes: null, videos: [], progress: [], error: null,
    });
  }, []);

  const isGenerating = state.status === 'generating' || state.status === 'generating-videos';

  return (
    <StoryboardContext.Provider value={{
      state, options, sessionId: sessionIdRef.current,
      setIdea, setOptions, updateScenePrompt, removeScene,
      startModeGeneration, handleGenerateVideos, handleReset, clearGeneration,
      isGenerating,
      customPrompts, updateModeCustomization, restoreModeDefault,
      history, deleteHistoryEntry, clearHistory, loadFromHistory,
    }}>
      {children}
    </StoryboardContext.Provider>
  );
}
