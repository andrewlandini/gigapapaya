'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ScenePlayer } from '@/components/scene-player';
import { Trash2, ArrowUp, ArrowDown, Download, ExternalLink } from 'lucide-react';
import Link from 'next/link';

interface SceneVideo {
  id: string;
  blob_url: string;
  prompt: string;
  duration: number;
  scene_index: number;
  aspect_ratio: string;
  size: number;
  username?: string;
  user_name?: string;
  avatar_url?: string;
  visibility?: string;
}

interface SceneData {
  generation: {
    id: string;
    userInput: string;
    idea: any;
    status: string;
    createdAt: string;
  };
  videos: SceneVideo[];
  isOwner: boolean;
}

export default function SceneGroupPage() {
  const { generationId } = useParams<{ generationId: string }>();
  const [data, setData] = useState<SceneData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const res = await fetch(`/api/scenes/${generationId}`);
    if (res.ok) {
      setData(await res.json());
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [generationId]);

  const handleReorder = async (videoId: string, newIndex: number) => {
    await fetch(`/api/scenes/${generationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reorder', videoId, newIndex }),
    });
    load();
  };

  const handleRemove = async (videoId: string) => {
    await fetch(`/api/scenes/${generationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'remove', videoId }),
    });
    load();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <span className="text-[#555] text-sm font-mono">loading...</span>
      </div>
    );
  }

  if (!data || data.videos.length === 0) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <span className="text-[#555] text-sm">Scene group not found</span>
      </div>
    );
  }

  const { generation, videos, isOwner } = data;
  const idea = generation.idea;
  const author = videos[0];

  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">
        {/* Header */}
        <div className="space-y-2">
          {idea && (
            <h1 className="text-2xl font-bold tracking-tight">{idea.title}</h1>
          )}
          {author?.username && (
            <Link href={`/u/${author.username}`} className="flex items-center gap-2 group">
              {author.avatar_url ? (
                <img src={author.avatar_url} alt={author.user_name} className="w-6 h-6 rounded-full object-cover" />
              ) : (
                <div className="w-6 h-6 rounded-full bg-[#222] flex items-center justify-center text-[10px] font-bold text-[#888]">
                  {(author.user_name || author.username)?.[0]?.toUpperCase()}
                </div>
              )}
              <span className="text-sm text-[#666] group-hover:text-[#ededed] transition-colors">@{author.username}</span>
            </Link>
          )}
          {idea?.description && (
            <p className="text-sm text-[#888] leading-relaxed">{idea.description}</p>
          )}
        </div>

        {/* Player */}
        <ScenePlayer videos={videos} />

        {/* Scene management (owner only) */}
        {isOwner && (
          <div className="space-y-3">
            <h2 className="text-xs font-mono text-[#555]">Manage scenes</h2>
            <div className="space-y-2">
              {videos.map((video, i) => (
                <div
                  key={video.id}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[#222] hover:border-[#333] transition-colors"
                >
                  <span className="text-xs font-mono text-[#555] w-16">Scene {i + 1}</span>
                  <p className="text-xs text-[#666] flex-1">{video.prompt}</p>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleReorder(video.id, Math.max(0, i - 1))}
                      disabled={i === 0}
                      className="p-1.5 rounded-md text-[#555] hover:text-white hover:bg-[#222] transition-colors disabled:opacity-20"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleReorder(video.id, Math.min(videos.length - 1, i + 1))}
                      disabled={i === videos.length - 1}
                      className="p-1.5 rounded-md text-[#555] hover:text-white hover:bg-[#222] transition-colors disabled:opacity-20"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                    <Link
                      href={`/v/${video.id}`}
                      className="p-1.5 rounded-md text-[#555] hover:text-white hover:bg-[#222] transition-colors"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                    <a
                      href={`/api/download/${video.id}`}
                      className="p-1.5 rounded-md text-[#555] hover:text-white hover:bg-[#222] transition-colors"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </a>
                    <button
                      onClick={() => handleRemove(video.id)}
                      className="p-1.5 rounded-md text-[#555] hover:text-[#ff4444] hover:bg-[#222] transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
