'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

interface CreditsContextValue {
  credits: number | null;
  creditsResetAt: string | null;
  refreshCredits: () => Promise<void>;
}

const CreditsContext = createContext<CreditsContextValue>({
  credits: null,
  creditsResetAt: null,
  refreshCredits: async () => {},
});

export function useCredits() {
  return useContext(CreditsContext);
}

export function CreditsProvider({ children, isAuthenticated }: { children: ReactNode; isAuthenticated: boolean }) {
  const [credits, setCredits] = useState<number | null>(null);
  const [creditsResetAt, setCreditsResetAt] = useState<string | null>(null);

  const refreshCredits = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await fetch('/api/credits');
      if (res.ok) {
        const data = await res.json();
        setCredits(data.credits);
        setCreditsResetAt(data.creditsResetAt);
      }
    } catch {}
  }, [isAuthenticated]);

  useEffect(() => {
    refreshCredits();
  }, [refreshCredits]);

  // Listen for credits-changed events from generation contexts
  useEffect(() => {
    const handler = () => refreshCredits();
    window.addEventListener('credits-changed', handler);
    return () => window.removeEventListener('credits-changed', handler);
  }, [refreshCredits]);

  return (
    <CreditsContext.Provider value={{ credits, creditsResetAt, refreshCredits }}>
      {children}
    </CreditsContext.Provider>
  );
}
