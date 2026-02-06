import type { Metadata } from 'next';
import Link from 'next/link';
import { Zap } from 'lucide-react';
import { getPublicVideos, initDb } from '@/lib/db';
import { getSession } from '@/lib/auth/session';
import { FeedGrid } from '@/components/feed-grid';

export const metadata: Metadata = {
  title: 'Feed',
  description: 'Browse AI-generated videos from the gigapapaya community. Powered by Google Veo 3.1.',
};

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  try { await initDb(); } catch {}

  const [videos, user] = await Promise.all([
    getPublicVideos(30, 0).catch(() => []),
    getSession(),
  ]);

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <main className="flex-1 p-4">
        {/* Feed */}
        <FeedGrid videos={videos as any} />
      </main>

      {/* Floating prompt bar */}
      <div className="sticky bottom-0 p-4 bg-gradient-to-t from-black via-black/95 to-transparent">
        <div className="max-w-2xl mx-auto">
          {user ? (
            <Link
              href="/generate"
              className="flex items-center gap-3 w-full h-12 px-4 rounded-xl border border-[#333] bg-[#0a0a0a] hover:border-[#555] transition-colors"
            >
              <span className="text-sm text-[#555]">Describe your video...</span>
              <div className="ml-auto flex items-center gap-2">
                <span className="text-xs font-mono text-[#333]">Veo 3.1</span>
                <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center">
                  <Zap className="h-4 w-4 text-black" />
                </div>
              </div>
            </Link>
          ) : (
            <Link
              href="/auth/sign-in"
              className="flex items-center justify-center gap-2 w-full h-12 px-4 rounded-xl border border-[#333] bg-[#0a0a0a] hover:border-[#555] transition-colors"
            >
              <span className="text-sm text-[#555]">Sign in to generate videos</span>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
