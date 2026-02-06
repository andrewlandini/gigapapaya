'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import { CheckCircle2, Loader2, AlertCircle, ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { ProgressEvent } from '@/lib/types';

interface ProgressTrackerProps {
  events: ProgressEvent[];
}

interface AgentGroup {
  key: string;
  label: string;
  status: 'running' | 'done' | 'error';
  message: string;
  timestamp: Date;
  logs: { key: string; message: string }[];
  prompt?: string;
  result?: any;
  type: 'agent' | 'video' | 'complete' | 'error';
}

export function ProgressTracker({ events }: ProgressTrackerProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [manualToggle, setManualToggle] = useState<Set<string>>(new Set());
  const collapsedByTimer = useRef<Set<string>>(new Set());

  const groups = useMemo(() => {
    const result: AgentGroup[] = [];
    let currentGroup: AgentGroup | null = null;

    for (const event of events) {
      if (event.type === 'agent-start' && event.agent) {
        const label = event.agent === 'idea' ? 'Concept Agent'
          : event.agent === 'scenes' ? 'Scene Agent'
          : event.agent === 'veo3-prompter' ? 'Veo 3 Prompter'
          : 'Video Agent';
        currentGroup = {
          key: `agent-${event.agent}`,
          label,
          status: 'running',
          message: event.status || '',
          timestamp: event.timestamp,
          logs: [],
          type: 'agent',
        };
        result.push(currentGroup);
        continue;
      }

      if (event.type === 'agent-complete' && event.agent) {
        const group = result.find(g => g.key === `agent-${event.agent}`);
        if (group) {
          group.status = 'done';
          group.result = event.result;
          if (event.result?.title) {
            group.message = event.result.title;
          } else if (event.result?.scenes) {
            group.message = `${event.result.scenes.length} scenes generated`;
          } else if (event.result?.optimizedPrompts) {
            group.message = `${event.result.optimizedPrompts.length} prompts optimized`;
          }
        }
        currentGroup = null;
        continue;
      }

      if (event.type === 'agent-log') {
        const msg = event.status || event.message || '';
        if (currentGroup) {
          currentGroup.logs.push({ key: `log-${result.length}-${currentGroup.logs.length}`, message: msg });
        } else {
          const lastGroup = result[result.length - 1];
          if (lastGroup) {
            lastGroup.logs.push({ key: `log-${result.length}-${lastGroup.logs.length}`, message: msg });
          }
        }
        continue;
      }

      if (event.type === 'video-start') {
        const sceneIdx = event.sceneIndex ?? 0;
        currentGroup = {
          key: `video-${sceneIdx}`,
          label: `Video ${sceneIdx + 1}`,
          status: 'running',
          message: event.status || '',
          timestamp: event.timestamp,
          logs: [],
          prompt: event.prompt,
          type: 'video',
        };
        result.push(currentGroup);
        continue;
      }

      if (event.type === 'video-complete') {
        const sceneIdx = event.sceneIndex ?? 0;
        const group = result.find(g => g.key === `video-${sceneIdx}`);
        if (group) {
          group.status = 'done';
          group.message = 'Generated successfully';
        }
        currentGroup = null;
        continue;
      }

      if (event.type === 'complete') {
        currentGroup = null;
        result.push({
          key: `complete-${result.length}`,
          label: 'Complete',
          status: 'done',
          message: 'All videos generated',
          timestamp: event.timestamp,
          logs: [],
          type: 'complete',
        });
        continue;
      }

      if (event.type === 'error') {
        if (event.sceneIndex !== undefined && event.sceneIndex !== null) {
          const group = result.find(g => g.key === `video-${event.sceneIndex}`);
          if (group) {
            group.status = 'error';
            group.message = event.message || 'Failed';
          }
          continue;
        }
        result.push({
          key: `error-${result.length}`,
          label: 'Error',
          status: 'error',
          message: event.message || 'Unknown error',
          timestamp: event.timestamp,
          logs: [],
          type: 'error',
        });
        continue;
      }

      if ((event.type as string) === 'scenes-ready') continue;
    }

    return result;
  }, [events]);

  // Auto-collapse completed agents after 3 seconds
  useEffect(() => {
    const doneGroups = groups.filter(g => g.status === 'done' && g.logs.length > 0);
    const timers: NodeJS.Timeout[] = [];

    for (const group of doneGroups) {
      if (!collapsedByTimer.current.has(group.key) && !manualToggle.has(group.key)) {
        collapsedByTimer.current.add(group.key);
        const timer = setTimeout(() => {
          setExpanded(prev => {
            const next = new Set(prev);
            if (!manualToggle.has(group.key)) {
              next.delete(group.key);
            }
            return next;
          });
        }, 3000);
        timers.push(timer);
      }
    }

    return () => timers.forEach(t => clearTimeout(t));
  }, [groups, manualToggle]);

  if (groups.length === 0) return null;

  const toggleExpand = (key: string) => {
    setManualToggle(prev => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="space-y-0 text-left">
      <div className="border border-[#222] rounded-xl overflow-hidden">
        {groups.map((group) => {
          const isRunning = group.status === 'running';
          const isExpanded = isRunning || expanded.has(group.key);
          const hasLogs = group.logs.length > 0;

          return (
            <div key={group.key} className="border-b border-[#222] last:border-b-0 animate-fade-in">
              {/* Header */}
              <div
                className={`flex items-center gap-3 px-4 py-3 ${hasLogs && group.status === 'done' ? 'cursor-pointer hover:bg-[#0a0a0a]' : ''}`}
                onClick={() => hasLogs && group.status === 'done' && toggleExpand(group.key)}
              >
                <div className="flex-shrink-0">
                  {group.status === 'error' ? (
                    <AlertCircle className="h-4 w-4 text-[#ff4444]" />
                  ) : group.status === 'done' ? (
                    <CheckCircle2 className="h-4 w-4 text-[#00cc88]" />
                  ) : (
                    <Loader2 className="h-4 w-4 text-[#888] animate-spin" />
                  )}
                </div>
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-sm text-[#ededed]">{group.label}</span>
                  <Badge variant={group.status === 'error' ? 'error' : group.status === 'done' ? 'success' : 'blue'}>
                    {group.status === 'running' ? 'running' : group.status === 'done' ? 'done' : 'error'}
                  </Badge>
                  {group.message && (
                    <span className="text-xs text-[#555] truncate ml-1">{group.message}</span>
                  )}
                </div>
                {hasLogs && group.status === 'done' && (
                  <ChevronDown className={`h-3.5 w-3.5 text-[#555] transition-transform duration-300 flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
                )}
              </div>

              {/* Collapsible logs */}
              <div
                className="overflow-hidden transition-all duration-500 ease-in-out"
                style={{
                  maxHeight: isExpanded ? '2000px' : '0px',
                  opacity: isExpanded ? 1 : 0,
                }}
              >
                {group.logs.map((log) => (
                  <div
                    key={log.key}
                    className="flex items-start gap-2 px-4 py-1.5 border-t border-[#181818]"
                  >
                    <span className="text-[#333] font-mono text-[10px] flex-shrink-0 mt-0.5">&gt;</span>
                    <p className="text-xs font-mono text-[#555]">{log.message}</p>
                  </div>
                ))}
                {group.type === 'video' && group.prompt && (
                  <div className="px-4 py-2 border-t border-[#181818]">
                    <p className="text-xs font-mono text-[#555] bg-[#111] p-3 rounded-lg border border-[#222] leading-relaxed">
                      {group.prompt}
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
