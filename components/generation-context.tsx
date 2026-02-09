'use client';

import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react';
import type { SSEMessage, Video } from '@/lib/types';
import { useDebug } from './debug-context';

export interface Draft {
  id: string;
  prompt: string;
  status: 'generating' | 'complete' | 'error';
  options: {
    aspectRatio: string;
    duration: number;
  };
  videos: Video[];
  error: string | null;
  createdAt: Date;
}

interface GenerationContextValue {
  drafts: Draft[];
  activeDraftCount: number;
  startGeneration: (prompt: string, options: { aspectRatio: string; duration: number }) => void;
  clearDraft: (id: string) => void;
  clearCompletedDrafts: () => void;
}

const GenerationContext = createContext<GenerationContextValue>({
  drafts: [],
  activeDraftCount: 0,
  startGeneration: () => {},
  clearDraft: () => {},
  clearCompletedDrafts: () => {},
});

export function useGeneration() {
  return useContext(GenerationContext);
}

export function GenerationProvider({ children }: { children: ReactNode }) {
  const { pushLog } = useDebug();
  const pushLogRef = useRef(pushLog);
  pushLogRef.current = pushLog;
  const log = (source: string, raw: Record<string, unknown>) => {
    pushLogRef.current({ timestamp: Date.now(), source, raw });
  };

  const [drafts, setDrafts] = useState<Draft[]>([]);
  const abortControllers = useRef<Map<string, AbortController>>(new Map());

  const startGeneration = useCallback((prompt: string, options: { aspectRatio: string; duration: number }) => {
    const id = crypto.randomUUID();
    const controller = new AbortController();
    abortControllers.current.set(id, controller);

    const draft: Draft = {
      id,
      prompt,
      status: 'generating',
      options,
      videos: [],
      error: null,
      createdAt: new Date(),
    };

    log('quick-gen', { type: 'generation-start', mode: 'direct', prompt, aspectRatio: options.aspectRatio, duration: options.duration, draftId: id });
    setDrafts(prev => [draft, ...prev]);

    // Start SSE connection in background
    fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idea: prompt,
        options: { ...options, mode: 'direct', numScenes: 1 },
      }),
      signal: controller.signal,
    })
      .then(async (response) => {
        log('quick-gen', { type: 'http-response', endpoint: '/api/generate', status: response.status });
        if (response.status === 402) {
          const data = await response.json();
          log('quick-gen', { type: 'credit-error', required: data.required, available: data.available });
          setDrafts(prev =>
            prev.map(d =>
              d.id === id
                ? { ...d, status: 'error' as const, error: `Insufficient credits. Need ${data.required?.toLocaleString()}, have ${data.available?.toLocaleString()}.` }
                : d
            )
          );
          return;
        }
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
              log('quick-gen', { type: 'sse-event', eventType: data.type, agent: data.agent, status: data.status, message: data.message });

              if (data.type === 'complete') {
                setDrafts(prev =>
                  prev.map(d =>
                    d.id === id
                      ? { ...d, status: 'complete' as const, videos: data.videos || [] }
                      : d
                  )
                );
                window.dispatchEvent(new Event('credits-changed'));
              } else if (data.type === 'error' && !data.sceneIndex && data.sceneIndex !== 0) {
                setDrafts(prev =>
                  prev.map(d =>
                    d.id === id
                      ? { ...d, status: 'error' as const, error: data.message || 'Generation failed' }
                      : d
                  )
                );
              }
            }
          }
        }

        abortControllers.current.delete(id);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setDrafts(prev =>
          prev.map(d =>
            d.id === id
              ? { ...d, status: 'error' as const, error: err.message || 'Generation failed' }
              : d
          )
        );
        abortControllers.current.delete(id);
      });
  }, []);

  const clearDraft = useCallback((id: string) => {
    const controller = abortControllers.current.get(id);
    if (controller) {
      controller.abort();
      abortControllers.current.delete(id);
    }
    setDrafts(prev => prev.filter(d => d.id !== id));
  }, []);

  const clearCompletedDrafts = useCallback(() => {
    setDrafts(prev => prev.filter(d => d.status === 'generating'));
  }, []);

  const activeDraftCount = drafts.filter(d => d.status === 'generating').length;

  return (
    <GenerationContext.Provider value={{ drafts, activeDraftCount, startGeneration, clearDraft, clearCompletedDrafts }}>
      {children}
    </GenerationContext.Provider>
  );
}
