'use client';

import type { ReactNode } from 'react';
import { GenerationProvider } from './generation-context';
import { StoryboardProvider } from './storyboard-context';
import { ToastProvider } from './toast';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <GenerationProvider>
        <StoryboardProvider>
          {children}
        </StoryboardProvider>
      </GenerationProvider>
    </ToastProvider>
  );
}
