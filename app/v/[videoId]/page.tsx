'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Heart, ArrowLeft, Download, Check, Pencil } from 'lucide-react';

interface VideoDetail {
  id: string;
  blob_url: string;
  prompt: string;
  description: string | null;
  username: string;
  user_name: string;
  avatar_url: string | null;
  user_id: string;
  aspect_ratio: string;
  duration: number;
  heart_count: string;
  created_at: string;
  visibility: string;
}

export default function VideoPage() {
  const { videoId } = useParams<{ videoId: string }>();
  const [video, setVideo] = useState<VideoDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [hearted, setHearted] = useState(false);
  const [heartCount, setHeartCount] = useState(0);
  const [isOwner, setIsOwner] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [description, setDescription] = useState('');
  const [savingDesc, setSavingDesc] = useState(false);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/videos/${videoId}/detail`);
      if (res.ok) {
        const data = await res.json();
        setVideo(data.video);
        setHearted(data.hearted);
        setHeartCount(parseInt(data.video.heart_count, 10));
        setIsOwner(data.isOwner);
        setDescription(data.video.description || '');
      }
      setLoading(false);
    }
    load();
  }, [videoId]);

  const handleHeart = async () => {
    const res = await fetch(`/api/videos/${videoId}/heart`, { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      setHearted(data.hearted);
      setHeartCount(data.heartCount);
    }
  };

  const handleSaveDescription = async () => {
    setSavingDesc(true);
    await fetch(`/api/videos/${videoId}/description`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description }),
    });
    setSavingDesc(false);
    setEditingDesc(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <span className="text-[#555] text-sm font-mono">loading...</span>
      </div>
    );
  }

  if (!video) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-[#555]">Video not found</p>
          <Link href="/" className="text-sm text-[#0070f3] hover:underline">Back to feed</Link>
        </div>
      </div>
    );
  }

  const dateStr = new Date(video.created_at).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  return (
    <div className="min-h-screen bg-black">
      <div className="flex flex-col lg:flex-row min-h-screen">
        {/* Video player — left */}
        <div className="flex-1 flex items-center justify-center bg-[#0a0a0a] relative min-h-[50vh] lg:min-h-screen">
          <Link
            href="/"
            className="absolute top-4 left-4 z-10 w-9 h-9 rounded-lg bg-black/50 backdrop-blur-sm border border-[#333] flex items-center justify-center text-[#888] hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <video
            src={video.blob_url}
            controls
            autoPlay
            loop
            className="max-w-full max-h-[90vh] object-contain"
          />
        </div>

        {/* Info panel — right */}
        <div className="w-full lg:w-[400px] border-l border-[#222] flex flex-col">
          {/* Author + description */}
          <div className="p-5 border-b border-[#222] space-y-4">
            <div className="flex items-start gap-3">
              <Link href={`/u/${video.username}`} className="flex-shrink-0">
                {video.avatar_url ? (
                  <img src={video.avatar_url} alt={video.user_name} className="w-10 h-10 rounded-full object-cover border border-[#333]" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-[#222] border border-[#333] flex items-center justify-center text-sm font-bold text-[#888]">
                    {video.user_name?.[0]?.toUpperCase() || '?'}
                  </div>
                )}
              </Link>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Link href={`/u/${video.username}`} className="text-sm font-semibold text-[#ededed] hover:underline">
                    {video.user_name}
                  </Link>
                  <span className="text-xs text-[#555] ml-auto">{dateStr}</span>
                </div>
                <Link href={`/u/${video.username}`} className="text-xs text-[#666] font-mono">
                  @{video.username}
                </Link>
              </div>
            </div>

            {/* Description */}
            {editingDesc ? (
              <div className="space-y-2">
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add a description..."
                  rows={3}
                  className="w-full bg-[#0a0a0a] border border-[#333] rounded-lg px-3 py-2 text-sm text-[#ededed] placeholder:text-[#555] focus:outline-none focus:border-[#555] resize-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveDescription}
                    disabled={savingDesc}
                    className="text-xs px-3 py-1.5 rounded-lg bg-white text-black hover:bg-white/90 transition-colors disabled:opacity-50"
                  >
                    {savingDesc ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={() => { setEditingDesc(false); setDescription(video.description || ''); }}
                    className="text-xs px-3 py-1.5 rounded-lg text-[#888] hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="group">
                {description ? (
                  <p className="text-sm text-[#ccc] leading-relaxed">{description}</p>
                ) : isOwner ? (
                  <p className="text-sm text-[#555] italic">No description</p>
                ) : null}
                {isOwner && (
                  <button
                    onClick={() => setEditingDesc(true)}
                    className="mt-1 flex items-center gap-1 text-xs text-[#555] hover:text-[#888] transition-colors"
                  >
                    <Pencil className="h-3 w-3" />
                    {description ? 'Edit' : 'Add description'}
                  </button>
                )}
              </div>
            )}

            {/* Prompt */}
            <p className="text-xs text-[#555] font-mono leading-relaxed">{video.prompt}</p>

            {/* Actions */}
            <div className="flex items-center gap-4 pt-1">
              <button
                onClick={handleHeart}
                className="flex items-center gap-1.5 group/heart transition-colors"
              >
                <Heart
                  className={`h-5 w-5 transition-colors ${
                    hearted ? 'fill-[#ff4444] text-[#ff4444]' : 'text-[#888] group-hover/heart:text-[#ff4444]'
                  }`}
                />
                <span className={`text-sm ${hearted ? 'text-[#ff4444]' : 'text-[#888]'}`}>
                  {heartCount > 0 ? heartCount : ''}
                </span>
              </button>

              <a
                href={`/api/download/${video.id}`}
                download
                className="flex items-center gap-1.5 text-[#888] hover:text-white transition-colors"
              >
                <Download className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Spacer for future comments area */}
          <div className="flex-1" />
        </div>
      </div>
    </div>
  );
}
