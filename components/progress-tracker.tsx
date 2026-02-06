'use client';

import { CheckCircle2, Loader2, AlertCircle, ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { ProgressEvent } from '@/lib/types';

interface ProgressTrackerProps {
  events: ProgressEvent[];
}

export function ProgressTracker({ events }: ProgressTrackerProps) {
  if (events.length === 0) return null;

  const getIcon = (event: ProgressEvent) => {
    if (event.type === 'error') {
      return <AlertCircle className="h-4 w-4 text-[#ff4444] flex-shrink-0" />;
    }
    if (event.type === 'agent-log') {
      return <span className="h-4 w-4 flex items-center justify-center text-[#444] flex-shrink-0 font-mono text-[10px]">&gt;</span>;
    }
    if (event.type === 'agent-complete' || event.type === 'video-complete' || event.type === 'complete') {
      return <CheckCircle2 className="h-4 w-4 text-[#00cc88] flex-shrink-0" />;
    }
    return <Loader2 className="h-4 w-4 text-[#888] animate-spin flex-shrink-0" />;
  };

  const getLabel = (event: ProgressEvent) => {
    switch (event.type) {
      case 'agent-start':
        return event.agent === 'idea' ? 'Idea Agent' : event.agent === 'scenes' ? 'Scene Agent' : 'Video Agent';
      case 'agent-complete':
        return event.agent === 'idea' ? 'Idea Agent' : event.agent === 'scenes' ? 'Scene Agent' : 'Video Agent';
      case 'agent-log':
        return '';
      case 'video-start':
        return `Video ${(event.sceneIndex ?? 0) + 1}`;
      case 'video-complete':
        return `Video ${(event.sceneIndex ?? 0) + 1}`;
      case 'complete':
        return 'Complete';
      case 'error':
        return 'Error';
      default:
        return 'Processing';
    }
  };

  const getStatus = (event: ProgressEvent) => {
    if (event.status) return event.status;
    if (event.message) return event.message;
    if (event.type === 'agent-complete' && event.result) {
      if (event.result.title) return event.result.title;
      if (event.result.scenes) return `${event.result.scenes.length} scenes generated`;
    }
    if (event.type === 'video-complete') return 'Generated successfully';
    if (event.type === 'complete') return 'All videos generated';
    return '';
  };

  const getBadgeVariant = (event: ProgressEvent) => {
    if (event.type === 'error') return 'error' as const;
    if (event.type === 'agent-complete' || event.type === 'video-complete' || event.type === 'complete') return 'success' as const;
    return 'blue' as const;
  };

  return (
    <div className="space-y-0">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-2 w-2 rounded-full bg-[#00cc88] animate-pulse-dot" />
        <span className="text-xs font-mono text-[#666] uppercase tracking-wider">Live</span>
      </div>

      <div className="border border-[#222] rounded-xl overflow-hidden">
        {events.map((event, i) => (
          event.type === 'agent-log' ? (
            <div
              key={i}
              className="flex items-center gap-2 px-4 py-1.5 border-b border-[#181818] last:border-b-0 animate-fade-in"
              style={{ animationDelay: `${i * 30}ms` }}
            >
              <span className="text-[#333] font-mono text-[10px] flex-shrink-0">&gt;</span>
              <p className="text-xs font-mono text-[#555] truncate">{event.status}</p>
            </div>
          ) : (
            <div
              key={i}
              className="flex items-start gap-3 px-4 py-3 border-b border-[#222] last:border-b-0 animate-fade-in"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="mt-0.5">{getIcon(event)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-[#ededed]">{getLabel(event)}</span>
                  <Badge variant={getBadgeVariant(event)}>
                    {event.type.includes('start') ? 'running' : event.type.includes('complete') ? 'done' : event.type}
                  </Badge>
                  <span className="text-xs font-mono text-[#444] ml-auto flex-shrink-0">
                    {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
                {getStatus(event) && (
                  <p className="text-xs text-[#666] mt-1 truncate">{getStatus(event)}</p>
                )}
                {event.type === 'video-start' && event.prompt && (
                  <details className="mt-2 group">
                    <summary className="text-xs text-[#444] cursor-pointer hover:text-[#888] flex items-center gap-1">
                      <ChevronDown className="h-3 w-3 group-open:rotate-180 transition-transform" />
                      prompt
                    </summary>
                    <p className="mt-2 text-xs font-mono text-[#555] bg-[#111] p-3 rounded-lg border border-[#222] leading-relaxed">
                      {event.prompt}
                    </p>
                  </details>
                )}
              </div>
            </div>
          )
        ))}
      </div>
    </div>
  );
}
