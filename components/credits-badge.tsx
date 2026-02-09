'use client';

import { useCredits } from './credits-context';

export function CreditsBadge({ isAuthenticated }: { isAuthenticated: boolean }) {
  const { credits } = useCredits();

  if (!isAuthenticated || credits === null) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#111]/90 border border-[#222] backdrop-blur-sm">
      <span className="text-xs font-mono text-[#00DC82]">{credits.toLocaleString()}</span>
      <span className="text-xs font-mono text-[#555]">credits</span>
    </div>
  );
}
