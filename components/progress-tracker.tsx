'use client';

import { CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { ProgressEvent } from '@/lib/types';

interface ProgressTrackerProps {
  events: ProgressEvent[];
}

export function ProgressTracker({ events }: ProgressTrackerProps) {
  if (events.length === 0) {
    return null;
  }

  const getIcon = (event: ProgressEvent) => {
    if (event.type === 'error') {
      return <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />;
    }
    if (event.type === 'agent-complete' || event.type === 'video-complete') {
      return <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />;
    }
    return <Loader2 className="h-5 w-5 text-blue-500 animate-spin flex-shrink-0" />;
  };

  const getTitle = (event: ProgressEvent) => {
    switch (event.type) {
      case 'agent-start':
        return `Agent: ${event.agent}`;
      case 'agent-complete':
        return `Agent: ${event.agent} Complete`;
      case 'video-start':
        return `Video ${(event.sceneIndex ?? 0) + 1}`;
      case 'video-complete':
        return `Video ${(event.sceneIndex ?? 0) + 1} Complete`;
      case 'complete':
        return 'All Videos Generated';
      case 'error':
        return 'Error';
      default:
        return 'Processing';
    }
  };

  const getDescription = (event: ProgressEvent) => {
    if (event.status) return event.status;
    if (event.message) return event.message;
    if (event.type === 'agent-complete' && event.result) {
      const result = event.result;
      if (result.title) return result.title;
      if (result.scenes) return `${result.scenes.length} scenes generated`;
    }
    return '';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Generation Progress</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {events.map((event, i) => (
            <div key={i} className="flex items-start gap-3">
              {getIcon(event)}
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{getTitle(event)}</p>
                  <Badge variant="secondary" className="text-xs">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </Badge>
                </div>
                {getDescription(event) && (
                  <p className="text-sm text-gray-600 line-clamp-2">
                    {getDescription(event)}
                  </p>
                )}
                {event.type === 'video-start' && event.prompt && (
                  <details className="mt-2">
                    <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                      Show prompt
                    </summary>
                    <p className="mt-2 text-xs text-gray-600 bg-gray-50 p-2 rounded border border-gray-200">
                      {event.prompt}
                    </p>
                  </details>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
