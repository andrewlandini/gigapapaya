'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface AvatarContextValue {
  avatarUrl: string | null;
  setAvatarUrl: (url: string | null) => void;
}

const AvatarContext = createContext<AvatarContextValue>({
  avatarUrl: null,
  setAvatarUrl: () => {},
});

export function useAvatar() {
  return useContext(AvatarContext);
}

export function AvatarProvider({ initialUrl, children }: { initialUrl: string | null; children: ReactNode }) {
  const [avatarUrl, setAvatarUrlState] = useState<string | null>(initialUrl);

  const setAvatarUrl = useCallback((url: string | null) => {
    setAvatarUrlState(url);
  }, []);

  return (
    <AvatarContext.Provider value={{ avatarUrl, setAvatarUrl }}>
      {children}
    </AvatarContext.Provider>
  );
}
