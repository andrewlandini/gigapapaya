import type { Metadata } from 'next';
import { getPublicVideosSorted, initDb } from '@/lib/db';
import { getSession } from '@/lib/auth/session';
import { HomeContent } from '@/components/home-content';

export const metadata: Metadata = {
  title: 'Feed',
  description: 'Browse AI-generated videos from the gigapapaya community. Powered by Google Veo 3.1.',
};

export const revalidate = 30; // ISR: rebuild every 30s instead of every request

export default async function HomePage() {
  try { await initDb(); } catch {}

  const [videos, user] = await Promise.all([
    getPublicVideosSorted(30, 0, 'all').catch(() => []),
    getSession(),
  ]);

  return <HomeContent videos={videos as any} isAuthenticated={!!user} />;
}
