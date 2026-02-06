import type { Metadata } from 'next';
import { getPublicVideos, initDb } from '@/lib/db';
import { getSession } from '@/lib/auth/session';
import { HomeContent } from '@/components/home-content';

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

  return <HomeContent videos={videos as any} isAuthenticated={!!user} />;
}
