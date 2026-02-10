'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, Loader2, AlertCircle, ChevronDown, Circle } from 'lucide-react';
import type { ProgressEvent } from '@/lib/types';

// Stable date used for pending groups to avoid server/client hydration mismatch
const EPOCH = new Date(0);

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

      if (event.type === 'mood-board-image') {
        const group = result.find(g => g.key === 'mood-board');
        if (group) {
          const count = events.filter(e => e.type === 'mood-board-image' && events.indexOf(e) <= events.indexOf(event)).length;
          group.message = `${count}/3 images...`;
        }
        continue;
      }

      if (event.type === 'mood-board-complete') {
        const group = result.find(g => g.key === 'mood-board');
        if (group) {
          group.status = 'done';
          group.message = `${event.moodBoard?.length || 0} images generated`;
        }
        currentGroup = null;
        continue;
      }

      if ((event.type as string) === 'mood-board-ready') {
        const group = result.find(g => g.key === 'mood-board');
        if (group) {
          group.status = 'done';
          group.message = `${event.moodBoard?.length || 0} images — review`;
        }
        currentGroup = null;
        continue;
      }

      if (event.type === 'character-portrait') {
        let group = result.find(g => g.key === 'characters');
        if (!group) {
          group = {
            key: 'characters',
            label: 'Characters',
            status: 'running',
            message: '1 portrait...',
            timestamp: event.timestamp,
            logs: [],
            type: 'agent',
          };
          result.push(group);
        } else {
          const count = events.filter(e => e.type === 'character-portrait' && events.indexOf(e) <= events.indexOf(event)).length;
          group.message = `${count} portrait${count !== 1 ? 's' : ''}...`;
        }
        continue;
      }

      if ((event.type as string) === 'characters-ready') {
        const charGroup = result.find(g => g.key === 'characters');
        if (charGroup) {
          charGroup.status = 'done';
          const count = events.filter(e => e.type === 'character-portrait').length;
          charGroup.message = `${count} portrait${count !== 1 ? 's' : ''} — review`;
        }
        currentGroup = null;
        continue;
      }

      if (event.type === 'storyboard-start') {
        // Mark characters group as done when storyboard starts (portraits are finished)
        const charGroup = result.find(g => g.key === 'characters');
        if (charGroup && charGroup.status === 'running') {
          charGroup.status = 'done';
          const count = events.filter(e => e.type === 'character-portrait').length;
          charGroup.message = `${count} portrait${count !== 1 ? 's' : ''} generated`;
        }

        currentGroup = {
          key: 'storyboard',
          label: 'Storyboard',
          status: 'running',
          message: event.status || 'Generating preview frames...',
          timestamp: event.timestamp,
          logs: [],
          type: 'agent',
        };
        result.push(currentGroup);
        continue;
      }

      if (event.type === 'storyboard-frame') {
        const group = result.find(g => g.key === 'storyboard');
        if (group) {
          const count = events.filter(e => e.type === 'storyboard-frame' && events.indexOf(e) <= events.indexOf(event)).length;
          const total = events.find(e => e.type === 'agent-complete' && e.agent === 'scenes')?.result?.scenes?.length || '?';
          group.message = `${count}/${total} frames...`;
        }
        continue;
      }

      if (event.type === 'storyboard-complete') {
        const group = result.find(g => g.key === 'storyboard');
        if (group) {
          group.status = 'done';
          group.message = `${event.storyboardImages?.filter(Boolean).length || 0} frames generated`;
        }
        // Also ensure characters group is done
        const charGroup = result.find(g => g.key === 'characters');
        if (charGroup && charGroup.status === 'running') {
          charGroup.status = 'done';
          const count = events.filter(e => e.type === 'character-portrait').length;
          charGroup.message = `${count} portrait${count !== 1 ? 's' : ''} generated`;
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
        const moodBoardDone = hasKey('mood-board') && result.find(g => g.key === 'mood-board')?.status === 'done';
        if (!moodBoardDone) {
          // Phase 1: Concept → Mood Board → pause for review
          if (!hasKey('agent-idea')) {
            result.push({ key: 'agent-idea', label: 'Concept Agent', status: 'pending', message: '', timestamp: EPOCH, logs: [], type: 'agent' });
          }
          if (!hasKey('mood-board')) {
            result.push({ key: 'mood-board', label: 'Mood Board', status: 'pending', message: '', timestamp: EPOCH, logs: [], type: 'agent' });
          }
        } else {
          const charactersDone = hasKey('characters') && result.find(g => g.key === 'characters')?.status === 'done';
          if (!charactersDone) {
            // Phase 2 (after mood board review): Shots → Characters → pause for review
            if (!hasKey('agent-scenes')) {
              result.push({ key: 'agent-scenes', label: 'Shot Agent', status: 'pending', message: '', timestamp: EPOCH, logs: [], type: 'agent' });
            }
          } else {
            // Phase 3 (after character review): Storyboard
            if (!hasKey('storyboard')) {
              result.push({ key: 'storyboard', label: 'Storyboard', status: 'pending', message: '', timestamp: EPOCH, logs: [], type: 'agent' });
            }
          }
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
            timestamp: EPOCH,
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

  // No auto-collapse — agent steps are single-line, only video group expands

  if (groups.length === 0) return null;

  const toggleExpand = (key: string) => {
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
          const isPending = group.status === 'pending';
          const isVideoGroup = group.type === 'video';
          const isExpanded = isVideoGroup && (group.status === 'running' || group.status === 'error' || expanded.has(group.key));
          const hasShots = isVideoGroup && group.shots && group.shots.length > 0;

          return (
            <div key={group.key} className={`border-b border-[#222] last:border-b-0 ${isPending ? '' : 'animate-fade-in'}`}>
              {/* Header — single line for agent steps, expandable for video */}
              <div
                className={`flex items-center gap-3 px-4 py-2.5 ${hasShots && group.status === 'done' ? 'cursor-pointer hover:bg-[#0a0a0a]' : ''}`}
                onClick={() => hasShots && group.status === 'done' && toggleExpand(group.key)}
              >
                <div className="flex-shrink-0">
                  {isPending ? (
                    <Circle className="h-3.5 w-3.5 text-[#333]" />
                  ) : group.status === 'error' ? (
                    <AlertCircle className="h-3.5 w-3.5 text-[#ff4444]" />
                  ) : group.status === 'done' ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#00cc88]" />
                  ) : (
                    <Loader2 className="h-3.5 w-3.5 text-[#888] animate-spin" />
                  )}
                </div>
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className={`text-xs ${isPending ? 'text-[#444]' : 'text-[#888]'}`}>{group.label}</span>
                  {group.message && !isPending && (
                    <span className="text-xs text-[#555] truncate">{group.message}</span>
                  )}
                </div>
                {hasShots && group.status === 'done' && (
                  <ChevronDown className={`h-3 w-3 text-[#555] transition-transform duration-300 flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
                )}
              </div>

              {/* Expandable content — only for video group */}
              {isVideoGroup && (
              <div
                className="overflow-hidden transition-all duration-700 ease-in-out"
                style={{
                  maxHeight: isExpanded ? '2000px' : '0px',
                  opacity: isExpanded ? 1 : 0,
                }}
              >
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
              )}

            </div>
          );
        })}
      </div>
    </div>
  );
}
