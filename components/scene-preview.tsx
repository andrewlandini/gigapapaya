'use client';

import { ChevronDown } from 'lucide-react';
import type { Scene } from '@/lib/types';

interface ScenePreviewProps {
  scenes: Scene[];
}

export function ScenePreview({ scenes }: ScenePreviewProps) {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-medium text-[#ededed]">Scenes</h2>

      <div className="grid gap-2">
        {scenes.map((scene, i) => (
          <div
            key={i}
            className="border border-[#222] rounded-xl p-4 hover:border-[#333] transition-colors animate-fade-in"
            style={{ animationDelay: `${i * 100}ms` }}
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-md bg-[#1a1a1a] border border-[#333] text-[#888] flex items-center justify-center text-xs font-mono">
                {i + 1}
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                <p className="text-sm text-[#ccc] leading-relaxed">{scene.prompt}</p>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-[#444]">{scene.duration}s</span>
                  {scene.notes && (
                    <details className="group">
                      <summary className="text-xs text-[#444] cursor-pointer hover:text-[#888] flex items-center gap-1">
                        <ChevronDown className="h-3 w-3 group-open:rotate-180 transition-transform" />
                        notes
                      </summary>
                      <p className="mt-2 text-xs font-mono text-[#555] bg-[#111] p-3 rounded-lg border border-[#222]">
                        {scene.notes}
                      </p>
                    </details>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
