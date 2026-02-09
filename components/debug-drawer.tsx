'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { X, Trash2, Copy, Check, GripVertical } from 'lucide-react';
import { useDebug } from './debug-context';

export function DebugDrawer() {
  const { debugMode, toggleDebugMode, logs, clearLogs } = useDebug();
  const containerRef = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  // Position & size
  const [pos, setPos] = useState({ x: 80, y: 200 });
  const [size, setSize] = useState({ w: 700, h: 380 });
  const [copied, setCopied] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  // Dragging
  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  // Resizing
  const resizing = useRef(false);
  const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0 });

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (dragging.current) {
      setPos({ x: e.clientX - dragOffset.current.x, y: e.clientY - dragOffset.current.y });
    }
    if (resizing.current) {
      const dw = e.clientX - resizeStart.current.x;
      const dh = e.clientY - resizeStart.current.y;
      setSize({
        w: Math.max(400, resizeStart.current.w + dw),
        h: Math.max(200, resizeStart.current.h + dh),
      });
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    dragging.current = false;
    resizing.current = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // Auto-scroll to bottom on new logs
  useEffect(() => {
    if (containerRef.current && logs.length > 0) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs.length]);

  // Reset confirm clear after timeout
  useEffect(() => {
    if (confirmClear) {
      const t = setTimeout(() => setConfirmClear(false), 3000);
      return () => clearTimeout(t);
    }
  }, [confirmClear]);

  if (!debugMode) return null;

  const startDrag = (e: React.MouseEvent) => {
    dragging.current = true;
    dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
  };

  const startResize = (e: React.MouseEvent) => {
    e.stopPropagation();
    resizing.current = true;
    resizeStart.current = { x: e.clientX, y: e.clientY, w: size.w, h: size.h };
    document.body.style.cursor = 'se-resize';
    document.body.style.userSelect = 'none';
  };

  const handleCopy = () => {
    const text = logs.map(entry => {
      const time = new Date(entry.timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 } as any);
      return `${time} [${entry.source}] ${formatLogValue(entry.raw)}`;
    }).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClear = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    clearLogs();
    setConfirmClear(false);
  };

  return (
    <div
      ref={drawerRef}
      className="fixed z-[100] rounded-xl border border-[#333] bg-[#0a0a0a]/90 backdrop-blur-md shadow-2xl flex flex-col overflow-hidden"
      style={{ left: pos.x, top: pos.y, width: size.w, height: size.h }}
    >
      {/* Header — draggable */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b border-[#222] flex-shrink-0 cursor-grab active:cursor-grabbing select-none"
        onMouseDown={startDrag}
      >
        <div className="flex items-center gap-2">
          <GripVertical className="h-3 w-3 text-[#444]" />
          <span className="text-[10px] font-mono text-[#ff8800] font-bold uppercase tracking-wider">Debug Console</span>
          <span className="text-[10px] font-mono text-[#555]">{logs.length} events</span>
        </div>
        <div className="flex items-center gap-1" onMouseDown={e => e.stopPropagation()}>
          <button
            onClick={handleCopy}
            className="p-1 text-[#555] hover:text-[#999] transition-colors"
            title="Copy all logs"
          >
            {copied ? <Check className="h-3 w-3 text-[#00DC82]" /> : <Copy className="h-3 w-3" />}
          </button>
          <button
            onClick={handleClear}
            className={`p-1 transition-colors ${confirmClear ? 'text-[#ff4444]' : 'text-[#555] hover:text-[#999]'}`}
            title={confirmClear ? 'Click again to confirm' : 'Clear logs'}
          >
            <Trash2 className="h-3 w-3" />
          </button>
          {confirmClear && (
            <span className="text-[9px] font-mono text-[#ff4444] animate-pulse">confirm?</span>
          )}
          <button
            onClick={toggleDebugMode}
            className="p-1 text-[#555] hover:text-[#999] transition-colors"
            title="Close"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Log content */}
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

      {/* Resize handle — bottom right corner */}
      <div
        className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize flex items-center justify-center"
        onMouseDown={startResize}
      >
        <svg width="8" height="8" viewBox="0 0 8 8" className="text-[#444]">
          <path d="M7 1L1 7M7 4L4 7M7 7L7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
}

function formatLogValue(raw: Record<string, unknown>): string {
  const { type, ...rest } = raw;
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
