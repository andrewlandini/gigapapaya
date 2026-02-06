'use client';

import { useEffect, useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { VideoCard } from '@/components/video-card';
import { PromptBar } from '@/components/prompt-bar';

interface Video {
  id: string;
  blob_url: string;
  prompt: string;
  username: string;
  aspect_ratio: string;
  duration: number;
  visibility: string;
}

interface UserData {
  user: { username: string; name: string; avatarUrl: string | null } | null;
  videos: Video[];
  stats: { video_count: string; public_count: string; generation_count: string };
}

export default function ProfilePage() {
  const [data, setData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [iconPrompt, setIconPrompt] = useState('');
  const [generatingIcon, setGeneratingIcon] = useState(false);
  const [showIconGen, setShowIconGen] = useState(false);
  const [iconError, setIconError] = useState<string | null>(null);

  const load = async () => {
    const res = await fetch('/api/profile');
    if (res.ok) {
      setData(await res.json());
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggleVisibility = async (videoId: string, visibility: 'public' | 'private') => {
    await fetch(`/api/videos/${videoId}/share`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visibility }),
    });
    load();
  };

  const generateIcon = async () => {
    if (!iconPrompt.trim()) return;
    setGeneratingIcon(true);
    setIconError(null);

    try {
      const res = await fetch('/api/generate-icon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: iconPrompt }),
      });

      if (res.ok) {
        setShowIconGen(false);
        setIconPrompt('');
        load();
      } else {
        const err = await res.json();
        setIconError(err.error || 'Failed to generate icon');
      }
    } catch {
      setIconError('Failed to generate icon');
    } finally {
      setGeneratingIcon(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <span className="text-[#555] text-sm font-mono">loading...</span>
      </div>
    );
  }

  if (!data?.user) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <span className="text-[#555] text-sm">Not signed in</span>
      </div>
    );
  }

  const { user, videos, stats } = data;

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Profile header */}
      <div className="border-b border-[#222] py-10">
        <div className="max-w-4xl mx-auto px-6 text-center space-y-4">
          {/* Avatar */}
          <div className="relative inline-block group">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name}
                className="w-20 h-20 rounded-full object-cover border border-[#333]"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-[#222] border border-[#333] flex items-center justify-center text-2xl font-bold text-[#888]">
                {user.name[0].toUpperCase()}
              </div>
            )}
            <button
              onClick={() => { setShowIconGen(!showIconGen); setIconError(null); }}
              title="Generate avatar"
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[#222] border border-[#333] flex items-center justify-center text-[#888] hover:text-white hover:border-[#555] transition-colors"
            >
              <Sparkles className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Icon generator */}
          {showIconGen && (
            <div className="max-w-sm mx-auto space-y-3 animate-fade-in">
              <div className="border border-[#222] rounded-xl p-4 bg-[#0a0a0a] space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[#888]" />
                  <span className="text-xs font-mono text-[#666]">nanobanana</span>
                </div>
                <input
                  type="text"
                  value={iconPrompt}
                  onChange={(e) => setIconPrompt(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && generateIcon()}
                  placeholder="a papaya in space, pixel art..."
                  disabled={generatingIcon}
                  className="w-full bg-black border border-[#333] rounded-lg px-3 py-2 text-sm text-[#ededed] placeholder:text-[#555] focus:outline-none focus:border-[#555] focus:ring-1 focus:ring-white/10"
                />
                {iconError && (
                  <p className="text-xs text-[#ff4444]">{iconError}</p>
                )}
                <Button
                  onClick={generateIcon}
                  disabled={generatingIcon || !iconPrompt.trim()}
                  size="sm"
                  className="w-full"
                >
                  {generatingIcon ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    'Generate avatar'
                  )}
                </Button>
              </div>
            </div>
          )}

          <div>
            <h1 className="text-xl font-semibold">{user.name}</h1>
            <p className="text-sm text-[#666] font-mono">@{user.username}</p>
          </div>
          <div className="flex items-center justify-center gap-8">
            <div className="text-center">
              <p className="text-lg font-semibold">{stats.video_count}</p>
              <p className="text-xs text-[#555]">videos</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold">{stats.public_count}</p>
              <p className="text-xs text-[#555]">shared</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold">{stats.generation_count}</p>
              <p className="text-xs text-[#555]">generations</p>
            </div>
          </div>
        </div>
      </div>

      {/* Videos grid */}
      <div className="max-w-6xl mx-auto p-6 flex-1">
        {videos.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-[#555]">No videos yet</p>
            <p className="text-[#333] text-sm mt-1">Generate your first video</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {videos.map((video) => (
              <div key={video.id}>
                <VideoCard
                  id={video.id}
                  blobUrl={video.blob_url}
                  prompt={video.prompt}
                  username={video.username}
                  aspectRatio={video.aspect_ratio}
                  duration={video.duration}
                  visibility={video.visibility}
                  showVisibilityToggle
                  onToggleVisibility={toggleVisibility}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Prompt bar */}
      <PromptBar isAuthenticated={true} />
    </div>
  );
}
