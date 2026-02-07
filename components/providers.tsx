'use client';

import type { ReactNode } from 'react';
import { GenerationProvider } from './generation-context';
import { StoryboardProvider } from './storyboard-context';
import { AvatarProvider } from './avatar-context';
import { ToastProvider } from './toast';
import { DebugProvider } from './debug-context';

export function Providers({ initialAvatarUrl, children }: { initialAvatarUrl?: string | null; children: ReactNode }) {
  return (
    <ToastProvider>
      <AvatarProvider initialUrl={initialAvatarUrl || null}>
        <DebugProvider>
          <GenerationProvider>
            <StoryboardProvider>
              {children}
            </StoryboardProvider>
          </GenerationProvider>
        </DebugProvider>
      </AvatarProvider>
    </ToastProvider>
  );
}
