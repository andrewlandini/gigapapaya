'use client';

import type { ReactNode } from 'react';
import { GenerationProvider } from './generation-context';
import { StoryboardProvider } from './storyboard-context';
import { AvatarProvider } from './avatar-context';
import { CreditsProvider } from './credits-context';
import { ToastProvider } from './toast';
import { DebugProvider } from './debug-context';

export function Providers({ initialAvatarUrl, isAuthenticated, children }: { initialAvatarUrl?: string | null; isAuthenticated: boolean; children: ReactNode }) {
  return (
    <ToastProvider>
      <AvatarProvider initialUrl={initialAvatarUrl || null}>
        <CreditsProvider isAuthenticated={isAuthenticated}>
          <DebugProvider>
            <GenerationProvider>
              <StoryboardProvider>
                {children}
              </StoryboardProvider>
            </GenerationProvider>
          </DebugProvider>
        </CreditsProvider>
      </AvatarProvider>
    </ToastProvider>
  );
}
