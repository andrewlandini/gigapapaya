'use client';

import { Download, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Video } from '@/lib/types';

interface VideoGalleryProps {
  videos: Video[];
}

export function VideoGallery({ videos }: VideoGalleryProps) {
  if (videos.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-medium text-[#ededed]">Generated Videos</h2>
          <Badge variant="success">{videos.length} ready</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {videos.map((video, i) => (
          <div
            key={video.id}
            className="border border-[#222] rounded-xl overflow-hidden hover:border-[#333] transition-colors group animate-fade-in"
            style={{ animationDelay: `${i * 100}ms` }}
          >
            <div className="aspect-video bg-[#0a0a0a] relative">
              <video
                src={video.url}
                controls
                className="w-full h-full object-contain"
                preload="metadata"
              >
                Your browser does not support the video tag.
              </video>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center">
                  <Play className="h-5 w-5 text-white ml-0.5" />
                </div>
              </div>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-[#444]">Scene {i + 1}</span>
                <span className="text-[#333]">/</span>
                <span className="text-xs font-mono text-[#444]">{video.aspectRatio}</span>
                <span className="text-[#333]">/</span>
                <span className="text-xs font-mono text-[#444]">{video.duration}s</span>
                <span className="text-[#333]">/</span>
                <span className="text-xs font-mono text-[#444]">{(video.size / (1024 * 1024)).toFixed(1)}MB</span>
              </div>
              <p className="text-xs text-[#666] line-clamp-2 leading-relaxed">
                {video.prompt}
              </p>
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                asChild
              >
                <a
                  href={`/api/download/${video.id}`}
                  download={video.filename}
                >
                  <Download className="h-3.5 w-3.5 mr-2" />
                  Download
                </a>
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
