'use client';

import { useEffect, useState } from 'react';
import { Globe, Lock } from 'lucide-react';
import { VideoCard } from '@/components/video-card';

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
  user: { username: string; name: string } | null;
  videos: Video[];
  stats: { video_count: string; public_count: string; generation_count: string };
}

export default function ProfilePage() {
  const [data, setData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

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
    <div className="min-h-screen bg-black">
      {/* Profile header */}
      <div className="border-b border-[#222] py-10">
        <div className="max-w-4xl mx-auto px-6 text-center space-y-4">
          <div className="w-20 h-20 rounded-full bg-[#222] border border-[#333] flex items-center justify-center text-2xl font-bold text-[#888] mx-auto">
            {user.name[0].toUpperCase()}
          </div>
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
      <div className="max-w-6xl mx-auto p-6">
        {videos.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-[#555]">No videos yet</p>
            <p className="text-[#333] text-sm mt-1">Generate your first video</p>
          </div>
        ) : (
          <div className="columns-1 sm:columns-2 lg:columns-3 gap-3 space-y-3">
            {videos.map((video) => (
              <div key={video.id} className="break-inside-avoid">
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
    </div>
  );
}
