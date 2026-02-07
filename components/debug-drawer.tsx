'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { useDebug } from './debug-context';

export function DebugDrawer() {
  const { debugMode, toggleDebugMode, logs, clearLogs } = useDebug();
  const [minimized, setMinimized] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new logs (scoped to container)
  useEffect(() => {
    if (!minimized && containerRef.current && logs.length > 0) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs.length, minimized]);

  if (!debugMode) return null;

  return (
    <div className="fixed bottom-0 left-[60px] right-0 z-50 border-t border-[#333] bg-[#0a0a0a] flex flex-col"
      style={{ height: minimized ? '36px' : '280px' }}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#222] flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-[#ff8800] font-bold uppercase tracking-wider">Debug Log</span>
          <span className="text-[10px] font-mono text-[#555]">{logs.length} events</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={clearLogs} className="p-1 text-[#555] hover:text-[#999] transition-colors" title="Clear logs">
            <Trash2 className="h-3 w-3" />
          </button>
          <button onClick={() => setMinimized(m => !m)} className="p-1 text-[#555] hover:text-[#999] transition-colors" title={minimized ? 'Expand' : 'Minimize'}>
            {minimized ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
          <button onClick={toggleDebugMode} className="p-1 text-[#555] hover:text-[#999] transition-colors" title="Close debug panel">
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Log content */}
      {!minimized && (
        <div ref={containerRef} className="flex-1 overflow-y-auto p-2 space-y-0">
          {logs.length === 0 && (
            <p className="text-[10px] font-mono text-[#444] py-4 text-center">
              Waiting for events... Start a generation on /storyboard to see logs.
            </p>
          )}
          {logs.map((entry, i) => {
            const time = new Date(entry.timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 } as any);
            const type = (entry.raw.type as string) || '?';
            const isError = type === 'error';
            const isDebug = typeof entry.raw.status === 'string' && (entry.raw.status as string).startsWith('[DEBUG]');
            return (
              <div key={i} className="flex gap-2 leading-tight py-[1px]">
                <span className="text-[10px] font-mono text-[#444] flex-shrink-0 w-[72px]">{time}</span>
                <span className="text-[10px] font-mono text-[#666] flex-shrink-0 w-[60px] truncate">{entry.source}</span>
                <span className={`text-[10px] font-mono flex-shrink-0 w-[100px] truncate ${isError ? 'text-[#ff4444]' : isDebug ? 'text-[#ff8800]' : 'text-[#0070f3]'}`}>
                  {type}
                </span>
                <span className={`text-[10px] font-mono flex-1 break-all ${isError ? 'text-[#ff6666]' : isDebug ? 'text-[#996600]' : 'text-[#777]'}`}>
                  {formatLogValue(entry.raw)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatLogValue(raw: Record<string, unknown>): string {
  const { type, ...rest } = raw;
  // Show the most useful fields inline
  const parts: string[] = [];
  if (rest.agent) parts.push(`agent=${rest.agent}`);
  if (rest.status) parts.push(String(rest.status));
  else if (rest.message) parts.push(String(rest.message));
  if (rest.sceneIndex !== undefined) parts.push(`shot=${Number(rest.sceneIndex) + 1}`);
  if (rest.prompt && !rest.status) parts.push(`prompt="${String(rest.prompt).substring(0, 120)}..."`);
  if (rest.videoId) parts.push(`videoId=${rest.videoId}`);
  if (rest.video && typeof rest.video === 'object') {
    const v = rest.video as Record<string, unknown>;
    if (v.url) parts.push(`url=${v.url}`);
    if (v.size) parts.push(`${((v.size as number) / (1024 * 1024)).toFixed(1)}MB`);
  }
  if (rest.moodBoard && Array.isArray(rest.moodBoard)) parts.push(`${rest.moodBoard.length} mood board images`);
  if (rest.storyboardImages && Array.isArray(rest.storyboardImages)) parts.push(`${(rest.storyboardImages as unknown[]).filter(Boolean).length} storyboard frames`);
  if (rest.sessionId) parts.push(`session=${rest.sessionId}`);
  if (parts.length === 0) parts.push(JSON.stringify(rest));
  return parts.join(' | ');
}
