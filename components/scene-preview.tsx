'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Scene } from '@/lib/types';

interface ScenePreviewProps {
  scenes: Scene[];
  style?: string;
  mood?: string;
}

export function ScenePreview({ scenes, style, mood }: ScenePreviewProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Generated Scenes</CardTitle>
          <div className="flex gap-2">
            {style && <Badge variant="secondary">{style}</Badge>}
            {mood && <Badge variant="secondary">{mood}</Badge>}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {scenes.map((scene, i) => (
            <div
              key={i}
              className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-900 text-white flex items-center justify-center text-sm font-semibold">
                  {i + 1}
                </div>
                <div className="flex-1 space-y-2">
                  <p className="text-sm text-gray-900">{scene.prompt}</p>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>Duration: {scene.duration}s</span>
                    {scene.notes && (
                      <details className="inline">
                        <summary className="cursor-pointer hover:text-gray-700">
                          Technical notes
                        </summary>
                        <p className="mt-2 text-gray-600 bg-gray-50 p-2 rounded">
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
      </CardContent>
    </Card>
  );
}
