import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getUserByUsername, getUserPublicVideos, getUserStats } from '@/lib/db';
import { VideoCard } from '@/components/video-card';

export const revalidate = 30;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const user = await getUserByUsername(username);
  if (!user) return { title: 'User not found' };

  return {
    title: `@${user.username}`,
    description: `${user.name}'s AI-generated videos on gigapapaya.`,
    openGraph: {
      title: `@${user.username} — gigapapaya`,
      description: `${user.name}'s AI-generated videos on gigapapaya.`,
    },
  };
}

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const user = await getUserByUsername(username);
  if (!user) notFound();

  const [videos, stats] = await Promise.all([
    getUserPublicVideos(user.id),
    getUserStats(user.id),
  ]);

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
              <p className="text-lg font-semibold">{stats.public_count}</p>
              <p className="text-xs text-[#555]">videos</p>
            </div>
          </div>
        </div>
      </div>

      {/* Videos grid */}
      <div className="px-4 py-6">
        {videos.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-[#555]">No public videos</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
            {(videos as any[]).map((video) => (
              <div key={video.id}>
                <VideoCard
                  id={video.id}
                  blobUrl={video.blob_url}
                  prompt={video.prompt}
                  username={video.username}
                  aspectRatio={video.aspect_ratio}
                  duration={video.duration}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
