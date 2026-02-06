'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import { CheckCircle2, Loader2, AlertCircle, ChevronDown, Circle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { ProgressEvent } from '@/lib/types';

interface ProgressTrackerProps {
  events: ProgressEvent[];
  status?: string; // generation state status
  shotCount?: number; // total shots for phase 2
}

interface AgentGroup {
  key: string;
  label: string;
  status: 'running' | 'done' | 'error' | 'pending';
  message: string;
  timestamp: Date;
  logs: { key: string; message: string }[];
  prompt?: string;
  result?: any;
  type: 'agent' | 'video' | 'complete' | 'error';
  shots?: { sceneIndex: number; status: 'pending' | 'running' | 'done' | 'error'; prompt?: string }[];
}

export function ProgressTracker({ events, status, shotCount }: ProgressTrackerProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [manualToggle, setManualToggle] = useState<Set<string>>(new Set());
  const collapsedByTimer = useRef<Set<string>>(new Set());

  const groups = useMemo(() => {
    const result: AgentGroup[] = [];
    let currentGroup: AgentGroup | null = null;

    for (const event of events) {
      if (event.type === 'agent-start' && event.agent) {
        const label = event.agent === 'idea' ? 'Concept Agent'
          : event.agent === 'scenes' ? 'Shot Agent'
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
            group.message = `${event.result.scenes.length} shots generated`;
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

      if (event.type === 'mood-board-start') {
        currentGroup = {
          key: 'mood-board',
          label: 'Mood Board',
          status: 'running',
          message: event.status || 'Generating reference images...',
          timestamp: event.timestamp,
          logs: [],
          type: 'agent',
        };
        result.push(currentGroup);
        continue;
      }

      if (event.type === 'mood-board-complete') {
        const group = result.find(g => g.key === 'mood-board');
        if (group) {
          group.status = 'done';
          group.message = `${(event as any).moodBoard?.length || 0} images generated`;
        }
        currentGroup = null;
        continue;
      }

      if (event.type === 'video-start') {
        const sceneIdx = event.sceneIndex ?? 0;
        let videoGroup = result.find(g => g.key === 'video-generation');
        if (!videoGroup) {
          videoGroup = {
            key: 'video-generation',
            label: 'Generating Videos',
            status: 'running',
            message: `0/${shotCount || '?'} complete`,
            timestamp: event.timestamp,
            logs: [],
            type: 'video',
            shots: [],
          };
          result.push(videoGroup);
        }
        videoGroup.shots!.push({
          sceneIndex: sceneIdx,
          status: 'running',
          prompt: event.prompt,
        });
        currentGroup = videoGroup;
        continue;
      }

      if (event.type === 'video-complete') {
        const sceneIdx = event.sceneIndex ?? 0;
        const videoGroup = result.find(g => g.key === 'video-generation');
        if (videoGroup?.shots) {
          const shot = videoGroup.shots.find(s => s.sceneIndex === sceneIdx);
          if (shot) shot.status = 'done';
          const doneCount = videoGroup.shots.filter(s => s.status === 'done').length;
          const errorCount = videoGroup.shots.filter(s => s.status === 'error').length;
          const total = shotCount || videoGroup.shots.length;
          videoGroup.message = `${doneCount}/${total} complete${errorCount > 0 ? `, ${errorCount} failed` : ''}`;
          if (doneCount + errorCount >= total) {
            videoGroup.status = doneCount > 0 ? 'done' : 'error';
          }
        }
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
          const videoGroup = result.find(g => g.key === 'video-generation');
          if (videoGroup?.shots) {
            const shot = videoGroup.shots.find(s => s.sceneIndex === event.sceneIndex);
            if (shot) shot.status = 'error';
            const doneCount = videoGroup.shots.filter(s => s.status === 'done').length;
            const errorCount = videoGroup.shots.filter(s => s.status === 'error').length;
            const total = shotCount || videoGroup.shots.length;
            videoGroup.message = `${doneCount}/${total} complete${errorCount > 0 ? `, ${errorCount} failed` : ''}`;
            if (doneCount + errorCount >= total) {
              videoGroup.status = doneCount > 0 ? 'done' : 'error';
            }
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

    // Append upcoming steps based on what hasn't happened yet
    const hasKey = (k: string) => result.some(g => g.key === k);
    const isComplete = result.some(g => g.type === 'complete');
    const hasError = result.some(g => g.type === 'error' && g.key.startsWith('error'));

    if (!isComplete && !hasError) {
      if (status === 'generating') {
        // Phase 1: Concept → (Mood Board if beta) → Shots → Review
        if (!hasKey('agent-idea')) {
          result.push({ key: 'agent-idea', label: 'Concept Agent', status: 'pending', message: '', timestamp: new Date(), logs: [], type: 'agent' });
        }
        if (!hasKey('agent-scenes')) {
          result.push({ key: 'agent-scenes', label: 'Shot Agent', status: 'pending', message: '', timestamp: new Date(), logs: [], type: 'agent' });
        }
      } else if (status === 'generating-videos' && shotCount) {
        // Phase 2: Single group for all parallel video generations
        let videoGroup = result.find(g => g.key === 'video-generation');
        if (!videoGroup) {
          videoGroup = {
            key: 'video-generation',
            label: 'Generating Videos',
            status: 'running',
            message: `0/${shotCount} complete`,
            timestamp: new Date(),
            logs: [],
            type: 'video',
            shots: [],
          };
          result.push(videoGroup);
        }
        for (let i = 0; i < shotCount; i++) {
          if (!videoGroup.shots!.some(s => s.sceneIndex === i)) {
            videoGroup.shots!.push({ sceneIndex: i, status: 'pending' });
          }
        }
        videoGroup.shots!.sort((a, b) => a.sceneIndex - b.sceneIndex);
      }
    }

    return result;
  }, [events, status, shotCount]);

  // Auto-collapse done groups 5 seconds after the NEXT step starts running
  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];

    for (let i = 0; i < groups.length; i++) {
      const group = groups[i];
      if (group.status !== 'done' || group.logs.length === 0) continue;
      if (collapsedByTimer.current.has(group.key) || manualToggle.has(group.key)) continue;

      // Only collapse once the next step is active (running or done)
      const nextGroup = groups[i + 1];
      if (!nextGroup || nextGroup.status === 'pending') continue;

      collapsedByTimer.current.add(group.key);
      const timer = setTimeout(() => {
        setExpanded(prev => {
          const next = new Set(prev);
          if (!manualToggle.has(group.key)) {
            next.delete(group.key);
          }
          return next;
        });
      }, 5000);
      timers.push(timer);
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
          const isError = group.status === 'error';
          const isPending = group.status === 'pending';
          const isExpanded = isRunning || isError || expanded.has(group.key);
          const hasLogs = group.logs.length > 0 || (group.shots && group.shots.length > 0);

          return (
            <div key={group.key} className={`border-b border-[#222] last:border-b-0 ${isPending ? '' : 'animate-fade-in'}`}>
              {/* Header */}
              <div
                className={`flex items-center gap-3 px-4 py-3 ${hasLogs && !isRunning && !isPending ? 'cursor-pointer hover:bg-[#0a0a0a]' : ''}`}
                onClick={() => hasLogs && !isRunning && !isPending && toggleExpand(group.key)}
              >
                <div className="flex-shrink-0">
                  {isPending ? (
                    <Circle className="h-4 w-4 text-[#333]" />
                  ) : group.status === 'error' ? (
                    <AlertCircle className="h-4 w-4 text-[#ff4444]" />
                  ) : group.status === 'done' ? (
                    <CheckCircle2 className="h-4 w-4 text-[#00cc88]" />
                  ) : (
                    <Loader2 className="h-4 w-4 text-[#888] animate-spin" />
                  )}
                </div>
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className={`text-sm ${isPending ? 'text-[#444]' : 'text-[#ededed]'}`}>{group.label}</span>
                  {!isPending && (
                    <Badge variant={group.status === 'error' ? 'error' : group.status === 'done' ? 'success' : 'blue'}>
                      {group.status === 'running' ? 'running' : group.status === 'done' ? 'done' : 'error'}
                    </Badge>
                  )}
                  {group.message && (
                    <span className="text-xs text-[#555] truncate ml-1">{group.message}</span>
                  )}
                </div>
                {hasLogs && !isRunning && !isPending && (
                  <ChevronDown className={`h-3.5 w-3.5 text-[#555] transition-transform duration-300 flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
                )}
              </div>

              {/* Collapsible logs */}
              <div
                className="overflow-hidden transition-all duration-1000 ease-in-out"
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
                {group.shots && group.shots.length > 0 && (
                  <div className="px-4 py-2 border-t border-[#181818] space-y-0.5">
                    {group.shots.map((shot) => (
                      <div key={shot.sceneIndex} className="flex items-center gap-2 py-1">
                        <div className="flex-shrink-0">
                          {shot.status === 'done' ? (
                            <CheckCircle2 className="h-3 w-3 text-[#00cc88]" />
                          ) : shot.status === 'error' ? (
                            <AlertCircle className="h-3 w-3 text-[#ff4444]" />
                          ) : shot.status === 'running' ? (
                            <Loader2 className="h-3 w-3 text-[#888] animate-spin" />
                          ) : (
                            <Circle className="h-3 w-3 text-[#333]" />
                          )}
                        </div>
                        <span className={`text-xs font-mono ${shot.status === 'pending' ? 'text-[#444]' : 'text-[#666]'}`}>
                          Shot {shot.sceneIndex + 1}
                        </span>
                        <span className={`text-xs font-mono ${
                          shot.status === 'done' ? 'text-[#00cc88]' :
                          shot.status === 'error' ? 'text-[#ff4444]' :
                          shot.status === 'running' ? 'text-[#888]' :
                          'text-[#333]'
                        }`}>
                          {shot.status === 'done' ? 'complete' :
                           shot.status === 'error' ? 'failed' :
                           shot.status === 'running' ? 'generating...' :
                           'waiting'}
                        </span>
                      </div>
                    ))}
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
