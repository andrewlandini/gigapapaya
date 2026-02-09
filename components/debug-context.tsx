'use client';

import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';

const STORAGE_KEY = 'gp_debug_mode';

interface DebugContextValue {
  debugMode: boolean;
  toggleDebugMode: () => void;
  logs: DebugLogEntry[];
  pushLog: (entry: DebugLogEntry) => void;
  clearLogs: () => void;
}

export interface DebugLogEntry {
  timestamp: number;
  source: string;
  raw: Record<string, unknown>;
}

const DebugContext = createContext<DebugContextValue | null>(null);

export function useDebug() {
  const ctx = useContext(DebugContext);
  if (!ctx) throw new Error('useDebug must be used within DebugProvider');
  return ctx;
}

export function DebugProvider({ children }: { children: ReactNode }) {
  const [debugMode, setDebugMode] = useState(false);
  const [logs, setLogs] = useState<DebugLogEntry[]>([]);

  // Read persisted state after mount to avoid hydration mismatch
  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === '1') setDebugMode(true);
    } catch {}
  }, []);
  // Keep a ref so pushLog callback never goes stale
  const logsRef = useRef(logs);
  logsRef.current = logs;

  const toggleDebugMode = useCallback(() => {
    setDebugMode(prev => {
      const next = !prev;
      try { localStorage.setItem(STORAGE_KEY, next ? '1' : '0'); } catch {}
      return next;
    });
  }, []);

  const pushLog = useCallback((entry: DebugLogEntry) => {
    setLogs(prev => [...prev, entry]);
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  return (
    <DebugContext.Provider value={{ debugMode, toggleDebugMode, logs, pushLog, clearLogs }}>
      {children}
    </DebugContext.Provider>
  );
}
