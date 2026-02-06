'use client';

import { Download, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { Video } from '@/lib/types';

interface VideoGalleryProps {
  videos: Video[];
}

export function VideoGallery({ videos }: VideoGalleryProps) {
  if (videos.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Generated Videos</h2>
        <span className="text-sm text-gray-600">{videos.length} videos</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {videos.map((video, i) => (
          <Card key={video.id} className="overflow-hidden">
            <CardContent className="p-0">
              <div className="aspect-video bg-gray-900 relative group">
                <video
                  src={video.url}
                  controls
                  className="w-full h-full object-contain"
                  preload="metadata"
                >
                  Your browser does not support the video tag.
                </video>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <p className="text-sm font-medium text-gray-900 mb-1">
                    Video {i + 1}
                  </p>
                  <p className="text-xs text-gray-600 line-clamp-2">
                    {video.prompt}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span>{video.aspectRatio}</span>
                  <span>•</span>
                  <span>{video.duration}s</span>
                  <span>•</span>
                  <span>{(video.size / (1024 * 1024)).toFixed(1)} MB</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    asChild
                  >
                    <a
                      href={`/api/download/${video.id}`}
                      download={`${video.filename}`}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </a>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    asChild
                  >
                    <a
                      href={video.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
