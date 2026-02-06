'use client';

import { useMemo } from 'react';
import { CheckCircle2, Loader2, AlertCircle, ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { ProgressEvent } from '@/lib/types';

interface ProgressTrackerProps {
  events: ProgressEvent[];
}

interface TrackerEntry {
  type: 'agent' | 'video' | 'log' | 'complete' | 'error';
  key: string;
  label: string;
  status: 'running' | 'done' | 'error';
  message: string;
  timestamp: Date;
  prompt?: string;
  result?: any;
}

export function ProgressTracker({ events }: ProgressTrackerProps) {
  // Consolidate events into entries: merge start/complete per agent/video
  const entries = useMemo(() => {
    const result: TrackerEntry[] = [];
    const agentMap = new Map<string, number>(); // agent name -> index in result
    const videoMap = new Map<number, number>(); // sceneIndex -> index in result

    for (const event of events) {
      if (event.type === 'agent-log') {
        result.push({
          type: 'log',
          key: `log-${result.length}`,
          label: '',
          status: 'done',
          message: event.status || event.message || '',
          timestamp: event.timestamp,
        });
        continue;
      }

      if (event.type === 'agent-start' && event.agent) {
        const label = event.agent === 'idea' ? 'Concept Agent' : event.agent === 'scenes' ? 'Scene Agent' : 'Video Agent';
        const idx = result.length;
        agentMap.set(event.agent, idx);
        result.push({
          type: 'agent',
          key: `agent-${event.agent}`,
          label,
          status: 'running',
          message: event.status || '',
          timestamp: event.timestamp,
        });
        continue;
      }

      if (event.type === 'agent-complete' && event.agent) {
        const idx = agentMap.get(event.agent);
        if (idx !== undefined) {
          // Update existing entry
          result[idx].status = 'done';
          result[idx].result = event.result;
          if (event.result?.title) {
            result[idx].message = event.result.title;
          } else if (event.result?.scenes) {
            result[idx].message = `${event.result.scenes.length} scenes generated`;
          }
        }
        continue;
      }

      if (event.type === 'video-start') {
        const sceneIdx = event.sceneIndex ?? 0;
        const idx = result.length;
        videoMap.set(sceneIdx, idx);
        result.push({
          type: 'video',
          key: `video-${sceneIdx}`,
          label: `Video ${sceneIdx + 1}`,
          status: 'running',
          message: event.status || '',
          timestamp: event.timestamp,
          prompt: event.prompt,
        });
        continue;
      }

      if (event.type === 'video-complete') {
        const sceneIdx = event.sceneIndex ?? 0;
        const idx = videoMap.get(sceneIdx);
        if (idx !== undefined) {
          result[idx].status = 'done';
          result[idx].message = 'Generated successfully';
        }
        continue;
      }

      if (event.type === 'complete') {
        result.push({
          type: 'complete',
          key: `complete-${result.length}`,
          label: 'Complete',
          status: 'done',
          message: 'All videos generated',
          timestamp: event.timestamp,
        });
        continue;
      }

      if (event.type === 'error') {
        // Scene-level errors update the video entry
        if (event.sceneIndex !== undefined && event.sceneIndex !== null) {
          const idx = videoMap.get(event.sceneIndex);
          if (idx !== undefined) {
            result[idx].status = 'error';
            result[idx].message = event.message || 'Failed';
          }
          continue;
        }
        result.push({
          type: 'error',
          key: `error-${result.length}`,
          label: 'Error',
          status: 'error',
          message: event.message || 'Unknown error',
          timestamp: event.timestamp,
        });
        continue;
      }

      // Fallback for scenes-ready or other unknown types
      if ((event.type as string) === 'scenes-ready') {
        continue; // handled by the component state, no need to show
      }

      result.push({
        type: 'log',
        key: `other-${result.length}`,
        label: 'Processing',
        status: 'running',
        message: event.status || event.message || '',
        timestamp: event.timestamp,
      });
    }

    return result;
  }, [events]);

  if (entries.length === 0) return null;

  const hasRunning = entries.some(e => e.status === 'running');

  return (
    <div className="space-y-0">
      <div className="flex items-center gap-2 mb-3">
        <div className={`h-2 w-2 rounded-full ${hasRunning ? 'bg-[#00cc88] animate-pulse-dot' : 'bg-[#00cc88]'}`} />
        <span className="text-xs font-mono text-[#666] uppercase tracking-wider">
          {hasRunning ? 'Live' : 'Done'}
        </span>
      </div>

      <div className="border border-[#222] rounded-xl overflow-hidden">
        {entries.map((entry, i) => (
          entry.type === 'log' ? (
            <div
              key={entry.key}
              className="flex items-center gap-2 px-4 py-1.5 border-b border-[#181818] last:border-b-0 animate-fade-in"
              style={{ animationDelay: `${i * 30}ms` }}
            >
              <span className="text-[#333] font-mono text-[10px] flex-shrink-0">&gt;</span>
              <p className="text-xs font-mono text-[#555] truncate">{entry.message}</p>
            </div>
          ) : (
            <div
              key={entry.key}
              className="flex items-start gap-3 px-4 py-3 border-b border-[#222] last:border-b-0 animate-fade-in"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="mt-0.5">
                {entry.status === 'error' ? (
                  <AlertCircle className="h-4 w-4 text-[#ff4444] flex-shrink-0" />
                ) : entry.status === 'done' ? (
                  <CheckCircle2 className="h-4 w-4 text-[#00cc88] flex-shrink-0" />
                ) : (
                  <Loader2 className="h-4 w-4 text-[#888] animate-spin flex-shrink-0" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-[#ededed]">{entry.label}</span>
                  <Badge variant={entry.status === 'error' ? 'error' : entry.status === 'done' ? 'success' : 'blue'}>
                    {entry.status === 'running' ? 'running' : entry.status === 'done' ? 'done' : 'error'}
                  </Badge>
                  <span className="text-xs font-mono text-[#444] ml-auto flex-shrink-0">
                    {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
                {entry.message && (
                  <p className="text-xs text-[#666] mt-1 truncate">{entry.message}</p>
                )}
                {entry.type === 'video' && entry.prompt && (
                  <details className="mt-2 group">
                    <summary className="text-xs text-[#444] cursor-pointer hover:text-[#888] flex items-center gap-1">
                      <ChevronDown className="h-3 w-3 group-open:rotate-180 transition-transform" />
                      prompt
                    </summary>
                    <p className="mt-2 text-xs font-mono text-[#555] bg-[#111] p-3 rounded-lg border border-[#222] leading-relaxed">
                      {entry.prompt}
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
